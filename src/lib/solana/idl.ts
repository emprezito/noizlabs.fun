// Audio Token Platform IDL (derived from Rust program)
export const PROGRAM_ID = "BdLFRJjL3SU84L783JgTeDyyuNgQCqa5KD4148f5UX2q";

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
