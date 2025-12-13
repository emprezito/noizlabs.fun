import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { PROGRAM_ID, TOKEN_CONFIG_SEED, LP_ACCOUNT_SEED, PLATFORM_FEE_ACCOUNT } from "./idl";
import {
  createAudioTokenInstruction,
  buyTokensInstruction,
  sellTokensInstruction,
} from "./instructionBuilder";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export const programId = new PublicKey(PROGRAM_ID);
const platformFeeAccount = new PublicKey(PLATFORM_FEE_ACCOUNT);

// Platform fee percentage (0.25%)
export const PLATFORM_FEE_PERCENT = 0.0025;
export const PLATFORM_FEE_BPS = 25;
export const BASIS_POINTS_DIVISOR = 10000;

// Derive PDAs - Updated for new program
export function getTokenConfigPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_CONFIG_SEED), mint.toBuffer()],
    programId
  );
}

export function getLpAccountPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(LP_ACCOUNT_SEED), mint.toBuffer()],
    programId
  );
}

// Legacy aliases for backward compatibility
export const getAudioTokenPDA = getTokenConfigPDA;
export const getBondingCurvePDA = getTokenConfigPDA;

export function getMetadataAddress(mint: PublicKey): PublicKey {
  const [metadataAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return metadataAddress;
}

// Removed Anchor program initialization - using manual instruction builder

export interface CreateAudioTokenParams {
  name: string;
  symbol: string;
  metadataUri: string;
  totalSupply: bigint;
  // Note: initialPrice is no longer needed - the program uses creator's SOL balance
}

// Create audio token with bonding curve - using manual instruction builder
export async function createAudioToken(
  connection: Connection,
  creator: PublicKey,
  mintKeypair: Keypair,
  params: CreateAudioTokenParams
): Promise<Transaction> {
  const mint = mintKeypair.publicKey;

  const [tokenConfigPDA] = getTokenConfigPDA(mint);
  const [lpAccountPDA] = getLpAccountPDA(mint);
  const metadataAddress = getMetadataAddress(mint);
  const reserveTokenAccount = await getAssociatedTokenAddress(mint, tokenConfigPDA, true);

  console.log("Creating token with manual instruction builder:", {
    tokenConfig: tokenConfigPDA.toString(),
    lpAccount: lpAccountPDA.toString(),
    mint: mint.toString(),
    reserveTokenAccount: reserveTokenAccount.toString(),
    metadataAccount: metadataAddress.toString(),
    creator: creator.toString(),
  });

  const instruction = await createAudioTokenInstruction(
    {
      tokenConfig: tokenConfigPDA,
      lpAccount: lpAccountPDA,
      mint: mint,
      reserveTokenAccount: reserveTokenAccount,
      metadataAccount: metadataAddress,
      creator: creator,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    },
    {
      name: params.name.slice(0, 32),
      symbol: params.symbol.slice(0, 10),
      metadataUri: params.metadataUri.slice(0, 200),
      totalSupply: params.totalSupply,
    }
  );

  const tx = new Transaction().add(instruction);
  tx.feePayer = creator;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  // Partial sign with mint keypair
  tx.partialSign(mintKeypair);

  return tx;
}

// Legacy alias
export const createAudioTokenWithCurve = createAudioToken;

// Buy tokens - using manual instruction builder
export async function buyTokens(
  connection: Connection,
  buyer: PublicKey,
  mint: PublicKey,
  solAmount: bigint,
  minTokensOut: bigint = BigInt(0)
): Promise<Transaction> {
  const [tokenConfigPDA] = getTokenConfigPDA(mint);
  const reserveTokenAccount = await getAssociatedTokenAddress(mint, tokenConfigPDA, true);
  const buyerTokenAccount = await getAssociatedTokenAddress(mint, buyer);

  const instruction = await buyTokensInstruction(
    {
      tokenConfig: tokenConfigPDA,
      mint: mint,
      reserveTokenAccount: reserveTokenAccount,
      buyerTokenAccount: buyerTokenAccount,
      buyer: buyer,
    },
    {
      solAmount: solAmount,
      minTokensOut: minTokensOut,
    }
  );

  const tx = new Transaction().add(instruction);
  tx.feePayer = buyer;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  return tx;
}

// Sell tokens - using manual instruction builder
export async function sellTokens(
  connection: Connection,
  seller: PublicKey,
  mint: PublicKey,
  tokenAmount: bigint,
  minSolOut: bigint = BigInt(0)
): Promise<Transaction> {
  const [tokenConfigPDA] = getTokenConfigPDA(mint);
  const [lpAccountPDA] = getLpAccountPDA(mint);
  const reserveTokenAccount = await getAssociatedTokenAddress(mint, tokenConfigPDA, true);
  const sellerTokenAccount = await getAssociatedTokenAddress(mint, seller);

  const instruction = await sellTokensInstruction(
    {
      tokenConfig: tokenConfigPDA,
      lpAccount: lpAccountPDA,
      mint: mint,
      reserveTokenAccount: reserveTokenAccount,
      sellerTokenAccount: sellerTokenAccount,
      seller: seller,
    },
    {
      tokenAmount: tokenAmount,
      minSolOut: minSolOut,
    }
  );

  const tx = new Transaction().add(instruction);
  tx.feePayer = seller;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  return tx;
}

// Fetch token config data (replaces fetchBondingCurve)
export async function fetchTokenConfig(
  connection: Connection,
  mint: PublicKey
) {
  const [tokenConfigPDA] = getTokenConfigPDA(mint);
  const accountInfo = await connection.getAccountInfo(tokenConfigPDA);
  
  if (!accountInfo) {
    return null;
  }

  // Parse TokenConfig account data
  const data = accountInfo.data;
  // Skip discriminator (8 bytes)
  let offset = 8;
  
  const mintPubkey = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  const creator = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read name (4 bytes length + string)
  const nameLen = data.readUInt32LE(offset);
  offset += 4;
  const name = data.slice(offset, offset + nameLen).toString("utf-8");
  offset += nameLen;

  // Read symbol
  const symbolLen = data.readUInt32LE(offset);
  offset += 4;
  const symbol = data.slice(offset, offset + symbolLen).toString("utf-8");
  offset += symbolLen;

  // Read metadata_uri
  const metadataUriLen = data.readUInt32LE(offset);
  offset += 4;
  const metadataUri = data.slice(offset, offset + metadataUriLen).toString("utf-8");
  offset += metadataUriLen;

  const totalSupply = data.readBigUInt64LE(offset);
  offset += 8;

  const initialSupply = data.readBigUInt64LE(offset);
  offset += 8;

  const solReserves = data.readBigUInt64LE(offset);
  offset += 8;
  
  const tokenReserves = data.readBigUInt64LE(offset);
  offset += 8;
  
  const tokensSold = data.readBigUInt64LE(offset);
  offset += 8;

  const totalVolume = data.readBigUInt64LE(offset);
  offset += 8;

  const createdAt = data.readBigInt64LE(offset);
  offset += 8;
  
  const bump = data.readUInt8(offset);

  return {
    mint: mintPubkey.toString(),
    creator: creator.toString(),
    name,
    symbol,
    metadataUri,
    totalSupply: Number(totalSupply) / 1e9,
    initialSupply: Number(initialSupply) / 1e9,
    solReserves: Number(solReserves) / 1e9,
    tokenReserves: Number(tokenReserves) / 1e9,
    tokensSold: Number(tokensSold) / 1e9,
    totalVolume: Number(totalVolume) / 1e9,
    createdAt: Number(createdAt) * 1000,
    bump,
  };
}

// Legacy alias - fetchBondingCurve returns same format as fetchTokenConfig
export async function fetchBondingCurve(
  connection: Connection,
  mint: PublicKey
) {
  const config = await fetchTokenConfig(connection, mint);
  if (!config) return null;
  
  // Return compatible format for existing code
  return {
    mint: config.mint,
    creator: config.creator,
    solReserves: config.solReserves,
    tokenReserves: config.tokenReserves,
    initialPrice: config.tokenReserves > 0 ? config.solReserves / config.tokenReserves : 0,
    tokensSold: config.tokensSold,
    bump: config.bump,
  };
}

// Fetch audio token data (legacy - now returns from TokenConfig)
export async function fetchAudioToken(
  connection: Connection,
  mint: PublicKey
) {
  const config = await fetchTokenConfig(connection, mint);
  if (!config) return null;

  return {
    authority: config.creator,
    name: config.name,
    symbol: config.symbol,
    audioUri: config.metadataUri,
    mint: config.mint,
    totalSupply: config.totalSupply,
    createdAt: config.createdAt,
    bump: config.bump,
  };
}

// Fetch LP account data
export async function fetchLpAccount(
  connection: Connection,
  mint: PublicKey
) {
  const [lpAccountPDA] = getLpAccountPDA(mint);
  const accountInfo = await connection.getAccountInfo(lpAccountPDA);
  
  if (!accountInfo) {
    return null;
  }

  const data = accountInfo.data;
  let offset = 8; // Skip discriminator

  const mintPubkey = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const liquidity = data.readBigUInt64LE(offset);
  offset += 8;

  const timestamp = data.readBigInt64LE(offset);
  offset += 8;

  const bump = data.readUInt8(offset);

  return {
    mint: mintPubkey.toString(),
    liquidity: Number(liquidity) / 1e9,
    timestamp: Number(timestamp) * 1000,
    bump,
  };
}

// Calculate buy price based on constant product formula
export function calculateBuyPrice(
  solAmount: number,
  solReserves: number,
  tokenReserves: number
): { tokensOut: number; priceImpact: number } {
  if (tokenReserves <= 0 || solReserves <= 0) {
    return { tokensOut: 0, priceImpact: 0 };
  }
  
  // Constant product: k = solReserves * tokenReserves
  const k = solReserves * tokenReserves;
  const newSolReserves = solReserves + solAmount;
  const newTokenReserves = k / newSolReserves;
  const tokensOut = tokenReserves - newTokenReserves;
  
  // Calculate price impact
  const spotPrice = solReserves / tokenReserves;
  const executionPrice = solAmount / tokensOut;
  const priceImpact = ((executionPrice - spotPrice) / spotPrice) * 100;
  
  return { tokensOut, priceImpact };
}

// Calculate sell return based on constant product formula
export function calculateSellReturn(
  tokenAmount: number,
  solReserves: number,
  tokenReserves: number
): { solOut: number; priceImpact: number } {
  if (solReserves <= 0 || tokenReserves <= 0) {
    return { solOut: 0, priceImpact: 0 };
  }
  
  // Constant product: k = solReserves * tokenReserves
  const k = solReserves * tokenReserves;
  const newTokenReserves = tokenReserves + tokenAmount;
  const newSolReserves = k / newTokenReserves;
  const solOut = solReserves - newSolReserves;
  
  // Apply platform fee (0.25%)
  const platformFee = solOut * PLATFORM_FEE_PERCENT;
  const solAfterFee = solOut - platformFee;
  
  // Calculate price impact
  const spotPrice = solReserves / tokenReserves;
  const executionPrice = solOut / tokenAmount;
  const priceImpact = ((spotPrice - executionPrice) / spotPrice) * 100;
  
  return { solOut: solAfterFee, priceImpact };
}

// Helper to estimate tokens from SOL amount for buying
export function estimateTokensFromSol(
  solAmount: number,
  solReserves: number,
  tokenReserves: number
): number {
  const { tokensOut } = calculateBuyPrice(solAmount, solReserves, tokenReserves);
  return tokensOut;
}

// Helper to estimate SOL from token amount for selling
export function estimateSolFromTokens(
  tokenAmount: number,
  solReserves: number,
  tokenReserves: number
): number {
  const { solOut } = calculateSellReturn(tokenAmount, solReserves, tokenReserves);
  return solOut;
}
