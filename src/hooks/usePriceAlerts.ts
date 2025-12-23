import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";

interface TokenPosition {
  mint_address: string;
  name: string;
  symbol: string;
  lastKnownPrice: number;
}

// Price change threshold for notifications (5%)
const PRICE_CHANGE_THRESHOLD = 0.05;

export function usePriceAlerts() {
  const { publicKey } = useWallet();
  const positionsRef = useRef<Map<string, TokenPosition>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!publicKey) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      positionsRef.current.clear();
      return;
    }

    const walletAddress = publicKey.toBase58();

    // Fetch user's token positions from trade history
    const fetchPositions = async () => {
      // Get unique tokens the user has traded
      const { data: trades, error } = await supabase
        .from("trade_history")
        .select("mint_address, trade_type, amount")
        .eq("wallet_address", walletAddress)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching trade history:", error);
        return;
      }

      // Calculate net positions (buy - sell)
      const positions = new Map<string, number>();
      trades?.forEach((trade) => {
        const current = positions.get(trade.mint_address) || 0;
        if (trade.trade_type === "buy") {
          positions.set(trade.mint_address, current + trade.amount);
        } else {
          positions.set(trade.mint_address, current - trade.amount);
        }
      });

      // Get tokens with positive positions
      const activePositions = Array.from(positions.entries())
        .filter(([_, amount]) => amount > 0)
        .map(([mint]) => mint);

      if (activePositions.length === 0) return;

      // Fetch token details and current prices
      const { data: tokens, error: tokensError } = await supabase
        .from("tokens")
        .select("mint_address, name, symbol, sol_reserves, token_reserves")
        .in("mint_address", activePositions);

      if (tokensError) {
        console.error("Error fetching tokens:", tokensError);
        return;
      }

      // Update positions with current prices
      tokens?.forEach((token) => {
        const solReserves = Number(token.sol_reserves || 0) / 1e9;
        const tokenReserves = Number(token.token_reserves || 0) / 1e9;
        const price = tokenReserves > 0 ? solReserves / tokenReserves : 0;

        const existing = positionsRef.current.get(token.mint_address);
        
        if (existing) {
          // Check for significant price change
          const priceChange = (price - existing.lastKnownPrice) / existing.lastKnownPrice;
          
          if (Math.abs(priceChange) >= PRICE_CHANGE_THRESHOLD) {
            const isUp = priceChange > 0;
            const percentChange = (priceChange * 100).toFixed(1);
            
            // Create notification
            createNotification(
              walletAddress,
              isUp ? "Price Up!" : "Price Down!",
              `${token.symbol} is ${isUp ? "up" : "down"} ${Math.abs(Number(percentChange))}%`,
              isUp ? "price_up" : "price_down",
              token.mint_address
            );
            
            // Update last known price
            positionsRef.current.set(token.mint_address, {
              ...existing,
              lastKnownPrice: price,
            });
          }
        } else {
          // First time tracking this token
          positionsRef.current.set(token.mint_address, {
            mint_address: token.mint_address,
            name: token.name,
            symbol: token.symbol,
            lastKnownPrice: price,
          });
        }
      });
    };

    // Initial fetch
    fetchPositions();

    // Check prices every 30 seconds
    intervalRef.current = setInterval(fetchPositions, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [publicKey]);
}

async function createNotification(
  walletAddress: string,
  title: string,
  message: string,
  type: string,
  tokenMint: string
) {
  const { error } = await supabase.from("notifications").insert({
    wallet_address: walletAddress,
    title,
    message,
    type,
    token_mint: tokenMint,
  });

  if (error) {
    console.error("Error creating notification:", error);
  }
}
