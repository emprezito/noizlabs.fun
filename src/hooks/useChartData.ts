import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTradeHistoryCandles, fetchTradeHistory, CandleData, TradeHistoryItem } from "@/lib/chartData";
import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseChartDataOptions {
  mintAddress: string;
  intervalMinutes: number;
  enabled?: boolean;
}

export function useChartData({ mintAddress, intervalMinutes, enabled = true }: UseChartDataOptions) {
  const queryClient = useQueryClient();

  // Query for candle data - depends on both mint and interval
  const candleQuery = useQuery({
    queryKey: ["chart-candles", mintAddress, intervalMinutes],
    queryFn: () => fetchTradeHistoryCandles(mintAddress, intervalMinutes),
    enabled: enabled && !!mintAddress,
    staleTime: 1000, // Consider data stale after 1 second
    refetchInterval: 2000, // Refetch every 2 seconds for live updates
  });

  // Query for trade history - only depends on mint
  const tradeHistoryQuery = useQuery({
    queryKey: ["trade-history", mintAddress],
    queryFn: () => fetchTradeHistory(mintAddress),
    enabled: enabled && !!mintAddress,
    staleTime: 1000,
    refetchInterval: 2000,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!mintAddress || !enabled) return;

    const channel = supabase
      .channel(`chart-${mintAddress}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_history',
          filter: `mint_address=eq.${mintAddress}`,
        },
        () => {
          // Invalidate both queries when new trade comes in
          queryClient.invalidateQueries({ 
            queryKey: ["chart-candles", mintAddress, intervalMinutes] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ["trade-history", mintAddress] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mintAddress, intervalMinutes, enabled, queryClient]);

  // Function to change interval (invalidates cache for immediate update)
  const changeInterval = useCallback(async (newIntervalMinutes: number) => {
    await queryClient.invalidateQueries({
      queryKey: ["chart-candles", mintAddress, newIntervalMinutes],
      refetchType: 'active'
    });
  }, [mintAddress, queryClient]);

  return {
    candleData: candleQuery.data || [],
    tradeHistory: tradeHistoryQuery.data || [],
    isLoading: candleQuery.isLoading || tradeHistoryQuery.isLoading,
    isFetching: candleQuery.isFetching,
    changeInterval,
  };
}
