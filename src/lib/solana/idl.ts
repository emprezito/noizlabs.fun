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

// Full IDL JSON from the deployed program
export const IDL = {
  "address": "9m8ApaLxscUk6VhsuN12imf6ZvuCqPt42uDJMA1eRe7Y",
  "metadata": {
    "name": "audio_token_platform",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "create_audio_token",
      "docs": ["Create audio token with bonding curve and Metaplex metadata"],
      "discriminator": [166, 116, 242, 47, 197, 111, 202, 240],
      "accounts": [
        { "name": "token_config", "writable": true },
        { "name": "lp_account", "writable": true },
        { "name": "mint", "writable": true, "signer": true },
        { "name": "reserve_token_account", "writable": true },
        { "name": "metadata_account", "writable": true },
        { "name": "creator", "writable": true, "signer": true },
        { "name": "token_metadata_program" },
        { "name": "platform_fee_account", "writable": true },
        { "name": "system_program" },
        { "name": "token_program" },
        { "name": "associated_token_program" },
        { "name": "rent" }
      ],
      "args": [
        { "name": "name", "type": "string" },
        { "name": "symbol", "type": "string" },
        { "name": "metadata_uri", "type": "string" },
        { "name": "total_supply", "type": "u64" }
      ]
    },
    {
      "name": "buy_tokens",
      "docs": ["Buy tokens from the bonding curve (AMM-style)"],
      "discriminator": [189, 21, 230, 133, 247, 2, 110, 42],
      "accounts": [
        { "name": "token_config", "writable": true },
        { "name": "mint", "writable": true },
        { "name": "reserve_token_account", "writable": true },
        { "name": "buyer_token_account", "writable": true },
        { "name": "buyer", "writable": true, "signer": true },
        { "name": "platform_fee_account", "writable": true },
        { "name": "system_program" },
        { "name": "token_program" },
        { "name": "associated_token_program" }
      ],
      "args": [
        { "name": "sol_amount", "type": "u64" },
        { "name": "min_tokens_out", "type": "u64" }
      ]
    },
    {
      "name": "sell_tokens",
      "docs": ["Sell tokens back to bonding curve"],
      "discriminator": [114, 242, 25, 12, 62, 126, 92, 2],
      "accounts": [
        { "name": "token_config", "writable": true },
        { "name": "lp_account" },
        { "name": "mint", "writable": true },
        { "name": "reserve_token_account", "writable": true },
        { "name": "seller_token_account", "writable": true },
        { "name": "seller", "writable": true, "signer": true },
        { "name": "platform_fee_account", "writable": true },
        { "name": "token_program" }
      ],
      "args": [
        { "name": "token_amount", "type": "u64" },
        { "name": "min_sol_out", "type": "u64" }
      ]
    },
    {
      "name": "add_liquidity",
      "docs": ["Add liquidity to an existing token"],
      "discriminator": [181, 157, 89, 67, 143, 182, 52, 72],
      "accounts": [
        { "name": "token_config", "writable": true },
        { "name": "lp_account", "writable": true },
        { "name": "mint", "writable": true },
        { "name": "reserve_token_account", "writable": true },
        { "name": "provider_token_account", "writable": true },
        { "name": "lp_provider", "writable": true, "signer": true },
        { "name": "token_program" },
        { "name": "system_program" }
      ],
      "args": [
        { "name": "sol_amount", "type": "u64" },
        { "name": "token_amount", "type": "u64" }
      ]
    },
    {
      "name": "remove_liquidity",
      "docs": ["Remove liquidity from an existing token"],
      "discriminator": [80, 85, 209, 72, 24, 206, 177, 108],
      "accounts": [
        { "name": "token_config", "writable": true },
        { "name": "lp_account", "writable": true },
        { "name": "mint", "writable": true },
        { "name": "reserve_token_account", "writable": true },
        { "name": "provider_token_account", "writable": true },
        { "name": "lp_provider", "writable": true, "signer": true },
        { "name": "token_program" },
        { "name": "associated_token_program" },
        { "name": "system_program" }
      ],
      "args": [
        { "name": "lp_share", "type": "u64" }
      ]
    }
  ],
  "accounts": [
    { "name": "TokenConfig", "discriminator": [147, 160, 81, 85, 44, 209, 94, 37] },
    { "name": "LpAccount", "discriminator": [23, 183, 248, 55, 96, 216, 172, 96] }
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
          { "name": "metadata_uri", "type": "string" },
          { "name": "total_supply", "type": "u64" },
          { "name": "initial_supply", "type": "u64" },
          { "name": "sol_reserves", "type": "u64" },
          { "name": "token_reserves", "type": "u64" },
          { "name": "tokens_sold", "type": "u64" },
          { "name": "total_volume", "type": "u64" },
          { "name": "created_at", "type": "i64" },
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
