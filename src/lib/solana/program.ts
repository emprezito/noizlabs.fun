import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { PROGRAM_ID, AUDIO_TOKEN_SEED, BONDING_CURVE_SEED, PLATFORM_FEE_ACCOUNT } from "./idl";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const platformFeeAccount = new PublicKey(PLATFORM_FEE_ACCOUNT);

export const programId = new PublicKey(PROGRAM_ID);

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

export async function getMetadataAddress(mint: PublicKey): Promise<PublicKey> {
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

// Anchor instruction discriminators from IDL
// create_audio_token_with_curve: [255, 206, 35, 219, 45, 31, 125, 182]
const CREATE_AUDIO_TOKEN_WITH_CURVE_DISCRIMINATOR = Buffer.from([
  0xff, 0xce, 0x23, 0xdb, 0x2d, 0x1f, 0x7d, 0xb6
]);
// buy_tokens: [189, 21, 230, 133, 247, 2, 110, 42]
const BUY_TOKENS_DISCRIMINATOR = Buffer.from([
  0xbd, 0x15, 0xe6, 0x85, 0xf7, 0x02, 0x6e, 0x2a
]);
// sell_tokens: [114, 242, 25, 12, 62, 126, 92, 2]
const SELL_TOKENS_DISCRIMINATOR = Buffer.from([
  0x72, 0xf2, 0x19, 0x0c, 0x3e, 0x7e, 0x5c, 0x02
]);

// Create instruction data
function encodeString(str: string): Buffer {
  const strBuffer = Buffer.from(str, "utf-8");
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32LE(strBuffer.length, 0);
  return Buffer.concat([lenBuffer, strBuffer]);
}

function encodeU64(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value, 0);
  return buffer;
}

export interface CreateAudioTokenParams {
  name: string;
  symbol: string;
  metadataUri: string; // IPFS URI for metadata
  totalSupply: bigint;
  initialPrice: bigint;
}

export async function createAudioTokenInstruction(
  connection: Connection,
  creator: PublicKey,
  mint: PublicKey,
  params: CreateAudioTokenParams
): Promise<TransactionInstruction> {
  const [audioTokenPDA] = getAudioTokenPDA(mint);
  const [bondingCurvePDA] = getBondingCurvePDA(mint);
  const metadataAddress = await getMetadataAddress(mint);
  const curveTokenAccount = await getAssociatedTokenAddress(mint, bondingCurvePDA, true);

  // Encode instruction data matching Anchor's format:
  // discriminator + name + symbol + metadata_uri + total_supply + initial_price
  const data = Buffer.concat([
    CREATE_AUDIO_TOKEN_WITH_CURVE_DISCRIMINATOR,
    encodeString(params.name),
    encodeString(params.symbol),
    encodeString(params.metadataUri),
    encodeU64(params.totalSupply),
    encodeU64(params.initialPrice),
  ]);

  // Account order must match CreateAudioTokenWithCurve struct
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: audioTokenPDA, isSigner: false, isWritable: true },
      { pubkey: bondingCurvePDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: true, isWritable: true },
      { pubkey: curveTokenAccount, isSigner: false, isWritable: true },
      { pubkey: metadataAddress, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export async function buyTokensInstruction(
  connection: Connection,
  buyer: PublicKey,
  mint: PublicKey,
  amount: bigint
): Promise<TransactionInstruction> {
  const [bondingCurvePDA] = getBondingCurvePDA(mint);
  const curveTokenAccount = await getAssociatedTokenAddress(mint, bondingCurvePDA, true);
  const buyerTokenAccount = await getAssociatedTokenAddress(mint, buyer);

  const data = Buffer.concat([
    BUY_TOKENS_DISCRIMINATOR,
    encodeU64(amount),
  ]);

  // Account order must match BuyTokens struct
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: bondingCurvePDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: curveTokenAccount, isSigner: false, isWritable: true },
      { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: platformFeeAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export async function sellTokensInstruction(
  connection: Connection,
  seller: PublicKey,
  mint: PublicKey,
  amount: bigint
): Promise<TransactionInstruction> {
  const [bondingCurvePDA] = getBondingCurvePDA(mint);
  const curveTokenAccount = await getAssociatedTokenAddress(mint, bondingCurvePDA, true);
  const sellerTokenAccount = await getAssociatedTokenAddress(mint, seller);

  const data = Buffer.concat([
    SELL_TOKENS_DISCRIMINATOR,
    encodeU64(amount),
  ]);

  // Account order must match SellTokens struct
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: bondingCurvePDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: curveTokenAccount, isSigner: false, isWritable: true },
      { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: platformFeeAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
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

  // Read audio URI (metadata_uri in Rust)
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
    createdAt: Number(createdAt) * 1000, // Convert to milliseconds
    bump,
  };
}

// Platform fee percentage (0.25%)
export const PLATFORM_FEE_PERCENT = 0.0025;

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
  const platformFee = solNeeded * PLATFORM_FEE_PERCENT; // 0.25% fee
  
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
  const sellFee = solToReturn * PLATFORM_FEE_PERCENT; // 0.25% fee
  
  return solToReturn - sellFee;
}
