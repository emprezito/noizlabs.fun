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

// Anchor 0.30.1 compatible IDL with proper type definitions
export const IDL = {
  "version": "0.1.0",
  "name": "audio_token_platform",
  "address": "9m8ApaLxscUk6VhsuN12imf6ZvuCqPt42uDJMA1eRe7Y",
  "metadata": {
    "name": "audio_token_platform",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "createAudioToken",
      "discriminator": [0, 0, 0, 0, 0, 0, 0, 0],
      "accounts": [
        { "name": "tokenConfig", "writable": true, "pda": { "seeds": [{ "kind": "const", "value": [116, 111, 107, 101, 110, 95, 99, 111, 110, 102, 105, 103] }, { "kind": "account", "path": "mint" }] } },
        { "name": "lpAccount", "writable": true, "pda": { "seeds": [{ "kind": "const", "value": [108, 112, 95, 97, 99, 99, 111, 117, 110, 116] }, { "kind": "account", "path": "mint" }] } },
        { "name": "mint", "writable": true, "signer": true },
        { "name": "reserveTokenAccount", "writable": true },
        { "name": "metadataAccount", "writable": true },
        { "name": "creator", "writable": true, "signer": true },
        { "name": "tokenMetadataProgram" },
        { "name": "platformFeeAccount", "writable": true },
        { "name": "systemProgram" },
        { "name": "tokenProgram" },
        { "name": "associatedTokenProgram" },
        { "name": "rent" }
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
      "discriminator": [0, 0, 0, 0, 0, 0, 0, 1],
      "accounts": [
        { "name": "tokenConfig", "writable": true },
        { "name": "mint", "writable": true },
        { "name": "reserveTokenAccount", "writable": true },
        { "name": "buyerTokenAccount", "writable": true },
        { "name": "buyer", "writable": true, "signer": true },
        { "name": "platformFeeAccount", "writable": true },
        { "name": "systemProgram" },
        { "name": "tokenProgram" },
        { "name": "associatedTokenProgram" }
      ],
      "args": [
        { "name": "solAmount", "type": "u64" },
        { "name": "minTokensOut", "type": "u64" }
      ]
    },
    {
      "name": "sellTokens",
      "discriminator": [0, 0, 0, 0, 0, 0, 0, 2],
      "accounts": [
        { "name": "tokenConfig", "writable": true },
        { "name": "lpAccount" },
        { "name": "mint", "writable": true },
        { "name": "reserveTokenAccount", "writable": true },
        { "name": "sellerTokenAccount", "writable": true },
        { "name": "seller", "writable": true, "signer": true },
        { "name": "platformFeeAccount", "writable": true },
        { "name": "tokenProgram" }
      ],
      "args": [
        { "name": "tokenAmount", "type": "u64" },
        { "name": "minSolOut", "type": "u64" }
      ]
    },
    {
      "name": "addLiquidity",
      "discriminator": [0, 0, 0, 0, 0, 0, 0, 3],
      "accounts": [
        { "name": "tokenConfig", "writable": true },
        { "name": "lpAccount", "writable": true },
        { "name": "mint", "writable": true },
        { "name": "reserveTokenAccount", "writable": true },
        { "name": "providerTokenAccount", "writable": true },
        { "name": "lpProvider", "writable": true, "signer": true },
        { "name": "tokenProgram" },
        { "name": "systemProgram" }
      ],
      "args": [
        { "name": "solAmount", "type": "u64" },
        { "name": "tokenAmount", "type": "u64" }
      ]
    },
    {
      "name": "removeLiquidity",
      "discriminator": [0, 0, 0, 0, 0, 0, 0, 4],
      "accounts": [
        { "name": "tokenConfig", "writable": true },
        { "name": "lpAccount", "writable": true },
        { "name": "mint", "writable": true },
        { "name": "reserveTokenAccount", "writable": true },
        { "name": "providerTokenAccount", "writable": true },
        { "name": "lpProvider", "writable": true, "signer": true },
        { "name": "tokenProgram" },
        { "name": "associatedTokenProgram" },
        { "name": "systemProgram" }
      ],
      "args": [
        { "name": "lpShare", "type": "u64" }
      ]
    }
  ],
  "accounts": [
    {
      "name": "TokenConfig",
      "discriminator": [0, 0, 0, 0, 0, 0, 0, 0]
    },
    {
      "name": "LpAccount",
      "discriminator": [0, 0, 0, 0, 0, 0, 0, 1]
    }
  ],
  "errors": [
    { "code": 6000, "name": "InvalidAmount", "msg": "Invalid amount" },
    { "code": 6001, "name": "InvalidInput", "msg": "Invalid input" },
    { "code": 6002, "name": "MathOverflow", "msg": "Math overflow" },
    { "code": 6003, "name": "InsufficientLiquidity", "msg": "Insufficient liquidity" },
    { "code": 6004, "name": "SlippageExceeded", "msg": "Slippage exceeded" },
    { "code": 6005, "name": "InvalidPriceRatio", "msg": "Invalid price ratio" }
  ],
  "types": [
    {
      "name": "TokenConfig",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "mint", "type": "pubkey" },
          { "name": "creator", "type": "pubkey" },
          { "name": "name", "type": "string" },
          { "name": "symbol", "type": "string" },
          { "name": "metadataUri", "type": "string" },
          { "name": "totalSupply", "type": "u64" },
          { "name": "initialSupply", "type": "u64" },
          { "name": "solReserves", "type": "u64" },
          { "name": "tokenReserves", "type": "u64" },
          { "name": "tokensSold", "type": "u64" },
          { "name": "totalVolume", "type": "u64" },
          { "name": "createdAt", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "LpAccount",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "mint", "type": "pubkey" },
          { "name": "liquidity", "type": "u64" },
          { "name": "timestamp", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
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
