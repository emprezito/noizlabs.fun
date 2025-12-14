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

// Platform wallet - receives fees
const PLATFORM_WALLET = new PublicKey(
  "FL2wxMs6q8sR2pfypRSWUpYN7qcpA52rnLYH9WLQufUc"
);

// Platform creation fee: 0.02 SOL
const CREATION_FEE = 0.02 * LAMPORTS_PER_SOL;

// Pump.fun style initial market cap: $5k at ~$200/SOL
// Bonding curve reserves tracked in database (virtual), only 5% minted to creator
export const INITIAL_VIRTUAL_SOL_RESERVES = 25 * LAMPORTS_PER_SOL; // 25 SOL virtual reserves for $5k market cap
export const INITIAL_TOKEN_RESERVES = BigInt(950_000_000 * 1e9); // 950M tokens (95% for bonding curve - virtual)
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
 * Only mints 5% to creator - the 95% bonding curve reserves are tracked virtually in database.
 * This approach avoids issues with platform wallet token accounts.
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
  
  // Get creator's associated token account
  const creatorTokenAccount = await getAssociatedTokenAddress(mint, creator);

  console.log("Creating token with standard SPL Token + Metaplex:", {
    mint: mint.toString(),
    metadataAddress: metadataAddress.toString(),
    creatorTokenAccount: creatorTokenAccount.toString(),
    creator: creator.toString(),
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

  // 4. Mint 5% to creator's wallet
  // The 95% bonding curve reserves are tracked virtually in the database
  tx.add(
    createMintToInstruction(
      mint,
      creatorTokenAccount,
      creator, // mint authority
      CREATOR_ALLOCATION, // 50M tokens (5% of 1B)
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 5. Create Metaplex metadata
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

  // 6. Transfer platform fee
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
