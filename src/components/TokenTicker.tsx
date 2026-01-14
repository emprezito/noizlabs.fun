import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSolPrice } from "@/hooks/useSolPrice";

interface TrendingToken {
  mint_address: string;
  name: string;
  symbol: string;
  marketCapUsd: number;
  priceChange: number;
}

export function TokenTicker() {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [loading, setLoading] = useState(true);
  const { price: solPrice } = useSolPrice();

  useEffect(() => {
    const fetchTrendingTokens = async () => {
      try {
        // Fetch tokens with their reserves
        const { data: tokensData, error: tokensError } = await supabase
          .from("tokens")
          .select("mint_address, name, symbol, sol_reserves, token_reserves, total_supply, total_volume")
          .eq("is_active", true)
          .order("total_volume", { ascending: false })
          .limit(10);

        if (tokensError) throw tokensError;

        // For each token, calculate real price change from trade history
        const trendingTokens: TrendingToken[] = await Promise.all(
          (tokensData || []).map(async (token) => {
            const solReserves = token.sol_reserves || 0.001;
            const tokenReserves = token.token_reserves || 1000000;
            const currentPrice = solReserves / tokenReserves;
            
            // Calculate market cap in USD
            const totalSupply = token.total_supply || 1000000000;
            const marketCapSol = currentPrice * totalSupply;
            const marketCapUsd = marketCapSol * (solPrice || 0);

            // Get trades from the last 24 hours to calculate real price change
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            
            const { data: trades } = await supabase
              .from("trade_history")
              .select("price_lamports, created_at")
              .eq("mint_address", token.mint_address)
              .gte("created_at", oneDayAgo)
              .order("created_at", { ascending: true })
              .limit(1);

            let priceChange = 0;
            
            if (trades && trades.length > 0) {
              const oldPriceLamports = trades[0].price_lamports;
              const oldPrice = oldPriceLamports / 1e9; // Convert lamports to SOL
              if (oldPrice > 0) {
                priceChange = ((currentPrice - oldPrice) / oldPrice) * 100;
              }
            }

            return {
              mint_address: token.mint_address,
              name: token.name,
              symbol: token.symbol,
              marketCapUsd,
              priceChange,
            };
          })
        );

        setTokens(trendingTokens);
      } catch (error) {
        console.error("Error fetching trending tokens:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingTokens();
    const interval = setInterval(fetchTrendingTokens, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [solPrice]);

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

  // Format market cap
  const formatMarketCap = (mcap: number) => {
    if (mcap >= 1000000) {
      return `$${(mcap / 1000000).toFixed(2)}M`;
    } else if (mcap >= 1000) {
      return `$${(mcap / 1000).toFixed(2)}K`;
    } else {
      return `$${mcap.toFixed(2)}`;
    }
  };

  return (
    <div className="h-10 bg-muted/30 border-b border-border overflow-hidden">
      <div className="flex items-center h-full animate-ticker">
        {tokens.map((token) => (
          <Link
            key={token.mint_address}
            to={`/trade?mint=${token.mint_address}`}
            className="flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors whitespace-nowrap"
          >
            <span className="font-medium text-sm">{token.symbol}</span>
            <span className="text-xs text-muted-foreground">
              {formatMarketCap(token.marketCapUsd)}
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
              {Math.abs(token.priceChange).toFixed(1)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
