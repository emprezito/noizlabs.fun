import { 
  PublicKey, 
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY 
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID, PLATFORM_FEE_ACCOUNT } from './idl';

// Simple SHA256 using Web Crypto API
async function sha256(message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

// Compute Anchor instruction discriminator: first 8 bytes of sha256("global:<instruction_name>")
async function getDiscriminator(instructionName: string): Promise<Buffer> {
  const preimage = `global:${instructionName}`;
  const hash = await sha256(preimage);
  return Buffer.from(hash.slice(0, 8));
}

// Borsh serialization helpers
function serializeString(str: string): Buffer {
  const strBytes = Buffer.from(str, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(strBytes.length, 0);
  return Buffer.concat([lenBuf, strBytes]);
}

function serializeU64(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value, 0);
  return buf;
}

export interface CreateAudioTokenAccounts {
  tokenConfig: PublicKey;
  lpAccount: PublicKey;
  mint: PublicKey;
  reserveTokenAccount: PublicKey;
  metadataAccount: PublicKey;
  creator: PublicKey;
  tokenMetadataProgram: PublicKey;
}

export interface CreateAudioTokenArgs {
  name: string;
  symbol: string;
  metadataUri: string;
  totalSupply: bigint;
}

export async function createAudioTokenInstruction(
  accounts: CreateAudioTokenAccounts,
  args: CreateAudioTokenArgs
): Promise<TransactionInstruction> {
  const discriminator = await getDiscriminator('create_audio_token');
  
  // Serialize args in order: name, symbol, metadata_uri, total_supply
  const data = Buffer.concat([
    discriminator,
    serializeString(args.name),
    serializeString(args.symbol),
    serializeString(args.metadataUri),
    serializeU64(args.totalSupply)
  ]);

  const programId = new PublicKey(PROGRAM_ID);
  const platformFeeAccount = new PublicKey(PLATFORM_FEE_ACCOUNT);

  // Account order must match the Rust program's context struct exactly
  const keys = [
    { pubkey: accounts.tokenConfig, isSigner: false, isWritable: true },
    { pubkey: accounts.lpAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: true, isWritable: true },
    { pubkey: accounts.reserveTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.metadataAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.creator, isSigner: true, isWritable: true },
    { pubkey: accounts.tokenMetadataProgram, isSigner: false, isWritable: false },
    { pubkey: platformFeeAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface BuyTokensAccounts {
  tokenConfig: PublicKey;
  mint: PublicKey;
  reserveTokenAccount: PublicKey;
  buyerTokenAccount: PublicKey;
  buyer: PublicKey;
}

export interface BuyTokensArgs {
  solAmount: bigint;
  minTokensOut: bigint;
}

export async function buyTokensInstruction(
  accounts: BuyTokensAccounts,
  args: BuyTokensArgs
): Promise<TransactionInstruction> {
  const discriminator = await getDiscriminator('buy_tokens');
  
  const data = Buffer.concat([
    discriminator,
    serializeU64(args.solAmount),
    serializeU64(args.minTokensOut)
  ]);

  const programId = new PublicKey(PROGRAM_ID);
  const platformFeeAccount = new PublicKey(PLATFORM_FEE_ACCOUNT);

  const keys = [
    { pubkey: accounts.tokenConfig, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: false, isWritable: true },
    { pubkey: accounts.reserveTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.buyerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.buyer, isSigner: true, isWritable: true },
    { pubkey: platformFeeAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface SellTokensAccounts {
  tokenConfig: PublicKey;
  lpAccount: PublicKey;
  mint: PublicKey;
  reserveTokenAccount: PublicKey;
  sellerTokenAccount: PublicKey;
  seller: PublicKey;
}

export interface SellTokensArgs {
  tokenAmount: bigint;
  minSolOut: bigint;
}

export async function sellTokensInstruction(
  accounts: SellTokensAccounts,
  args: SellTokensArgs
): Promise<TransactionInstruction> {
  const discriminator = await getDiscriminator('sell_tokens');
  
  const data = Buffer.concat([
    discriminator,
    serializeU64(args.tokenAmount),
    serializeU64(args.minSolOut)
  ]);

  const programId = new PublicKey(PROGRAM_ID);
  const platformFeeAccount = new PublicKey(PLATFORM_FEE_ACCOUNT);

  const keys = [
    { pubkey: accounts.tokenConfig, isSigner: false, isWritable: true },
    { pubkey: accounts.lpAccount, isSigner: false, isWritable: false },
    { pubkey: accounts.mint, isSigner: false, isWritable: true },
    { pubkey: accounts.reserveTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.sellerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.seller, isSigner: true, isWritable: true },
    { pubkey: platformFeeAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}
