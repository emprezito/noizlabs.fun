import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TrendingToken {
  mint_address: string;
  name: string;
  symbol: string;
  price: number;
  priceChange: number;
  volume: number;
}

export function TokenTicker() {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrendingTokens = async () => {
      try {
        const { data, error } = await supabase
          .from("tokens")
          .select("mint_address, name, symbol, sol_reserves, token_reserves, total_volume")
          .eq("is_active", true)
          .order("total_volume", { ascending: false })
          .limit(10);

        if (error) throw error;

        const trendingTokens: TrendingToken[] = (data || []).map((token) => {
          const solReserves = token.sol_reserves || 0.001;
          const tokenReserves = token.token_reserves || 1000000;
          const price = solReserves / tokenReserves;
          // Simulate price change for demo (in real app, calculate from trade history)
          const priceChange = (Math.random() - 0.5) * 20;

          return {
            mint_address: token.mint_address,
            name: token.name,
            symbol: token.symbol,
            price,
            priceChange,
            volume: token.total_volume || 0,
          };
        });

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
  }, []);

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
  const duplicatedTokens = [...tokens, ...tokens];

  return (
    <div className="h-10 bg-muted/30 border-b border-border overflow-hidden">
      <div className="flex items-center h-full animate-ticker">
        {duplicatedTokens.map((token, index) => (
          <Link
            key={`${token.mint_address}-${index}`}
            to={`/trade?mint=${token.mint_address}`}
            className="flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors whitespace-nowrap"
          >
            <span className="font-medium text-sm">{token.symbol}</span>
            <span className="text-xs text-muted-foreground">
              {token.price < 0.00001 
                ? token.price.toExponential(2) 
                : token.price.toFixed(6)} SOL
            </span>
            <span
              className={`flex items-center text-xs ${
                token.priceChange >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {token.priceChange >= 0 ? (
                <TrendingUp className="w-3 h-3 mr-0.5" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-0.5" />
              )}
              {Math.abs(token.priceChange).toFixed(1)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
