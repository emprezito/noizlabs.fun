import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { PROGRAM_ID, AUDIO_TOKEN_SEED, BONDING_CURVE_SEED, PLATFORM_FEE_ACCOUNT, IDL } from "./idl";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export const programId = new PublicKey(PROGRAM_ID);
const platformFeeAccount = new PublicKey(PLATFORM_FEE_ACCOUNT);

// Platform fee percentage (0.25%)
export const PLATFORM_FEE_PERCENT = 0.0025;

// Derive PDAs
export function getAudioTokenPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(AUDIO_TOKEN_SEED), mint.toBuffer()],
    programId
  );
}

export function getBondingCurvePDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()],
    programId
  );
}

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

// Create a read-only provider for fetching data
function getReadOnlyProvider(connection: Connection): AnchorProvider {
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async <T>(tx: T): Promise<T> => tx,
    signAllTransactions: async <T>(txs: T[]): Promise<T[]> => txs,
  };
  return new AnchorProvider(connection, dummyWallet as any, {
    commitment: "confirmed",
  });
}

// Get the program instance
export function getProgram(connection: Connection): Program {
  const provider = getReadOnlyProvider(connection);
  return new Program(IDL as unknown as Idl, provider);
}

export interface CreateAudioTokenParams {
  name: string;
  symbol: string;
  metadataUri: string;
  totalSupply: bigint;
  initialPrice: bigint;
}

// Create audio token with bonding curve using Anchor
export async function createAudioTokenWithCurve(
  connection: Connection,
  creator: PublicKey,
  mintKeypair: Keypair,
  params: CreateAudioTokenParams
): Promise<Transaction> {
  const program = getProgram(connection);
  const mint = mintKeypair.publicKey;

  const [audioTokenPDA] = getAudioTokenPDA(mint);
  const [bondingCurvePDA] = getBondingCurvePDA(mint);
  const metadataAddress = getMetadataAddress(mint);
  const curveTokenAccount = await getAssociatedTokenAddress(mint, bondingCurvePDA, true);

  console.log("Creating token with Anchor SDK:", {
    program: program.programId.toString(),
    audioToken: audioTokenPDA.toString(),
    bondingCurve: bondingCurvePDA.toString(),
    mint: mint.toString(),
    curveTokenAccount: curveTokenAccount.toString(),
    metadataAccount: metadataAddress.toString(),
    creator: creator.toString(),
  });

  const tx = await program.methods
    .createAudioTokenWithCurve(
      params.name.slice(0, 50),
      params.symbol.slice(0, 10),
      params.metadataUri.slice(0, 200),
      new BN(params.totalSupply.toString()),
      new BN(params.initialPrice.toString())
    )
    .accounts({
      audioToken: audioTokenPDA,
      bondingCurve: bondingCurvePDA,
      mint: mint,
      curveTokenAccount: curveTokenAccount,
      metadataAccount: metadataAddress,
      creator: creator,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .transaction();

  tx.feePayer = creator;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  // Partial sign with mint keypair
  tx.partialSign(mintKeypair);

  return tx;
}

// Buy tokens using Anchor
export async function buyTokens(
  connection: Connection,
  buyer: PublicKey,
  mint: PublicKey,
  amount: bigint
): Promise<Transaction> {
  const program = getProgram(connection);

  const [bondingCurvePDA] = getBondingCurvePDA(mint);
  const curveTokenAccount = await getAssociatedTokenAddress(mint, bondingCurvePDA, true);
  const buyerTokenAccount = await getAssociatedTokenAddress(mint, buyer);

  const tx = await program.methods
    .buyTokens(new BN(amount.toString()))
    .accounts({
      bondingCurve: bondingCurvePDA,
      mint: mint,
      curveTokenAccount: curveTokenAccount,
      buyerTokenAccount: buyerTokenAccount,
      buyer: buyer,
      platformFeeAccount: platformFeeAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .transaction();

  tx.feePayer = buyer;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  return tx;
}

// Sell tokens using Anchor
export async function sellTokens(
  connection: Connection,
  seller: PublicKey,
  mint: PublicKey,
  amount: bigint
): Promise<Transaction> {
  const program = getProgram(connection);

  const [bondingCurvePDA] = getBondingCurvePDA(mint);
  const curveTokenAccount = await getAssociatedTokenAddress(mint, bondingCurvePDA, true);
  const sellerTokenAccount = await getAssociatedTokenAddress(mint, seller);

  const tx = await program.methods
    .sellTokens(new BN(amount.toString()))
    .accounts({
      bondingCurve: bondingCurvePDA,
      mint: mint,
      curveTokenAccount: curveTokenAccount,
      sellerTokenAccount: sellerTokenAccount,
      seller: seller,
      platformFeeAccount: platformFeeAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  tx.feePayer = seller;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  return tx;
}

// Fetch bonding curve data
export async function fetchBondingCurve(
  connection: Connection,
  mint: PublicKey
) {
  const [bondingCurvePDA] = getBondingCurvePDA(mint);
  const accountInfo = await connection.getAccountInfo(bondingCurvePDA);
  
  if (!accountInfo) {
    return null;
  }

  // Parse bonding curve account data
  const data = accountInfo.data;
  // Skip discriminator (8 bytes)
  let offset = 8;
  
  const mintPubkey = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  const creator = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  const solReserves = data.readBigUInt64LE(offset);
  offset += 8;
  
  const tokenReserves = data.readBigUInt64LE(offset);
  offset += 8;
  
  const initialPrice = data.readBigUInt64LE(offset);
  offset += 8;
  
  const tokensSold = data.readBigUInt64LE(offset);
  offset += 8;
  
  const bump = data.readUInt8(offset);

  return {
    mint: mintPubkey.toString(),
    creator: creator.toString(),
    solReserves: Number(solReserves) / 1e9,
    tokenReserves: Number(tokenReserves) / 1e9,
    initialPrice: Number(initialPrice) / 1e9,
    tokensSold: Number(tokensSold) / 1e9,
    bump,
  };
}

// Fetch audio token data
export async function fetchAudioToken(
  connection: Connection,
  mint: PublicKey
) {
  const [audioTokenPDA] = getAudioTokenPDA(mint);
  const accountInfo = await connection.getAccountInfo(audioTokenPDA);
  
  if (!accountInfo) {
    return null;
  }

  const data = accountInfo.data;
  // Skip discriminator (8 bytes)
  let offset = 8;
  
  const authority = new PublicKey(data.slice(offset, offset + 32));
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

  // Read audio URI
  const audioUriLen = data.readUInt32LE(offset);
  offset += 4;
  const audioUri = data.slice(offset, offset + audioUriLen).toString("utf-8");
  offset += audioUriLen;

  const mintPubkey = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const totalSupply = data.readBigUInt64LE(offset);
  offset += 8;

  const createdAt = data.readBigInt64LE(offset);
  offset += 8;

  const bump = data.readUInt8(offset);

  return {
    authority: authority.toString(),
    name,
    symbol,
    audioUri,
    mint: mintPubkey.toString(),
    totalSupply: Number(totalSupply) / 1e9,
    createdAt: Number(createdAt) * 1000,
    bump,
  };
}

// Calculate buy price based on constant product formula
export function calculateBuyPrice(
  tokenAmount: number,
  solReserves: number,
  tokenReserves: number
): number {
  if (tokenReserves <= tokenAmount) {
    return Infinity;
  }
  
  const k = solReserves * tokenReserves;
  const newTokenReserves = tokenReserves - tokenAmount;
  const newSolReserves = k / newTokenReserves;
  const solNeeded = newSolReserves - solReserves;
  const platformFee = solNeeded * PLATFORM_FEE_PERCENT;
  
  return solNeeded + platformFee;
}

// Calculate sell return based on constant product formula
export function calculateSellReturn(
  tokenAmount: number,
  solReserves: number,
  tokenReserves: number
): number {
  const k = solReserves * tokenReserves;
  const newTokenReserves = tokenReserves + tokenAmount;
  const newSolReserves = k / newTokenReserves;
  const solToReturn = solReserves - newSolReserves;
  const sellFee = solToReturn * PLATFORM_FEE_PERCENT;
  
  return solToReturn - sellFee;
}
