// Audio Token Platform IDL for Anchor 0.30.1
export const PROGRAM_ID = "9m8ApaLxscUk6VhsuN12imf6ZvuCqPt42uDJMA1eRe7Y";

// PDA seeds - matching the new program
export const TOKEN_CONFIG_SEED = "token_config";
export const LP_ACCOUNT_SEED = "lp_account";

// Legacy exports for backward compatibility
export const AUDIO_TOKEN_SEED = TOKEN_CONFIG_SEED;
export const BONDING_CURVE_SEED = TOKEN_CONFIG_SEED;

// Platform fee account - receives 0.25% trading fees
export const PLATFORM_FEE_ACCOUNT = "GVHjPM3DfTnSFLMx72RcCCAViqWWsJ6ENKXRq7nWedEp";

// Simplified IDL for @coral-xyz/anchor SDK - only instructions needed for transaction building
export const IDL = {
  "version": "0.1.0",
  "name": "audio_token_platform",
  "address": "9m8ApaLxscUk6VhsuN12imf6ZvuCqPt42uDJMA1eRe7Y",
  "instructions": [
    {
      "name": "createAudioToken",
      "accounts": [
        { "name": "tokenConfig", "isMut": true, "isSigner": false },
        { "name": "lpAccount", "isMut": true, "isSigner": false },
        { "name": "mint", "isMut": true, "isSigner": true },
        { "name": "reserveTokenAccount", "isMut": true, "isSigner": false },
        { "name": "metadataAccount", "isMut": true, "isSigner": false },
        { "name": "creator", "isMut": true, "isSigner": true },
        { "name": "tokenMetadataProgram", "isMut": false, "isSigner": false },
        { "name": "platformFeeAccount", "isMut": true, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "associatedTokenProgram", "isMut": false, "isSigner": false },
        { "name": "rent", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "name", "type": "string" },
        { "name": "symbol", "type": "string" },
        { "name": "metadataUri", "type": "string" },
        { "name": "totalSupply", "type": "u64" }
      ]
    },
    {
      "name": "buyTokens",
      "accounts": [
        { "name": "tokenConfig", "isMut": true, "isSigner": false },
        { "name": "mint", "isMut": true, "isSigner": false },
        { "name": "reserveTokenAccount", "isMut": true, "isSigner": false },
        { "name": "buyerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "buyer", "isMut": true, "isSigner": true },
        { "name": "platformFeeAccount", "isMut": true, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "associatedTokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "solAmount", "type": "u64" },
        { "name": "minTokensOut", "type": "u64" }
      ]
    },
    {
      "name": "sellTokens",
      "accounts": [
        { "name": "tokenConfig", "isMut": true, "isSigner": false },
        { "name": "lpAccount", "isMut": false, "isSigner": false },
        { "name": "mint", "isMut": true, "isSigner": false },
        { "name": "reserveTokenAccount", "isMut": true, "isSigner": false },
        { "name": "sellerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "seller", "isMut": true, "isSigner": true },
        { "name": "platformFeeAccount", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "tokenAmount", "type": "u64" },
        { "name": "minSolOut", "type": "u64" }
      ]
    },
    {
      "name": "addLiquidity",
      "accounts": [
        { "name": "tokenConfig", "isMut": true, "isSigner": false },
        { "name": "lpAccount", "isMut": true, "isSigner": false },
        { "name": "mint", "isMut": true, "isSigner": false },
        { "name": "reserveTokenAccount", "isMut": true, "isSigner": false },
        { "name": "providerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "lpProvider", "isMut": true, "isSigner": true },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "solAmount", "type": "u64" },
        { "name": "tokenAmount", "type": "u64" }
      ]
    },
    {
      "name": "removeLiquidity",
      "accounts": [
        { "name": "tokenConfig", "isMut": true, "isSigner": false },
        { "name": "lpAccount", "isMut": true, "isSigner": false },
        { "name": "mint", "isMut": true, "isSigner": false },
        { "name": "reserveTokenAccount", "isMut": true, "isSigner": false },
        { "name": "providerTokenAccount", "isMut": true, "isSigner": false },
        { "name": "lpProvider", "isMut": true, "isSigner": true },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "associatedTokenProgram", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "lpShare", "type": "u64" }
      ]
    }
  ],
  "accounts": [],
  "errors": [
    { "code": 6000, "name": "InvalidAmount", "msg": "Invalid amount" },
    { "code": 6001, "name": "InvalidInput", "msg": "Invalid input" },
    { "code": 6002, "name": "MathOverflow", "msg": "Math overflow" },
    { "code": 6003, "name": "InsufficientLiquidity", "msg": "Insufficient liquidity" },
    { "code": 6004, "name": "SlippageExceeded", "msg": "Slippage exceeded" },
    { "code": 6005, "name": "InvalidPriceRatio", "msg": "Invalid price ratio" }
  ]
} as const;

// TypeScript types for the program
export interface TokenConfig {
  mint: string;
  creator: string;
  name: string;
  symbol: string;
  metadataUri: string;
  totalSupply: number;
  initialSupply: number;
  solReserves: number;
  tokenReserves: number;
  tokensSold: number;
  totalVolume: number;
  createdAt: number;
  bump: number;
}

export interface LpAccount {
  mint: string;
  liquidity: number;
  timestamp: number;
  bump: number;
}

// Legacy type aliases for backward compatibility
export type AudioToken = TokenConfig;
export type BondingCurve = TokenConfig;
