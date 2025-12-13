import { Buffer } from "buffer";

// Polyfill Buffer and process for browser environment (required by Solana/Metaplex libraries)
if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  
  // Polyfill process for libraries that check for Node.js environment
  if (typeof (window as any).process === "undefined") {
    (window as any).process = {
      env: {},
      version: "",
      platform: "browser",
      nextTick: (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0),
    };
  }
}

export {};
