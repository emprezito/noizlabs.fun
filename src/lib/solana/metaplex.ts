import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { 
  mplTokenMetadata,
  createNft,
  fetchDigitalAsset,
} from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, percentAmount } from "@metaplex-foundation/umi";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, clusterApiUrl } from "@solana/web3.js";

// Badge metadata for NFTs
export const BADGE_METADATA = {
  newcomer: {
    name: "NoizLabs Newcomer Badge",
    symbol: "NOIZ-NEW",
    description: "Awarded to new members of the NoizLabs community. Welcome to the sound revolution!",
    image: "https://arweave.net/placeholder-newcomer", // Will be replaced with actual IPFS
    attributes: [
      { trait_type: "Badge Level", value: "Newcomer" },
      { trait_type: "Points Required", value: "0" },
      { trait_type: "Rarity", value: "Common" },
    ],
  },
  explorer: {
    name: "NoizLabs Explorer Badge",
    symbol: "NOIZ-EXP",
    description: "Awarded to explorers who have earned 500+ points. Keep discovering new sounds!",
    image: "https://arweave.net/placeholder-explorer",
    attributes: [
      { trait_type: "Badge Level", value: "Explorer" },
      { trait_type: "Points Required", value: "500" },
      { trait_type: "Rarity", value: "Uncommon" },
    ],
  },
  enthusiast: {
    name: "NoizLabs Enthusiast Badge",
    symbol: "NOIZ-ENT",
    description: "Awarded to enthusiasts who have earned 2000+ points. Your passion for audio is inspiring!",
    image: "https://arweave.net/placeholder-enthusiast",
    attributes: [
      { trait_type: "Badge Level", value: "Enthusiast" },
      { trait_type: "Points Required", value: "2000" },
      { trait_type: "Rarity", value: "Rare" },
    ],
  },
  champion: {
    name: "NoizLabs Champion Badge",
    symbol: "NOIZ-CHP",
    description: "Awarded to champions who have earned 5000+ points. You're a true audio champion!",
    image: "https://arweave.net/placeholder-champion",
    attributes: [
      { trait_type: "Badge Level", value: "Champion" },
      { trait_type: "Points Required", value: "5000" },
      { trait_type: "Rarity", value: "Epic" },
    ],
  },
  legend: {
    name: "NoizLabs Legend Badge",
    symbol: "NOIZ-LEG",
    description: "Awarded to legends who have earned 10000+ points. Your legacy echoes through the soundscape!",
    image: "https://arweave.net/placeholder-legend",
    attributes: [
      { trait_type: "Badge Level", value: "Legend" },
      { trait_type: "Points Required", value: "10000" },
      { trait_type: "Rarity", value: "Legendary" },
    ],
  },
  elite: {
    name: "NoizLabs Elite Badge",
    symbol: "NOIZ-ELT",
    description: "Awarded to the elite who have earned 25000+ points. You are among the greatest in NoizLabs!",
    image: "https://arweave.net/placeholder-elite",
    attributes: [
      { trait_type: "Badge Level", value: "Elite" },
      { trait_type: "Points Required", value: "25000" },
      { trait_type: "Rarity", value: "Mythic" },
    ],
  },
};

export type BadgeLevel = keyof typeof BADGE_METADATA;

interface MintBadgeResult {
  success: boolean;
  mintAddress?: string;
  error?: string;
}

export async function mintBadgeNFT(
  wallet: WalletContextState,
  connection: Connection,
  badgeLevel: BadgeLevel,
  metadataUri: string
): Promise<MintBadgeResult> {
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return { success: false, error: "Wallet not connected" };
    }

    const metadata = BADGE_METADATA[badgeLevel];
    if (!metadata) {
      return { success: false, error: "Invalid badge level" };
    }

    // Create Umi instance
    const umi = createUmi(connection.rpcEndpoint)
      .use(walletAdapterIdentity(wallet))
      .use(mplTokenMetadata());

    // Generate a new mint keypair
    const mint = generateSigner(umi);

    // Create the NFT
    const { signature } = await createNft(umi, {
      mint,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(0), // No royalties for badges
      creators: null,
      collection: null,
      uses: null,
    }).sendAndConfirm(umi);

    console.log("Badge NFT minted successfully:", mint.publicKey.toString());
    console.log("Transaction signature:", signature);

    return {
      success: true,
      mintAddress: mint.publicKey.toString(),
    };
  } catch (error: unknown) {
    console.error("Error minting badge NFT:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to mint NFT";
    return { success: false, error: errorMessage };
  }
}

// Generate metadata JSON for badge
export function generateBadgeMetadata(badgeLevel: BadgeLevel, walletAddress: string): object {
  const metadata = BADGE_METADATA[badgeLevel];
  
  return {
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.description,
    image: metadata.image,
    external_url: "https://noizlabs.io",
    attributes: [
      ...metadata.attributes,
      { trait_type: "Owner", value: walletAddress },
      { trait_type: "Minted At", value: new Date().toISOString() },
    ],
    properties: {
      files: [
        {
          uri: metadata.image,
          type: "image/png",
        },
      ],
      category: "image",
      creators: [
        {
          address: walletAddress,
          share: 100,
        },
      ],
    },
  };
}
