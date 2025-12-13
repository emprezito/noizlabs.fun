import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
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

// Platform fee wallet
const PLATFORM_FEE_WALLET = new PublicKey(
  "GVHjPM3DfTnSFLMx72RcCCAViqWWsJ6ENKXRq7nWedEp"
);

// Platform creation fee: 0.02 SOL
const CREATION_FEE = 0.02 * LAMPORTS_PER_SOL;

// Pump.fun style initial market cap: $5k at ~$200/SOL = 25 SOL worth of virtual reserves
// Initial virtual SOL reserves for bonding curve pricing
export const INITIAL_VIRTUAL_SOL_RESERVES = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL
export const INITIAL_TOKEN_RESERVES = BigInt(800_000_000 * 1e9); // 800M tokens (80% of 1B for bonding curve)
export const CREATOR_ALLOCATION = BigInt(200_000_000 * 1e9); // 200M tokens (20% to creator for rewards/airdrops)

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
 * Creates a new SPL token with Metaplex metadata using standard, proven Solana programs.
 * This approach is more reliable than custom Anchor programs.
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

  // 3. Create creator's token account (for receiving creator allocation)
  tx.add(
    createAssociatedTokenAccountInstruction(
      creator, // payer
      creatorTokenAccount, // associated token account
      creator, // owner
      mint // mint
    )
  );

  // 4. Mint full supply to creator's wallet
  // The bonding curve reserves are tracked virtually in the database
  // Creator gets 20% allocation, 80% is "virtual" for the bonding curve
  tx.add(
    createMintToInstruction(
      mint,
      creatorTokenAccount,
      creator, // mint authority
      CREATOR_ALLOCATION, // 200M tokens (20% of 1B)
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
      toPubkey: PLATFORM_FEE_WALLET,
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
