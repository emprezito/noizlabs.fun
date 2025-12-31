import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Wallet, 
  Lock, 
  Unlock,
  Clock,
  CheckCircle,
  Loader2,
  RefreshCw,
  Timer,
  Coins
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VestingSchedule {
  id: string;
  mint_address: string;
  token_amount: number;
  total_claimed: number;
  vesting_start: string;
  vesting_duration_days: number;
  claim_interval_days: number;
  last_claim_at: string | null;
  claimed: boolean;
  token_name?: string;
  token_symbol?: string;
  cover_image_url?: string;
  // Calculated fields
  claimable: number;
  percentVested: number;
  canClaim: boolean;
  nextClaimIn: number;
  daysRemaining: number;
}

const Vesting = () => {
  const { publicKey, connected } = useWallet();
  const [vestingSchedules, setVestingSchedules] = useState<VestingSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  const calculateVestingStatus = (schedule: {
    vesting_start: string;
    token_amount: number;
    total_claimed: number;
    vesting_duration_days: number;
    claim_interval_days: number;
    last_claim_at: string | null;
  }) => {
    const now = new Date();
    const startTime = new Date(schedule.vesting_start).getTime();
    const nowTime = now.getTime();
    const vestingDurationMs = schedule.vesting_duration_days * 24 * 60 * 60 * 1000;
    const claimIntervalMs = schedule.claim_interval_days * 24 * 60 * 60 * 1000;
    
    // Calculate time elapsed since vesting start
    const elapsed = Math.max(0, nowTime - startTime);
    
    // Calculate percentage vested (0 to 100)
    const percentVested = Math.min(100, (elapsed / vestingDurationMs) * 100);
    
    // Calculate total tokens that should be vested by now
    const totalVestedNow = Math.floor((schedule.token_amount * percentVested) / 100);
    
    // Claimable = total vested - already claimed
    const claimable = Math.max(0, totalVestedNow - schedule.total_claimed);
    
    // Check if enough time has passed since last claim
    let canClaim = claimable > 0;
    let nextClaimIn = 0;
    
    if (schedule.last_claim_at) {
      const lastClaimTime = new Date(schedule.last_claim_at).getTime();
      const timeSinceLastClaim = nowTime - lastClaimTime;
      if (timeSinceLastClaim < claimIntervalMs) {
        canClaim = false;
        nextClaimIn = Math.ceil((claimIntervalMs - timeSinceLastClaim) / (1000 * 60 * 60));
      }
    }

    // Days remaining until fully vested
    const daysRemaining = Math.max(0, Math.ceil((vestingDurationMs - elapsed) / (1000 * 60 * 60 * 24)));

    return { claimable, percentVested, canClaim, nextClaimIn, daysRemaining };
  };

  const fetchVestingSchedules = useCallback(async () => {
    if (!publicKey) {
      setVestingSchedules([]);
      return;
    }

    setLoading(true);
    const walletAddress = publicKey.toBase58();

    try {
      // Fetch vesting records for this wallet
      const { data: vestings, error } = await supabase
        .from("token_vesting")
        .select("*")
        .eq("wallet_address", walletAddress)
        .order("vesting_start", { ascending: false });

      if (error) throw error;

      if (!vestings || vestings.length === 0) {
        setVestingSchedules([]);
        setLoading(false);
        return;
      }

      // Fetch token details
      const mintAddresses = vestings.map(v => v.mint_address);
      const { data: tokens } = await supabase
        .from("tokens")
        .select("mint_address, name, symbol, cover_image_url")
        .in("mint_address", mintAddresses);

      // Build schedules with calculated status
      const schedules: VestingSchedule[] = vestings.map(v => {
        const token = tokens?.find(t => t.mint_address === v.mint_address);
        const status = calculateVestingStatus({
          vesting_start: v.vesting_start,
          token_amount: v.token_amount,
          total_claimed: v.total_claimed || 0,
          vesting_duration_days: v.vesting_duration_days || 21,
          claim_interval_days: v.claim_interval_days || 2,
          last_claim_at: v.last_claim_at,
        });

        return {
          id: v.id,
          mint_address: v.mint_address,
          token_amount: v.token_amount,
          total_claimed: v.total_claimed || 0,
          vesting_start: v.vesting_start,
          vesting_duration_days: v.vesting_duration_days || 21,
          claim_interval_days: v.claim_interval_days || 2,
          last_claim_at: v.last_claim_at,
          claimed: v.claimed || false,
          token_name: token?.name || "Unknown Token",
          token_symbol: token?.symbol || "???",
          cover_image_url: token?.cover_image_url,
          ...status,
        };
      });

      setVestingSchedules(schedules);
    } catch (error) {
      console.error("Error fetching vesting schedules:", error);
      toast.error("Failed to load vesting schedules");
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchVestingSchedules();
    
    // Refresh every minute to update countdowns
    const interval = setInterval(fetchVestingSchedules, 60000);
    return () => clearInterval(interval);
  }, [fetchVestingSchedules]);

  const handleClaim = async (vestingId: string) => {
    if (!publicKey) return;

    setClaiming(vestingId);
    try {
      const response = await supabase.functions.invoke("claim-vested-tokens", {
        body: {
          vestingId,
          walletAddress: publicKey.toBase58(),
          action: "claim",
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      if (data.error) {
        toast.error(data.message || data.error);
      } else {
        toast.success(data.message || "Tokens claimed successfully!");
        fetchVestingSchedules();
      }
    } catch (error) {
      console.error("Error claiming tokens:", error);
      toast.error("Failed to claim tokens");
    } finally {
      setClaiming(null);
    }
  };

  const formatTokenAmount = (amount: number) => {
    return (amount / 1e9).toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 4 
    });
  };

  const activeVesting = vestingSchedules.filter(s => !s.claimed);
  const completedVesting = vestingSchedules.filter(s => s.claimed);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-20 pb-24 md:pb-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Lock className="w-6 h-6 text-primary" />
                Token Vesting
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Your creator token allocations vest linearly over 21 days
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVestingSchedules}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>

          {!connected ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Connect your wallet to view your vesting schedules</p>
              </CardContent>
            </Card>
          ) : loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-40 mb-4" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-10 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : vestingSchedules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Coins className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No vesting schedules found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  When you create a token, your 5% creator allocation will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Active Vesting */}
              {activeVesting.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Timer className="w-5 h-5 text-primary" />
                    Active Vesting ({activeVesting.length})
                  </h2>
                  
                  {activeVesting.map(schedule => (
                    <Card key={schedule.id} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          {/* Token Image */}
                          {schedule.cover_image_url ? (
                            <img
                              src={schedule.cover_image_url}
                              alt={schedule.token_name}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Coins className="w-8 h-8 text-primary" />
                            </div>
                          )}
                          
                          <div className="flex-1">
                            {/* Token Info */}
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h3 className="font-semibold">{schedule.token_name}</h3>
                                <p className="text-sm text-muted-foreground">${schedule.token_symbol}</p>
                              </div>
                              <Badge variant={schedule.percentVested >= 100 ? "default" : "secondary"}>
                                {schedule.percentVested.toFixed(1)}% Vested
                              </Badge>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mb-4">
                              <Progress value={schedule.percentVested} className="h-2" />
                              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>Claimed: {formatTokenAmount(schedule.total_claimed)}</span>
                                <span>Total: {formatTokenAmount(schedule.token_amount)}</span>
                              </div>
                            </div>
                            
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Claimable</p>
                                <p className="font-semibold text-green-500">
                                  {formatTokenAmount(schedule.claimable)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Days Left</p>
                                <p className="font-semibold">{schedule.daysRemaining}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Claim Every</p>
                                <p className="font-semibold">{schedule.claim_interval_days} days</p>
                              </div>
                            </div>
                            
                            {/* Claim Button */}
                            <div className="flex items-center gap-3">
                              <Button
                                onClick={() => handleClaim(schedule.id)}
                                disabled={!schedule.canClaim || claiming === schedule.id}
                                className="flex-1"
                              >
                                {claiming === schedule.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Claiming...
                                  </>
                                ) : schedule.canClaim ? (
                                  <>
                                    <Unlock className="w-4 h-4 mr-2" />
                                    Claim {formatTokenAmount(schedule.claimable)} Tokens
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-4 h-4 mr-2" />
                                    {schedule.nextClaimIn > 0 
                                      ? `Next claim in ${schedule.nextClaimIn}h`
                                      : "Nothing to claim yet"}
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Completed Vesting */}
              {completedVesting.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Fully Claimed ({completedVesting.length})
                  </h2>
                  
                  {completedVesting.map(schedule => (
                    <Card key={schedule.id} className="opacity-75">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {schedule.cover_image_url ? (
                            <img
                              src={schedule.cover_image_url}
                              alt={schedule.token_name}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Coins className="w-6 h-6 text-primary" />
                            </div>
                          )}
                          
                          <div className="flex-1">
                            <h3 className="font-semibold">{schedule.token_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {formatTokenAmount(schedule.token_amount)} tokens fully claimed
                            </p>
                          </div>
                          
                          <Badge variant="outline" className="text-green-500 border-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Complete
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      
      <Footer />
      <MobileTabBar />
    </div>
  );
};

export default Vesting;
