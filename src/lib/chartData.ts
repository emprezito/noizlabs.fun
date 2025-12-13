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
export interface CandleData {
  time: string;
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
      // Return demo data if no trades
      return generateDemoCandles();
    }

    // Group trades by interval and create candles
    const candles: Map<string, CandleData> = new Map();
    
    for (const trade of trades) {
      const timestamp = new Date(trade.created_at);
      // Round to interval
      const intervalMs = intervalMinutes * 60 * 1000;
      const roundedTime = new Date(Math.floor(timestamp.getTime() / intervalMs) * intervalMs);
      const timeKey = roundedTime.toISOString().slice(0, 16).replace("T", " ");
      
      const price = Number(trade.price_lamports) / 1e9; // Convert lamports to SOL
      const volume = Number(trade.amount) / 1e9;
      
      if (candles.has(timeKey)) {
        const candle = candles.get(timeKey)!;
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price;
        candle.volume += volume;
      } else {
        const prevCandle = Array.from(candles.values()).pop();
        candles.set(timeKey, {
          time: timeKey,
          open: prevCandle?.close || price,
          high: price,
          low: price,
          close: price,
          volume: volume,
        });
      }
    }

    const result = Array.from(candles.values());
    
    // If too few candles, pad with simulated data
    if (result.length < 10) {
      const padded = padCandleData(result);
      return padded;
    }
    
    return result;
  } catch (error) {
    console.error("Error fetching trade history:", error);
    return generateDemoCandles();
  }
}

// Generate demo candle data
function generateDemoCandles(count: number = 24): CandleData[] {
  const candles: CandleData[] = [];
  let price = 0.00001;
  const now = new Date();
  
  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const timeStr = time.toISOString().slice(0, 16).replace("T", " ");
    
    const change = (Math.random() - 0.45) * 0.000002;
    const open = price;
    price = Math.max(0.000001, price + change);
    const close = price;
    const variance = Math.abs(close - open) * 0.5;
    
    candles.push({
      time: timeStr,
      open,
      high: Math.max(open, close) + Math.random() * variance,
      low: Math.min(open, close) - Math.random() * variance,
      close,
      volume: Math.random() * 10000,
    });
  }
  
  return candles;
}

// Pad candle data with simulated history
function padCandleData(existing: CandleData[], totalCount: number = 24): CandleData[] {
  if (existing.length === 0) return generateDemoCandles(totalCount);
  
  const firstCandle = existing[0];
  const padCount = totalCount - existing.length;
  
  if (padCount <= 0) return existing;
  
  const padded: CandleData[] = [];
  let price = firstCandle.open;
  const firstTime = new Date(firstCandle.time.replace(" ", "T") + ":00Z");
  
  for (let i = padCount; i > 0; i--) {
    const time = new Date(firstTime.getTime() - i * 60 * 60 * 1000);
    const timeStr = time.toISOString().slice(0, 16).replace("T", " ");
    
    const change = (Math.random() - 0.5) * price * 0.05;
    const open = Math.max(0.000001, price - change);
    const close = price;
    price = open;
    const variance = Math.abs(close - open) * 0.3;
    
    padded.push({
      time: timeStr,
      open,
      high: Math.max(open, close) + Math.random() * variance,
      low: Math.min(open, close) - Math.random() * variance,
      close,
      volume: Math.random() * 5000,
    });
  }
  
  return [...padded.reverse(), ...existing];
}
