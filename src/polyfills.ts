import { Buffer } from "buffer";

// Polyfill Buffer for browser environment (required by Solana libraries)
if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
}

export {};
