import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserAnalyticsData {
  clipsUploaded: number;
  tokensCreated: number;
  totalVolume: number;
  totalCreatorFees: number;
  totalTrades: number;
  tokens: TokenAnalytics[];
}

export interface TokenAnalytics {
  id: string;
  name: string;
  symbol: string;
  coverImage: string | null;
  volume: number;
  creatorFees: number;
  tradesCount: number;
}

export const useUserAnalytics = (walletAddress: string | null) => {
  const [data, setData] = useState<UserAnalyticsData>({
    clipsUploaded: 0,
    tokensCreated: 0,
    totalVolume: 0,
    totalCreatorFees: 0,
    totalTrades: 0,
    tokens: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      setLoading(true);

      try {
        // Fetch all data in parallel
        const [clipsResult, tokensResult, earningsResult, tradesResult] = await Promise.all([
          // Clips uploaded by user
          supabase
            .from("audio_clips")
            .select("id", { count: "exact" })
            .eq("wallet_address", walletAddress),
          
          // Tokens created by user
          supabase
            .from("tokens")
            .select("id, name, symbol, cover_image_url, total_volume, mint_address")
            .eq("creator_wallet", walletAddress),
          
          // Creator earnings
          supabase
            .from("creator_earnings")
            .select("amount_lamports, mint_address")
            .eq("wallet_address", walletAddress),
          
          // User's trades
          supabase
            .from("trade_history")
            .select("id, price_lamports, mint_address")
            .eq("wallet_address", walletAddress),
        ]);

        const clipsUploaded = clipsResult.count || 0;
        const tokens = tokensResult.data || [];
        const earnings = earningsResult.data || [];
        const trades = tradesResult.data || [];

        // Calculate total creator fees
        const totalCreatorFees = earnings.reduce((sum, e) => sum + (e.amount_lamports || 0), 0);

        // Calculate total volume from user's trades
        const totalVolume = trades.reduce((sum, t) => sum + (t.price_lamports || 0), 0);

        // Build token analytics with volume and fees per token
        const tokenAnalytics: TokenAnalytics[] = tokens.map((token) => {
          const tokenEarnings = earnings.filter(e => e.mint_address === token.mint_address);
          const tokenFees = tokenEarnings.reduce((sum, e) => sum + (e.amount_lamports || 0), 0);
          
          return {
            id: token.id,
            name: token.name,
            symbol: token.symbol,
            coverImage: token.cover_image_url,
            volume: token.total_volume || 0,
            creatorFees: tokenFees,
            tradesCount: 0, // Will be updated below
          };
        });

        // Count trades per token for tokens created by user
        for (const tokenData of tokenAnalytics) {
          const token = tokens.find(t => t.id === tokenData.id);
          if (token) {
            const { count } = await supabase
              .from("trade_history")
              .select("id", { count: "exact" })
              .eq("mint_address", token.mint_address);
            tokenData.tradesCount = count || 0;
          }
        }

        setData({
          clipsUploaded,
          tokensCreated: tokens.length,
          totalVolume,
          totalCreatorFees,
          totalTrades: trades.length,
          tokens: tokenAnalytics,
        });
      } catch (error) {
        console.error("Error fetching user analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [walletAddress]);

  return { data, loading };
};
