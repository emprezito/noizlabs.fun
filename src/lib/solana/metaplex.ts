// Badge metadata for NFTs - browser-safe version
// NFT minting is handled server-side via edge functions

export const BADGE_METADATA = {
  newcomer: {
    name: "NoizLabs Newcomer Badge",
    symbol: "NOIZ-NEW",
    description: "Awarded to new members of the NoizLabs community. Welcome to the sound revolution!",
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
    attributes: [
      { trait_type: "Badge Level", value: "Elite" },
      { trait_type: "Points Required", value: "25000" },
      { trait_type: "Rarity", value: "Mythic" },
    ],
  },
};

export type BadgeLevel = keyof typeof BADGE_METADATA;
