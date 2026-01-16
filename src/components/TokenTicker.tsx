import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSolPrice } from "@/hooks/useSolPrice";

interface TokenData {
  mint_address: string;
  name: string;
  symbol: string;
  sol_reserves: number;
  token_reserves: number;
  total_supply: number;
}

interface TrendingToken {
  mint_address: string;
  name: string;
  symbol: string;
  currentPrice: number;
  totalSupply: number;
  priceChange: number;
  solReserves: number;
  tokenReserves: number;
}

// Store for 24h ago prices - cached to avoid repeated queries
const priceCache24h: Map<string, { price: number; timestamp: number }> = new Map();
const CACHE_TTL = 60000; // 1 minute cache for 24h ago prices

export function TokenTicker() {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [loading, setLoading] = useState(true);
  const { price: solPrice } = useSolPrice();
  const tokensRef = useRef<TrendingToken[]>([]);
  
  // Keep ref in sync with state for realtime handlers
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  // Get 24h ago price for a token (with caching)
  // IMPORTANT: In trade_history, `price_lamports` is the TOTAL SOL (in lamports) paid/received,
  // and `amount` is the TOTAL tokens (in smallest units) traded.
  // So the trade price per token (SOL per token) is: price_lamports / amount.
  const get24hAgoPrice = useCallback(async (mintAddress: string): Promise<number | null> => {
    const cached = priceCache24h.get(mintAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.price;
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: oldestTrade } = await supabase
      .from("trade_history")
      .select("price_lamports, amount")
      .eq("mint_address", mintAddress)
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: true })
      .limit(1);

    if (oldestTrade && oldestTrade.length > 0) {
      const trade = oldestTrade[0] as any;
      const totalSolLamports = Number(trade.price_lamports);
      const totalTokenUnits = Number(trade.amount);

      // Price per token (SOL per token) expressed as SOL per 1 token
      // Note: ratio is unit-consistent even though both are in smallest units.
      const pricePerToken = totalTokenUnits > 0 ? totalSolLamports / totalTokenUnits : 0;

      if (pricePerToken > 0) {
        priceCache24h.set(mintAddress, { price: pricePerToken, timestamp: Date.now() });
        return pricePerToken;
      }
    }

    return null;
  }, []);

  // Calculate price change percentage
  const calculatePriceChange = useCallback((currentPrice: number, oldPrice: number | null): number => {
    if (!oldPrice || oldPrice <= 0 || currentPrice <= 0) return 0;
    const change = ((currentPrice - oldPrice) / oldPrice) * 100;
    return Math.max(-99.99, Math.min(999.99, change));
  }, []);

  // Process raw token data into display format
  // NOTE: token reserves are stored in smallest units (lamports / token units), so we normalize to
  // display units (SOL + token) to match the Trade page calculations.
  const processToken = useCallback(async (token: TokenData): Promise<TrendingToken> => {
    const solReserves = (Number(token.sol_reserves) || 0) / 1e9; // lamports -> SOL
    const tokenReserves = (Number(token.token_reserves) || 0) / 1e9; // smallest -> token units
    const currentPrice = tokenReserves > 0 ? solReserves / tokenReserves : 0;
    const totalSupply = Number(token.total_supply) || 1000000000;

    const oldPrice = await get24hAgoPrice(token.mint_address);
    const priceChange = calculatePriceChange(currentPrice, oldPrice);

    return {
      mint_address: token.mint_address,
      name: token.name,
      symbol: token.symbol,
      currentPrice,
      totalSupply,
      priceChange,
      solReserves,
      tokenReserves,
    };
  }, [get24hAgoPrice, calculatePriceChange]);

  // Initial fetch of trending tokens
  const fetchTrendingTokens = useCallback(async () => {
    try {
      const { data: tokensData, error } = await supabase
        .from("tokens")
        .select("mint_address, name, symbol, sol_reserves, token_reserves, total_supply")
        .eq("is_active", true)
        .order("total_volume", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!tokensData || tokensData.length === 0) {
        setTokens([]);
        setLoading(false);
        return;
      }

      // Process all tokens in parallel
      const processedTokens = await Promise.all(
        tokensData.map(token => processToken(token))
      );

      setTokens(processedTokens);
    } catch (error) {
      console.error("Error fetching trending tokens:", error);
    } finally {
      setLoading(false);
    }
  }, [processToken]);

  // Update a specific token's price optimistically from realtime payload
  const updateTokenFromPayload = useCallback((payload: any) => {
    const data = payload.new;
    if (!data) return;

    const solReserves = (Number(data.sol_reserves) || 0) / 1e9; // lamports -> SOL
    const tokenReserves = (Number(data.token_reserves) || 0) / 1e9; // smallest -> token units
    const currentPrice = tokenReserves > 0 ? solReserves / tokenReserves : 0;
    const totalSupply = Number(data.total_supply) || 1000000000;

    setTokens((prev) => {
      const tokenIndex = prev.findIndex((t) => t.mint_address === data.mint_address);
      if (tokenIndex === -1) return prev;

      const existingToken = prev[tokenIndex];

      // Recalculate price change using cached 24h price
      const cached = priceCache24h.get(data.mint_address);
      let priceChange = existingToken.priceChange;
      if (cached && cached.price > 0) {
        priceChange = ((currentPrice - cached.price) / cached.price) * 100;
        priceChange = Math.max(-99.99, Math.min(999.99, priceChange));
      }

      const updatedToken: TrendingToken = {
        ...existingToken,
        currentPrice,
        totalSupply,
        priceChange,
        solReserves,
        tokenReserves,
      };

      const newTokens = [...prev];
      newTokens[tokenIndex] = updatedToken;
      return newTokens;
    });
  }, []);

  // Update price change when a new trade occurs (affects 24h calculation)
  const handleNewTrade = useCallback(async (payload: any) => {
    const data = payload.new;
    if (!data) return;

    const mintAddress = data.mint_address;
    
    // Invalidate cache for this token since we have new trade data
    priceCache24h.delete(mintAddress);

    // Update the token with fresh 24h calculation
    const token = tokensRef.current.find(t => t.mint_address === mintAddress);
    if (!token) return;

    const newOldPrice = await get24hAgoPrice(mintAddress);
    const newPriceChange = calculatePriceChange(token.currentPrice, newOldPrice);

    setTokens(prev => {
      const tokenIndex = prev.findIndex(t => t.mint_address === mintAddress);
      if (tokenIndex === -1) return prev;

      const newTokens = [...prev];
      newTokens[tokenIndex] = {
        ...prev[tokenIndex],
        priceChange: newPriceChange,
      };
      return newTokens;
    });
  }, [get24hAgoPrice, calculatePriceChange]);

  useEffect(() => {
    fetchTrendingTokens();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('token-ticker-realtime-v2')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tokens',
        },
        (payload) => {
          // Optimistically update from payload - no refetch needed
          updateTokenFromPayload(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_history',
        },
        (payload) => {
          // Update 24h price change when new trade occurs
          handleNewTrade(payload);
        }
      )
      .subscribe();

    // Fallback polling every 30 seconds (reduced frequency since we have realtime)
    const interval = setInterval(fetchTrendingTokens, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchTrendingTokens, updateTokenFromPayload, handleNewTrade]);

  // Calculate market cap in USD
  // Must match the Trade page: market cap (SOL) = solReserves * 2
  const getMarketCapUsd = useCallback(
    (token: TrendingToken): number => {
      const marketCapSol = token.solReserves * 2;
      return marketCapSol * (solPrice || 0);
    },
    [solPrice]
  );

  // Format market cap
  const formatMarketCap = (mcap: number) => {
    if (!mcap || isNaN(mcap)) return "$0.00";
    if (mcap >= 1000000) {
      return `$${(mcap / 1000000).toFixed(2)}M`;
    } else if (mcap >= 1000) {
      return `$${(mcap / 1000).toFixed(2)}K`;
    } else {
      return `$${mcap.toFixed(2)}`;
    }
  };

  if (loading) {
    return (
      <div className="h-10 bg-muted/30 border-b border-border flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Loading trending tokens...</span>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="h-10 bg-muted/30 border-b border-border flex items-center justify-center">
        <span className="text-xs text-muted-foreground">🎵 Create the first token on NoizLabs!</span>
      </div>
    );
  }

  // Duplicate tokens for seamless loop
  const displayTokens = [...tokens, ...tokens];

  return (
    <div
      className="h-10 w-full max-w-full bg-muted/30 border-b border-border overflow-hidden"
      style={{ contain: "layout paint" }}
    >
      <div className="flex items-center h-full animate-ticker whitespace-nowrap">
        {displayTokens.map((token, index) => {
          const marketCapUsd = getMarketCapUsd(token);
          return (
            <Link
              key={`${token.mint_address}-${index}`}
              to={`/trade?mint=${token.mint_address}`}
              className="inline-flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors flex-shrink-0"
            >
              <span className="font-medium text-sm">{token.symbol}</span>
              <span className="text-xs text-muted-foreground">
                {formatMarketCap(marketCapUsd)}
              </span>
              <span
                className={`flex items-center text-xs ${
                  token.priceChange > 0.01 
                    ? "text-green-500" 
                    : token.priceChange < -0.01 
                      ? "text-red-500" 
                      : "text-muted-foreground"
                }`}
              >
                {token.priceChange > 0.01 ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : token.priceChange < -0.01 ? (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                ) : (
                  <Minus className="w-3 h-3 mr-0.5" />
                )}
                {token.priceChange > 0 ? "+" : ""}{token.priceChange.toFixed(1)}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
