import { supabase } from "@/integrations/supabase/client";

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    h24?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    m5?: { buys: number; sells: number };
  };
  volume: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  priceChange: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[] | null;
}

// Fetch token data from DexScreener (free, no API key needed)
export async function fetchDexScreenerData(mintAddress: string): Promise<DexScreenerPair | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`
    );
    
    if (!response.ok) {
      console.error("DexScreener API error:", response.status);
      return null;
    }
    
    const data: DexScreenerResponse = await response.json();
    
    // Return the first Solana pair found
    if (data.pairs && data.pairs.length > 0) {
      return data.pairs.find(p => p.chainId === "solana") || data.pairs[0];
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching DexScreener data:", error);
    return null;
  }
}

// Generate OHLCV candle data from trade history
// Time must be Unix timestamp (seconds) for lightweight-charts
export interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchTradeHistoryCandles(
  mintAddress: string,
  intervalMinutes: number = 60
): Promise<CandleData[]> {
  try {
    // Fetch trade history from our database
    const { data: trades, error } = await supabase
      .from("trade_history")
      .select("*")
      .eq("mint_address", mintAddress)
      .order("created_at", { ascending: true });

    if (error || !trades || trades.length === 0) {
      return [];
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    const candles: Map<number, CandleData> = new Map();
    
    // First pass: create candles from actual trades
    for (const trade of trades) {
      const timestamp = new Date(trade.created_at);
      const roundedTime = Math.floor(timestamp.getTime() / intervalMs) * intervalMs;
      const timeKey = Math.floor(roundedTime / 1000); // Unix timestamp in seconds
      
      // Calculate price per token from trade data
      const solAmount = Number(trade.price_lamports); // in lamports
      const tokenAmount = Number(trade.amount); // in token smallest units
      const price = tokenAmount > 0 ? solAmount / tokenAmount : 0;
      const volume = solAmount / 1e9; // Volume in SOL
      
      if (price <= 0) continue; // Skip invalid prices
      
      if (candles.has(timeKey)) {
        const candle = candles.get(timeKey)!;
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price;
        candle.volume += volume;
      } else {
        candles.set(timeKey, {
          time: timeKey,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume,
        });
      }
    }

    if (candles.size === 0) return [];

    // Get sorted time keys
    const sortedKeys = Array.from(candles.keys()).sort((a, b) => a - b);
    const firstTime = sortedKeys[0];
    const lastTime = sortedKeys[sortedKeys.length - 1];
    const intervalSeconds = intervalMinutes * 60;

    // Second pass: fill gaps with flat candles (using previous close)
    const filledCandles: CandleData[] = [];
    let previousClose = candles.get(firstTime)!.open;

    for (let t = firstTime; t <= lastTime; t += intervalSeconds) {
      if (candles.has(t)) {
        const candle = candles.get(t)!;
        // Use previous close as open for continuity
        candle.open = previousClose;
        filledCandles.push(candle);
        previousClose = candle.close;
      } else {
        // Create a flat candle (no trade in this period)
        filledCandles.push({
          time: t,
          open: previousClose,
          high: previousClose,
          low: previousClose,
          close: previousClose,
          volume: 0,
        });
      }
    }

    return filledCandles;
  } catch (error) {
    console.error("Error fetching trade history:", error);
    return [];
  }
}

// Fetch raw trade history for display
export interface TradeHistoryItem {
  id: string;
  trade_type: string;
  amount: number;
  price_lamports: number;
  wallet_address: string;
  created_at: string;
  signature: string | null;
}

export async function fetchTradeHistory(mintAddress: string, limit: number = 20): Promise<TradeHistoryItem[]> {
  const { data, error } = await supabase
    .from("trade_history")
    .select("*")
    .eq("mint_address", mintAddress)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data;
}
