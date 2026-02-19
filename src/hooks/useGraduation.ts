import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const MIGRATION_MARKET_CAP_USD = 50_000;

export interface GraduationState {
  isGraduated: boolean;
  isMigrating: boolean;
  isActive: boolean;
  status: string;
  raydiumPoolAddress: string | null;
  migrationTimestamp: string | null;
  marketCapUsd: number;
  progressPercent: number;
  solPrice: number;
}

export function useGraduation(mintAddress: string | null, solReserves: number, tokenReserves: number, totalSupply: number) {
  const [graduation, setGraduation] = useState<GraduationState>({
    isGraduated: false,
    isMigrating: false,
    isActive: true,
    status: 'active',
    raydiumPoolAddress: null,
    migrationTimestamp: null,
    marketCapUsd: 0,
    progressPercent: 0,
    solPrice: 150,
  });
  const [loading, setLoading] = useState(false);

  const fetchGraduationState = useCallback(async () => {
    if (!mintAddress) return;

    const { data: token } = await supabase
      .from('tokens')
      .select('status, is_graduated, raydium_pool_address, migration_timestamp, is_active')
      .eq('mint_address', mintAddress)
      .maybeSingle();

    if (!token) return;

    // Get SOL price from cache or default
    let solPrice = 150;
    try {
      const cached = localStorage.getItem('noizlabs_sol_price');
      if (cached) {
        const { price, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 60_000) solPrice = price;
      }
    } catch {}

    // Calculate market cap
    const priceInSol = tokenReserves > 0 ? solReserves / tokenReserves : 0;
    const circulatingSupply = Math.max(0, totalSupply - tokenReserves);
    const marketCapUsd = priceInSol * circulatingSupply * solPrice;
    const progressPercent = Math.min(100, (marketCapUsd / MIGRATION_MARKET_CAP_USD) * 100);

    setGraduation({
      isGraduated: (token as any).is_graduated || false,
      isMigrating: (token as any).status === 'migrating',
      isActive: (token as any).is_active || false,
      status: (token as any).status || 'active',
      raydiumPoolAddress: (token as any).raydium_pool_address || null,
      migrationTimestamp: (token as any).migration_timestamp || null,
      marketCapUsd,
      progressPercent,
      solPrice,
    });
  }, [mintAddress, solReserves, tokenReserves, totalSupply]);

  useEffect(() => {
    fetchGraduationState();
  }, [fetchGraduationState]);

  // Real-time subscription for graduation status changes
  useEffect(() => {
    if (!mintAddress) return;

    const channel = supabase
      .channel(`graduation-${mintAddress}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tokens',
        filter: `mint_address=eq.${mintAddress}`,
      }, () => {
        fetchGraduationState();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mintAddress, fetchGraduationState]);

  // Trigger migration check (called after trades)
  const checkMigration = useCallback(async () => {
    if (!mintAddress) return;
    try {
      await supabase.functions.invoke('check-migration-threshold', {
        body: { mintAddress },
      });
      await fetchGraduationState();
    } catch (err) {
      console.error('Migration check failed:', err);
    }
  }, [mintAddress, fetchGraduationState]);

  return { graduation, loading, checkMigration, refetch: fetchGraduationState };
}
