// Audio Token Platform IDL for Anchor 0.30.1
export const PROGRAM_ID = "BdLFRJjL3SU84L783JgTeDyyuNgQCqa5KD4148f5UX2q";

// PDA seeds
export const AUDIO_TOKEN_SEED = "audio_token";
export const BONDING_CURVE_SEED = "bonding_curve";

// Platform fee account - receives 0.25% trading fees
export const PLATFORM_FEE_ACCOUNT = "GVHjPM3DfTnSFLMx72RcCCAViqWWsJ6ENKXRq7nWedEp";

// Full IDL JSON from the deployed program
export const IDL = {
  "address": "BdLFRJjL3SU84L783JgTeDyyuNgQCqa5KD4148f5UX2q",
  "metadata": {
    "name": "audio_token_platform",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "buy_tokens",
      "docs": ["Buy tokens from the bonding curve"],
      "discriminator": [189, 21, 230, 133, 247, 2, 110, 42],
      "accounts": [
        { "name": "bonding_curve", "writable": true },
        { "name": "mint", "writable": true },
        { "name": "curve_token_account", "writable": true },
        { "name": "buyer_token_account", "writable": true },
        { "name": "buyer", "writable": true, "signer": true },
        { "name": "platform_fee_account", "writable": true },
        { "name": "system_program" },
        { "name": "token_program" },
        { "name": "associated_token_program" },
        { "name": "rent" }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "create_audio_token_with_curve",
      "docs": ["Create audio token with bonding curve AND Metaplex metadata"],
      "discriminator": [255, 206, 35, 219, 45, 31, 125, 182],
      "accounts": [
        { "name": "audio_token", "writable": true },
        { "name": "bonding_curve", "writable": true },
        { "name": "mint", "writable": true, "signer": true },
        { "name": "curve_token_account", "writable": true },
        { "name": "metadata_account", "writable": true },
        { "name": "creator", "writable": true, "signer": true },
        { "name": "token_metadata_program" },
        { "name": "system_program" },
        { "name": "token_program" },
        { "name": "associated_token_program" },
        { "name": "rent" }
      ],
      "args": [
        { "name": "name", "type": "string" },
        { "name": "symbol", "type": "string" },
        { "name": "metadata_uri", "type": "string" },
        { "name": "total_supply", "type": "u64" },
        { "name": "initial_price", "type": "u64" }
      ]
    },
    {
      "name": "sell_tokens",
      "docs": ["Sell tokens back to bonding curve"],
      "discriminator": [114, 242, 25, 12, 62, 126, 92, 2],
      "accounts": [
        { "name": "bonding_curve", "writable": true },
        { "name": "mint", "writable": true },
        { "name": "curve_token_account", "writable": true },
        { "name": "seller_token_account", "writable": true },
        { "name": "seller", "writable": true, "signer": true },
        { "name": "platform_fee_account", "writable": true },
        { "name": "token_program" }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    }
  ],
  "accounts": [
    { "name": "AudioToken", "discriminator": [147, 160, 81, 85, 44, 209, 94, 37] },
    { "name": "BondingCurve", "discriminator": [23, 183, 248, 55, 96, 216, 172, 96] }
  ],
  "errors": [
    { "code": 6000, "name": "InvalidAmount", "msg": "Invalid amount" },
    { "code": 6001, "name": "InsufficientTokens", "msg": "Insufficient tokens in curve" },
    { "code": 6002, "name": "InsufficientSoldTokens", "msg": "Insufficient sold tokens" },
    { "code": 6003, "name": "MathOverFlow", "msg": "Math overflow" },
    { "code": 6004, "name": "InsufficientLiquidity", "msg": "Insufficient liquidity" }
  ],
  "types": [
    {
      "name": "AudioToken",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "pubkey" },
          { "name": "name", "type": "string" },
          { "name": "symbol", "type": "string" },
          { "name": "audio_uri", "type": "string" },
          { "name": "mint", "type": "pubkey" },
          { "name": "total_supply", "type": "u64" },
          { "name": "created_at", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "BondingCurve",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "mint", "type": "pubkey" },
          { "name": "creator", "type": "pubkey" },
          { "name": "sol_reserves", "type": "u64" },
          { "name": "token_reserves", "type": "u64" },
          { "name": "initial_price", "type": "u64" },
          { "name": "tokens_sold", "type": "u64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
} as const;

// TypeScript types for the program
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
