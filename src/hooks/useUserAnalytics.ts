import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format, eachDayOfInterval, startOfDay } from "date-fns";

export interface UserAnalyticsData {
  clipsUploaded: number;
  tokensCreated: number;
  totalVolume: number;
  totalCreatorFees: number;
  totalTrades: number;
  tokens: TokenAnalytics[];
  weeklyTrends: TrendData[];
  monthlyTrends: TrendData[];
  tradesByType: { buys: number; sells: number };
  recentActivity: ActivityItem[];
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

export interface TrendData {
  date: string;
  label: string;
  volume: number;
  trades: number;
  earnings: number;
}

export interface ActivityItem {
  id: string;
  type: 'trade' | 'clip' | 'token';
  title: string;
  description: string;
  timestamp: string;
  amount?: number;
}

export const useUserAnalytics = (walletAddress: string | null) => {
  const [data, setData] = useState<UserAnalyticsData>({
    clipsUploaded: 0,
    tokensCreated: 0,
    totalVolume: 0,
    totalCreatorFees: 0,
    totalTrades: 0,
    tokens: [],
    weeklyTrends: [],
    monthlyTrends: [],
    tradesByType: { buys: 0, sells: 0 },
    recentActivity: [],
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
        const now = new Date();
        const fourWeeksAgo = subWeeks(now, 4);
        const sixMonthsAgo = subMonths(now, 6);

        // Fetch all data in parallel
        const [clipsResult, tokensResult, earningsResult, tradesResult, recentTradesResult] = await Promise.all([
          // Clips uploaded by user
          supabase
            .from("audio_clips")
            .select("id, title, created_at", { count: "exact" })
            .eq("wallet_address", walletAddress)
            .order("created_at", { ascending: false })
            .limit(10),
          
          // Tokens created by user
          supabase
            .from("tokens")
            .select("id, name, symbol, cover_image_url, total_volume, mint_address, created_at")
            .eq("creator_wallet", walletAddress)
            .order("created_at", { ascending: false }),
          
          // Creator earnings
          supabase
            .from("creator_earnings")
            .select("amount_lamports, mint_address, created_at")
            .eq("wallet_address", walletAddress),
          
          // User's trades with date filter for trends
          supabase
            .from("trade_history")
            .select("id, price_lamports, mint_address, trade_type, created_at")
            .eq("wallet_address", walletAddress)
            .gte("created_at", sixMonthsAgo.toISOString())
            .order("created_at", { ascending: false }),
          
          // Recent trades for activity feed
          supabase
            .from("trade_history")
            .select("id, price_lamports, trade_type, created_at, mint_address")
            .eq("wallet_address", walletAddress)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        const clipsUploaded = clipsResult.count || 0;
        const clips = clipsResult.data || [];
        const tokens = tokensResult.data || [];
        const earnings = earningsResult.data || [];
        const trades = tradesResult.data || [];
        const recentTrades = recentTradesResult.data || [];

        // Calculate totals
        const totalCreatorFees = earnings.reduce((sum, e) => sum + (e.amount_lamports || 0), 0);
        const totalVolume = trades.reduce((sum, t) => sum + (t.price_lamports || 0), 0);

        // Trades by type
        const buys = trades.filter(t => t.trade_type === 'buy').length;
        const sells = trades.filter(t => t.trade_type === 'sell').length;

        // Build weekly trends (last 4 weeks)
        const weeklyTrends: TrendData[] = [];
        for (let i = 3; i >= 0; i--) {
          const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
          const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
          
          const weekTrades = trades.filter(t => {
            const tradeDate = new Date(t.created_at);
            return tradeDate >= weekStart && tradeDate <= weekEnd;
          });
          
          const weekEarnings = earnings.filter(e => {
            const earnDate = new Date(e.created_at);
            return earnDate >= weekStart && earnDate <= weekEnd;
          });

          weeklyTrends.push({
            date: format(weekStart, 'yyyy-MM-dd'),
            label: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : format(weekStart, 'MMM d'),
            volume: weekTrades.reduce((sum, t) => sum + (t.price_lamports || 0), 0),
            trades: weekTrades.length,
            earnings: weekEarnings.reduce((sum, e) => sum + (e.amount_lamports || 0), 0),
          });
        }

        // Build monthly trends (last 6 months)
        const monthlyTrends: TrendData[] = [];
        for (let i = 5; i >= 0; i--) {
          const monthStart = startOfMonth(subMonths(now, i));
          const monthEnd = endOfMonth(subMonths(now, i));
          
          const monthTrades = trades.filter(t => {
            const tradeDate = new Date(t.created_at);
            return tradeDate >= monthStart && tradeDate <= monthEnd;
          });
          
          const monthEarnings = earnings.filter(e => {
            const earnDate = new Date(e.created_at);
            return earnDate >= monthStart && earnDate <= monthEnd;
          });

          monthlyTrends.push({
            date: format(monthStart, 'yyyy-MM-dd'),
            label: format(monthStart, 'MMM'),
            volume: monthTrades.reduce((sum, t) => sum + (t.price_lamports || 0), 0),
            trades: monthTrades.length,
            earnings: monthEarnings.reduce((sum, e) => sum + (e.amount_lamports || 0), 0),
          });
        }

        // Build token analytics
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
            tradesCount: 0,
          };
        });

        // Count trades per token
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

        // Build recent activity
        const recentActivity: ActivityItem[] = [];
        
        // Add recent trades
        recentTrades.slice(0, 5).forEach(trade => {
          recentActivity.push({
            id: trade.id,
            type: 'trade',
            title: trade.trade_type === 'buy' ? 'Bought Tokens' : 'Sold Tokens',
            description: `${trade.trade_type === 'buy' ? 'Purchased' : 'Sold'} tokens`,
            timestamp: trade.created_at,
            amount: trade.price_lamports,
          });
        });

        // Add recent clips
        clips.slice(0, 3).forEach(clip => {
          recentActivity.push({
            id: clip.id,
            type: 'clip',
            title: 'Uploaded Clip',
            description: clip.title,
            timestamp: clip.created_at,
          });
        });

        // Add recent tokens
        tokens.slice(0, 3).forEach(token => {
          recentActivity.push({
            id: token.id,
            type: 'token',
            title: 'Created Token',
            description: `$${token.symbol}`,
            timestamp: token.created_at,
          });
        });

        // Sort by timestamp
        recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setData({
          clipsUploaded,
          tokensCreated: tokens.length,
          totalVolume,
          totalCreatorFees,
          totalTrades: trades.length,
          tokens: tokenAnalytics,
          weeklyTrends,
          monthlyTrends,
          tradesByType: { buys, sells },
          recentActivity: recentActivity.slice(0, 10),
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
