import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TimeRange = "24h" | "7d" | "30d" | "all";

interface AnalyticsData {
  dailyActiveUsers: number;
  tokensLaunched: number;
  remixedTokens: number;
  clipsUploaded: number;
  connectedWallets: number;
  totalVolume: number;
  mintedTokens: number;
  revenue: number;
}

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface AnalyticsTimeSeries {
  tokens: TimeSeriesPoint[];
  clips: TimeSeriesPoint[];
  volume: TimeSeriesPoint[];
  users: TimeSeriesPoint[];
}

export const useAnalytics = (timeRange: TimeRange) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData>({
    dailyActiveUsers: 0,
    tokensLaunched: 0,
    remixedTokens: 0,
    clipsUploaded: 0,
    connectedWallets: 0,
    totalVolume: 0,
    mintedTokens: 0,
    revenue: 0,
  });
  const [timeSeries, setTimeSeries] = useState<AnalyticsTimeSeries>({
    tokens: [],
    clips: [],
    volume: [],
    users: [],
  });

  const dateFilter = useMemo(() => {
    const now = new Date();
    switch (timeRange) {
      case "24h":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "all":
        return new Date(0);
    }
  }, [timeRange]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const dateStr = dateFilter.toISOString();

        // Fetch all data in parallel
        const [
          tokensResult,
          remixesResult,
          clipsResult,
          walletsResult,
          tradesResult,
          activeUsersResult,
        ] = await Promise.all([
          // Tokens launched
          supabase
            .from("tokens")
            .select("id, created_at, is_remix, total_volume")
            .gte("created_at", dateStr),
          // Remixed tokens
          supabase
            .from("tokens")
            .select("id")
            .eq("is_remix", true)
            .gte("created_at", dateStr),
          // Clips uploaded
          supabase
            .from("audio_clips")
            .select("id, created_at")
            .gte("created_at", dateStr),
          // Connected wallets
          supabase
            .from("connected_wallets")
            .select("id, first_connected_at")
            .gte("first_connected_at", dateStr),
          // Trade history for volume
          supabase
            .from("trade_history")
            .select("price_lamports, amount, created_at, wallet_address")
            .gte("created_at", dateStr),
          // Active users (unique wallets that traded)
          supabase
            .from("trade_history")
            .select("wallet_address")
            .gte("created_at", dateStr),
        ]);

        const tokens = tokensResult.data || [];
        const remixes = remixesResult.data || [];
        const clips = clipsResult.data || [];
        const wallets = walletsResult.data || [];
        const trades = tradesResult.data || [];
        
        // Calculate unique active users
        const uniqueActiveUsers = new Set(
          (activeUsersResult.data || []).map((t) => t.wallet_address)
        );

        // Calculate total volume (sum of all trade values)
        const totalVolume = trades.reduce(
          (sum, trade) => sum + (trade.price_lamports || 0),
          0
        );

        // Platform fee is 1% of volume
        const revenue = Math.floor(totalVolume * 0.01);

        setData({
          dailyActiveUsers: uniqueActiveUsers.size,
          tokensLaunched: tokens.length,
          remixedTokens: remixes.length,
          clipsUploaded: clips.length,
          connectedWallets: wallets.length,
          totalVolume,
          mintedTokens: tokens.length,
          revenue,
        });

        // Generate time series data
        const generateTimeSeries = (
          items: Array<{ created_at?: string; first_connected_at?: string }>,
          dateField: "created_at" | "first_connected_at" = "created_at"
        ): TimeSeriesPoint[] => {
          const grouped: Record<string, number> = {};
          
          items.forEach((item) => {
            const dateValue = item[dateField];
            if (!dateValue) return;
            const date = new Date(dateValue).toISOString().split("T")[0];
            grouped[date] = (grouped[date] || 0) + 1;
          });

          return Object.entries(grouped)
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => a.date.localeCompare(b.date));
        };

        const generateVolumeSeries = (
          trades: Array<{ created_at: string; price_lamports: number }>
        ): TimeSeriesPoint[] => {
          const grouped: Record<string, number> = {};
          
          trades.forEach((trade) => {
            const date = new Date(trade.created_at).toISOString().split("T")[0];
            grouped[date] = (grouped[date] || 0) + (trade.price_lamports || 0);
          });

          return Object.entries(grouped)
            .map(([date, value]) => ({ date, value: value / 1e9 })) // Convert to SOL
            .sort((a, b) => a.date.localeCompare(b.date));
        };

        const generateUsersSeries = (
          trades: Array<{ created_at: string; wallet_address: string }>
        ): TimeSeriesPoint[] => {
          const grouped: Record<string, Set<string>> = {};
          
          trades.forEach((trade) => {
            const date = new Date(trade.created_at).toISOString().split("T")[0];
            if (!grouped[date]) grouped[date] = new Set();
            grouped[date].add(trade.wallet_address);
          });

          return Object.entries(grouped)
            .map(([date, wallets]) => ({ date, value: wallets.size }))
            .sort((a, b) => a.date.localeCompare(b.date));
        };

        setTimeSeries({
          tokens: generateTimeSeries(tokens),
          clips: generateTimeSeries(clips),
          volume: generateVolumeSeries(trades as Array<{ created_at: string; price_lamports: number }>),
          users: generateUsersSeries(trades as Array<{ created_at: string; wallet_address: string }>),
        });
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [dateFilter]);

  return { data, timeSeries, loading };
};
