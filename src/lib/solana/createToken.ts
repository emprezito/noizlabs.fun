import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";

// Platform wallet - holds bonding curve tokens and receives fees
export const PLATFORM_WALLET = new PublicKey(
  "FL2wxMs6q8sR2pfypRSWUpYN7qcpA52rnLYH9WLQufUc"
);

// Platform creation fee: 0.02 SOL
const CREATION_FEE = 0.02 * LAMPORTS_PER_SOL;

// Token distribution:
// - 95% goes to platform wallet for bonding curve trades
// - 5% goes to creator
export const INITIAL_VIRTUAL_SOL_RESERVES = 25 * LAMPORTS_PER_SOL; // 25 SOL virtual reserves for $5k market cap
export const BONDING_CURVE_ALLOCATION = BigInt(950_000_000 * 1e9); // 950M tokens (95% for bonding curve)
export const CREATOR_ALLOCATION = BigInt(50_000_000 * 1e9); // 50M tokens (5% to creator)
export const TOTAL_SUPPLY = BigInt(1_000_000_000 * 1e9); // 1B total

export interface CreateTokenParams {
  name: string;
  symbol: string;
  metadataUri: string;
  totalSupply: bigint;
}

function getMetadataAddress(mint: PublicKey): PublicKey {
  const [metadataAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  return metadataAddress;
}

/**
 * Creates a new SPL token with Metaplex metadata.
 * Mints 95% to platform wallet (for bonding curve trades) and 5% to creator.
 * This enables real on-chain token transfers during trades.
 */
export async function createTokenWithMetaplex(
  connection: Connection,
  creator: PublicKey,
  mintKeypair: Keypair,
  params: CreateTokenParams
): Promise<Transaction> {
  const mint = mintKeypair.publicKey;
  const metadataAddress = getMetadataAddress(mint);
  
  // Get minimum rent for mint account
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  
  // Get associated token accounts
  const creatorTokenAccount = await getAssociatedTokenAddress(mint, creator);
  const platformTokenAccount = await getAssociatedTokenAddress(mint, PLATFORM_WALLET);

  console.log("Creating token with real on-chain distribution:", {
    mint: mint.toString(),
    metadataAddress: metadataAddress.toString(),
    creatorTokenAccount: creatorTokenAccount.toString(),
    platformTokenAccount: platformTokenAccount.toString(),
    creator: creator.toString(),
    platformWallet: PLATFORM_WALLET.toString(),
    creatorAllocation: CREATOR_ALLOCATION.toString(),
    bondingCurveAllocation: BONDING_CURVE_ALLOCATION.toString(),
  });

  const tx = new Transaction();

  // 1. Create mint account
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: creator,
      newAccountPubkey: mint,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  // 2. Initialize mint (9 decimals, creator is mint authority)
  tx.add(
    createInitializeMintInstruction(
      mint,
      9, // decimals
      creator, // mint authority
      creator, // freeze authority
      TOKEN_PROGRAM_ID
    )
  );

  // 3. Create creator's token account
  tx.add(
    createAssociatedTokenAccountInstruction(
      creator, // payer
      creatorTokenAccount, // associated token account
      creator, // owner
      mint // mint
    )
  );

  // 4. Create platform wallet's token account (for bonding curve)
  tx.add(
    createAssociatedTokenAccountInstruction(
      creator, // payer
      platformTokenAccount, // associated token account
      PLATFORM_WALLET, // owner
      mint // mint
    )
  );

  // 5. Mint 5% to creator's wallet
  tx.add(
    createMintToInstruction(
      mint,
      creatorTokenAccount,
      creator, // mint authority
      CREATOR_ALLOCATION,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 6. Mint 95% to platform wallet (for bonding curve trades)
  tx.add(
    createMintToInstruction(
      mint,
      platformTokenAccount,
      creator, // mint authority
      BONDING_CURVE_ALLOCATION,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 7. Create Metaplex metadata
  const metadataInstruction = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataAddress,
      mint: mint,
      mintAuthority: creator,
      payer: creator,
      updateAuthority: creator,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: params.name.slice(0, 32),
          symbol: params.symbol.slice(0, 10),
          uri: params.metadataUri.slice(0, 200),
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      },
    }
  );
  tx.add(metadataInstruction);

  // 8. Transfer platform fee
  tx.add(
    SystemProgram.transfer({
      fromPubkey: creator,
      toPubkey: PLATFORM_WALLET,
      lamports: CREATION_FEE,
    })
  );

  // Set transaction properties
  tx.feePayer = creator;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  // Partially sign with mint keypair
  tx.partialSign(mintKeypair);

  return tx;
}
