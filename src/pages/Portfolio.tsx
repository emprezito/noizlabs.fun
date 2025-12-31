import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Play, 
  Pause, 
  ArrowRightLeft,
  Bell,
  BellOff,
  RefreshCw,
  Loader2,
  Coins,
  Lock,
  Timer,
  ArrowRight
} from "lucide-react";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useSolPrice } from "@/hooks/useSolPrice";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";

interface TokenHolding {
  mint_address: string;
  name: string;
  symbol: string;
  balance: number;
  price: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  audioUrl?: string;
  imageUrl?: string;
}

interface CreatorEarning {
  mint_address: string;
  token_name: string;
  token_symbol: string;
  total_earnings: number;
  trade_count: number;
}

interface VestingSummary {
  totalVesting: number;
  totalClaimable: number;
  activeCount: number;
  nextClaimDays: number | null;
}

const Portfolio = () => {
  const navigate = useNavigate();
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { balance: solBalance, loading: balanceLoading, refetch: refetchBalance } = useWalletBalance();
  const { price: solUsdPrice, formatUsd } = useSolPrice();

  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [creatorEarnings, setCreatorEarnings] = useState<CreatorEarning[]>([]);
  const [totalCreatorEarnings, setTotalCreatorEarnings] = useState(0);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [vestingSummary, setVestingSummary] = useState<VestingSummary | null>(null);
  const [loadingVesting, setLoadingVesting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications();

  // Fetch user's notification preferences
  const fetchNotificationPrefs = useCallback(async () => {
    if (!publicKey) return;
    
    const { data } = await supabase
      .from("notification_preferences")
      .select("price_alerts_enabled")
      .eq("wallet_address", publicKey.toBase58())
      .maybeSingle();
    
    setNotificationsEnabled(data?.price_alerts_enabled ?? false);
  }, [publicKey]);

  // Toggle notifications
  const toggleNotifications = async () => {
    if (!publicKey) return;
    
    setLoadingPrefs(true);
    const walletAddress = publicKey.toBase58();
    const newValue = !notificationsEnabled;

    const { error } = await supabase
      .from("notification_preferences")
      .upsert({
        wallet_address: walletAddress,
        price_alerts_enabled: newValue,
        updated_at: new Date().toISOString(),
      }, { onConflict: "wallet_address" });

    if (error) {
      toast.error("Failed to update notification preferences");
    } else {
      setNotificationsEnabled(newValue);
      toast.success(newValue ? "Price alerts enabled" : "Price alerts disabled");
      
      // If enabling and push notifications are supported but not subscribed, offer to subscribe
      if (newValue && pushSupported && !pushSubscribed) {
        subscribePush();
      }
    }
    setLoadingPrefs(false);
  };

  // Fetch user's token holdings
  const fetchHoldings = useCallback(async () => {
    if (!publicKey) {
      setHoldings([]);
      return;
    }

    setLoadingHoldings(true);
    const walletAddress = publicKey.toBase58();

    try {
      // Get unique tokens the user has traded
      const { data: trades, error: tradesError } = await supabase
        .from("trade_history")
        .select("mint_address, trade_type, amount, price_lamports")
        .eq("wallet_address", walletAddress)
        .order("created_at", { ascending: true });

      if (tradesError) throw tradesError;

      // Calculate net positions and cost basis
      // In trade_history: price_lamports = total SOL for the trade (not per-token price)
      // For buy: price_lamports = SOL spent, amount = tokens received
      // For sell: price_lamports = SOL received, amount = tokens sold
      const positionsMap = new Map<string, { amount: number; costBasis: number }>();
      
      trades?.forEach((trade) => {
        const current = positionsMap.get(trade.mint_address) || { amount: 0, costBasis: 0 };
        const tokenAmount = Number(trade.amount) / 1e9; // Convert from raw to display (9 decimals)
        const solAmount = Number(trade.price_lamports) / 1e9; // Convert lamports to SOL

        if (trade.trade_type === "buy") {
          current.amount += tokenAmount;
          current.costBasis += solAmount; // Total SOL spent on this buy
        } else {
          // FIFO: reduce cost basis proportionally when selling
          const ratio = current.amount > 0 ? tokenAmount / current.amount : 0;
          current.amount -= tokenAmount;
          current.costBasis -= current.costBasis * ratio;
        }
        positionsMap.set(trade.mint_address, current);
      });

      // Filter to positive positions
      const activePositions = Array.from(positionsMap.entries())
        .filter(([_, pos]) => pos.amount > 0)
        .map(([mint]) => mint);

      if (activePositions.length === 0) {
        setHoldings([]);
        setLoadingHoldings(false);
        return;
      }

      // Fetch token details
      const { data: tokens, error: tokensError } = await supabase
        .from("tokens")
        .select("mint_address, name, symbol, sol_reserves, token_reserves, audio_url, cover_image_url, audio_clip_id")
        .in("mint_address", activePositions);

      if (tokensError) throw tokensError;

      // Fetch actual on-chain balances and build holdings
      const holdingsPromises = tokens?.map(async (token) => {
        const mintPubkey = new PublicKey(token.mint_address);
        let balance = 0;

        try {
          const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
          const accountInfo = await getAccount(connection, ata);
          balance = Number(accountInfo.amount) / 1e9;
        } catch {
          balance = 0;
        }

        if (balance <= 0) return null;

        const solReserves = Number(token.sol_reserves || 0) / 1e9;
        const tokenReserves = Number(token.token_reserves || 0) / 1e9;
        const price = tokenReserves > 0 ? solReserves / tokenReserves : 0;
        const value = balance * price;

        const position = positionsMap.get(token.mint_address);
        const costBasis = position?.costBasis || 0;
        const pnl = value - costBasis;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

        // Get image - fallback to audio_clips
        let imageUrl = token.cover_image_url;
        if (!imageUrl && token.audio_clip_id) {
          const { data: clip } = await supabase
            .from("audio_clips")
            .select("cover_image_url")
            .eq("id", token.audio_clip_id)
            .maybeSingle();
          imageUrl = clip?.cover_image_url || undefined;
        }

        return {
          mint_address: token.mint_address,
          name: token.name,
          symbol: token.symbol,
          balance,
          price,
          value,
          pnl,
          pnlPercent,
          audioUrl: token.audio_url,
          imageUrl,
        } as TokenHolding;
      }) || [];

      const resolvedHoldings = (await Promise.all(holdingsPromises)).filter(Boolean) as TokenHolding[];
      setHoldings(resolvedHoldings.sort((a, b) => b.value - a.value));
    } catch (error) {
      console.error("Error fetching holdings:", error);
      toast.error("Failed to load portfolio");
    } finally {
      setLoadingHoldings(false);
    }
  }, [publicKey, connection]);

  // Fetch creator earnings
  const fetchCreatorEarnings = useCallback(async () => {
    if (!publicKey) {
      setCreatorEarnings([]);
      setTotalCreatorEarnings(0);
      return;
    }

    setLoadingEarnings(true);
    const walletAddress = publicKey.toBase58();

    try {
      // Get all earnings for this wallet
      const { data: earnings, error } = await supabase
        .from("creator_earnings")
        .select("mint_address, amount_lamports")
        .eq("wallet_address", walletAddress);

      if (error) throw error;

      if (!earnings || earnings.length === 0) {
        setCreatorEarnings([]);
        setTotalCreatorEarnings(0);
        setLoadingEarnings(false);
        return;
      }

      // Group by mint address
      const earningsMap = new Map<string, { total: number; count: number }>();
      let total = 0;

      earnings.forEach((e) => {
        const current = earningsMap.get(e.mint_address) || { total: 0, count: 0 };
        const amount = Number(e.amount_lamports) / 1e9;
        current.total += amount;
        current.count += 1;
        total += amount;
        earningsMap.set(e.mint_address, current);
      });

      // Fetch token details
      const mintAddresses = Array.from(earningsMap.keys());
      const { data: tokens } = await supabase
        .from("tokens")
        .select("mint_address, name, symbol")
        .in("mint_address", mintAddresses);

      const earningsList: CreatorEarning[] = mintAddresses.map((mint) => {
        const earningData = earningsMap.get(mint)!;
        const token = tokens?.find((t) => t.mint_address === mint);
        return {
          mint_address: mint,
          token_name: token?.name || "Unknown",
          token_symbol: token?.symbol || "???",
          total_earnings: earningData.total,
          trade_count: earningData.count,
        };
      });

      setCreatorEarnings(earningsList.sort((a, b) => b.total_earnings - a.total_earnings));
      setTotalCreatorEarnings(total);
    } catch (error) {
      console.error("Error fetching creator earnings:", error);
    } finally {
      setLoadingEarnings(false);
    }
  }, [publicKey]);

  // Fetch vesting summary
  const fetchVestingSummary = useCallback(async () => {
    if (!publicKey) {
      setVestingSummary(null);
      return;
    }

    setLoadingVesting(true);
    const walletAddress = publicKey.toBase58();

    try {
      const { data: vestings, error } = await supabase
        .from("token_vesting")
        .select("*")
        .eq("wallet_address", walletAddress)
        .eq("claimed", false);

      if (error) throw error;

      if (!vestings || vestings.length === 0) {
        setVestingSummary(null);
        setLoadingVesting(false);
        return;
      }

      const now = new Date();
      let totalVesting = 0;
      let totalClaimable = 0;
      let nextClaimDays: number | null = null;

      vestings.forEach((v) => {
        const startTime = new Date(v.vesting_start).getTime();
        const nowTime = now.getTime();
        const vestingDurationMs = (v.vesting_duration_days || 21) * 24 * 60 * 60 * 1000;
        
        const elapsed = Math.max(0, nowTime - startTime);
        const percentVested = Math.min(100, (elapsed / vestingDurationMs) * 100);
        const totalVestedNow = Math.floor((v.token_amount * percentVested) / 100);
        const claimable = Math.max(0, totalVestedNow - (v.total_claimed || 0));
        
        totalVesting += v.token_amount - (v.total_claimed || 0);
        totalClaimable += claimable;

        // Calculate days until fully vested
        const daysRemaining = Math.max(0, Math.ceil((vestingDurationMs - elapsed) / (1000 * 60 * 60 * 24)));
        if (nextClaimDays === null || daysRemaining < nextClaimDays) {
          nextClaimDays = daysRemaining;
        }
      });

      setVestingSummary({
        totalVesting: totalVesting / 1e9,
        totalClaimable: totalClaimable / 1e9,
        activeCount: vestings.length,
        nextClaimDays,
      });
    } catch (error) {
      console.error("Error fetching vesting summary:", error);
    } finally {
      setLoadingVesting(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchHoldings();
    fetchNotificationPrefs();
    fetchCreatorEarnings();
    fetchVestingSummary();
  }, [fetchHoldings, fetchNotificationPrefs, fetchCreatorEarnings, fetchVestingSummary]);

  // Audio playback
  const toggleAudio = (mintAddress: string, audioUrl?: string) => {
    if (!audioUrl) {
      toast.error("No audio available for this token");
      return;
    }

    if (playingAudio === mintAddress) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setPlayingAudio(null);
      audioRef.current.onerror = () => {
        toast.error("Failed to load audio");
        setPlayingAudio(null);
      };
      audioRef.current.play().catch(() => {
        toast.error("Failed to play audio");
        setPlayingAudio(null);
      });
      setPlayingAudio(mintAddress);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
  const totalValueUsd = solUsdPrice ? totalValue * solUsdPrice : 0;
  const solBalanceUsd = solUsdPrice && solBalance !== null ? solBalance * solUsdPrice : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-20 pb-24 md:pb-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Portfolio</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchHoldings();
                fetchCreatorEarnings();
                refetchBalance();
              }}
              disabled={loadingHoldings || loadingEarnings}
            >
              {loadingHoldings || loadingEarnings ? (
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
                <p className="text-muted-foreground">Connect your wallet to view your portfolio</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Wallet Balance Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Wallet Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    {balanceLoading ? (
                      <Skeleton className="h-8 w-32" />
                    ) : (
                      <>
                        <span className="text-3xl font-bold">{solBalance?.toFixed(4) ?? "0"}</span>
                        <span className="text-muted-foreground">SOL</span>
                      </>
                    )}
                  </div>
                  {solUsdPrice && solBalance !== null && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ≈ ${solBalanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Portfolio Summary */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Holdings Value
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingHoldings ? (
                      <Skeleton className="h-7 w-24" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold">{totalValue.toFixed(4)} SOL</p>
                        {solUsdPrice && (
                          <p className="text-sm text-muted-foreground">≈ ${totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total P&L
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingHoldings ? (
                      <Skeleton className="h-7 w-24" />
                    ) : (
                      <div className={`flex items-center gap-1 ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {totalPnl >= 0 ? (
                          <TrendingUp className="w-5 h-5" />
                        ) : (
                          <TrendingDown className="w-5 h-5" />
                        )}
                        <span className="text-2xl font-bold">
                          {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(4)} SOL
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Creator Earnings */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Coins className="w-4 h-4 text-primary" />
                    Creator Earnings (0.6% from trades)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingEarnings ? (
                    <Skeleton className="h-7 w-24" />
                  ) : totalCreatorEarnings > 0 ? (
                    <div>
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-2xl font-bold text-green-500">+{totalCreatorEarnings.toFixed(6)}</span>
                        <span className="text-muted-foreground">SOL</span>
                        {solUsdPrice && (
                          <span className="text-sm text-muted-foreground">
                            (≈ ${(totalCreatorEarnings * solUsdPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </span>
                        )}
                      </div>
                      {creatorEarnings.length > 0 && (
                        <div className="space-y-2">
                          {creatorEarnings.map((earning) => (
                            <div 
                              key={earning.mint_address}
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            >
                              <div>
                                <span className="font-medium">{earning.token_name}</span>
                                <span className="text-xs text-muted-foreground ml-2">${earning.token_symbol}</span>
                              </div>
                              <div className="text-right">
                                <p className="text-green-500 font-medium">+{earning.total_earnings.toFixed(6)} SOL</p>
                                <p className="text-xs text-muted-foreground">{earning.trade_count} trades</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Create tokens to earn 0.6% from every trade
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Vesting Summary */}
              {vestingSummary && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      Token Vesting
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingVesting ? (
                      <Skeleton className="h-7 w-24" />
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold">{vestingSummary.totalVesting.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Tokens vesting</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-green-500">
                              {vestingSummary.totalClaimable.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">Claimable now</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Timer className="w-4 h-4" />
                          <span>
                            {vestingSummary.activeCount} active schedule{vestingSummary.activeCount !== 1 ? 's' : ''}
                            {vestingSummary.nextClaimDays !== null && vestingSummary.nextClaimDays > 0 && (
                              <> · {vestingSummary.nextClaimDays} days remaining</>
                            )}
                          </span>
                        </div>
                        
                        <Link to="/vesting">
                          <Button variant="outline" size="sm" className="w-full">
                            View & Claim Tokens
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Notification Preferences */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {notificationsEnabled ? (
                        <Bell className="w-5 h-5 text-primary" />
                      ) : (
                        <BellOff className="w-5 h-5 text-muted-foreground" />
                      )}
                      <div>
                        <Label htmlFor="notifications" className="font-medium">
                          Price Alerts
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when your holdings move 5%+
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="notifications"
                      checked={notificationsEnabled}
                      onCheckedChange={toggleNotifications}
                      disabled={loadingPrefs}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Holdings List */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Holdings</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingHoldings ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : holdings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No token holdings yet</p>
                      <Button
                        variant="link"
                        onClick={() => navigate("/explore?tab=tokens")}
                        className="mt-2"
                      >
                        Explore tokens to trade
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {holdings.map((holding) => (
                        <div
                          key={holding.mint_address}
                          className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          {/* Token Image */}
                          <div className="relative">
                            {holding.imageUrl ? (
                              <img
                                src={holding.imageUrl}
                                alt={holding.name}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <span className="text-lg">🎵</span>
                              </div>
                            )}
                            {/* Play button overlay */}
                            <button
                              onClick={() => toggleAudio(holding.mint_address, holding.audioUrl)}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 hover:opacity-100 transition-opacity"
                            >
                              {playingAudio === holding.mint_address ? (
                                <Pause className="w-5 h-5 text-white" />
                              ) : (
                                <Play className="w-5 h-5 text-white" />
                              )}
                            </button>
                          </div>

                          {/* Token Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{holding.name}</span>
                              <span className="text-xs text-muted-foreground">${holding.symbol}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {holding.balance.toFixed(2)} tokens
                            </div>
                          </div>

                          {/* Value & P&L */}
                          <div className="text-right">
                            <p className="font-medium">{holding.value.toFixed(4)} SOL</p>
                            <div className={`text-sm flex items-center justify-end gap-1 ${
                              holding.pnl >= 0 ? "text-green-500" : "text-red-500"
                            }`}>
                              {holding.pnl >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              <span>{holding.pnl >= 0 ? "+" : ""}{holding.pnlPercent.toFixed(1)}%</span>
                            </div>
                          </div>

                          {/* Trade Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/trade?mint=${holding.mint_address}`)}
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      <MobileTabBar />
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
};

export default Portfolio;