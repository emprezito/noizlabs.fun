// Audio Token Platform IDL (derived from Rust program)
export const PROGRAM_ID = "8m6HBVw1n2q6E3YWTkqTE5KyNLhALdfGY7vcXQGMG6Uz";

export interface AudioToken {
  authority: string;
  name: string;
  symbol: string;
  audioUri: string;
  mint: string;
  totalSupply: number;
  createdAt: number;
  bump: number;
}

export interface BondingCurve {
  mint: string;
  creator: string;
  solReserves: number;
  tokenReserves: number;
  initialPrice: number;
  tokensSold: number;
  bump: number;
}

// PDA seeds
export const AUDIO_TOKEN_SEED = "audio_token";
export const BONDING_CURVE_SEED = "bonding_curve";

// Platform fee account - UPDATE THIS to your actual fee receiving wallet
export const PLATFORM_FEE_ACCOUNT = "11111111111111111111111111111111";
