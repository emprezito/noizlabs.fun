import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { supabase } from "@/integrations/supabase/client";
import { BadgeLevel } from "@/lib/solana/metaplex";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { clearMobileWalletCache } from "@/components/WalletButton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  User, Trophy, Star, Zap, TrendingUp, Medal, Crown, 
  Copy, Users, ArrowUpRight, ArrowDownLeft, Clock,
  Loader2, Wallet, Droplets, RefreshCw
} from "lucide-react";

interface UserStats {
  total_points: number;
  referral_code: string | null;
  referred_by: string | null;
  username: string | null;
  referral_earnings: number;
}

interface Badge {
  level: string;
  name: string;
  minPoints: number;
  icon: typeof Star;
  color: string;
  earned: boolean;
  minted: boolean;
  mint_address?: string;
  image_url?: string;
}

interface TradeRecord {
  id: string;
  mint_address: string;
  trade_type: string;
  amount: number;
  price_lamports: number;
  created_at: string;
}

interface Referral {
  wallet_address: string;
  username: string | null;
  total_points: number;
}

const BADGE_DEFINITIONS = [
  { level: "newcomer", name: "Newcomer", minPoints: 0, icon: Star, color: "text-muted-foreground", bgColor: "bg-muted" },
  { level: "explorer", name: "Explorer", minPoints: 500, icon: Zap, color: "text-blue-500", bgColor: "bg-blue-500/20" },
  { level: "enthusiast", name: "Enthusiast", minPoints: 2000, icon: TrendingUp, color: "text-green-500", bgColor: "bg-green-500/20" },
  { level: "champion", name: "Champion", minPoints: 5000, icon: Medal, color: "text-yellow-500", bgColor: "bg-yellow-500/20" },
  { level: "legend", name: "Legend", minPoints: 10000, icon: Crown, color: "text-purple-500", bgColor: "bg-purple-500/20" },
  { level: "elite", name: "Elite", minPoints: 25000, icon: Trophy, color: "text-orange-500", bgColor: "bg-orange-500/20" },
];

const ProfilePage = () => {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { balance, loading: balanceLoading, refetch: refetchBalance } = useWalletBalance();
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [username, setUsername] = useState("");
  const [referralInput, setReferralInput] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [applyingReferral, setApplyingReferral] = useState(false);
  const [requestingAirdrop, setRequestingAirdrop] = useState(false);

  useEffect(() => {
    if (connected && publicKey) {
      loadProfile();
    }
  }, [connected, publicKey]);

  const loadProfile = async () => {
    if (!publicKey) return;
    
    const walletAddress = publicKey.toString();
    setLoading(true);

    try {
      // Get or create user points
      let { data: pointsData } = await supabase
        .from("user_points")
        .select("*")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (!pointsData) {
        // Generate referral code
        const { data: codeData } = await supabase.rpc("generate_referral_code");
        
        const { data: newPoints } = await supabase
          .from("user_points")
          .insert({
            wallet_address: walletAddress,
            total_points: 0,
            referral_code: codeData || `${walletAddress.slice(0, 8).toUpperCase()}`,
          })
          .select()
          .single();
        
        pointsData = newPoints;
      } else if (!pointsData.referral_code) {
        // Generate referral code if missing
        const { data: codeData } = await supabase.rpc("generate_referral_code");
        
        await supabase
          .from("user_points")
          .update({ referral_code: codeData || `${walletAddress.slice(0, 8).toUpperCase()}` })
          .eq("wallet_address", walletAddress);
        
        pointsData.referral_code = codeData;
      }

      setUserStats({
        total_points: pointsData?.total_points || 0,
        referral_code: pointsData?.referral_code || null,
        referred_by: pointsData?.referred_by || null,
        username: pointsData?.username || null,
        referral_earnings: pointsData?.referral_earnings || 0,
      });
      setUsername(pointsData?.username || "");

      // Get earned badges
      const { data: earnedBadges } = await supabase
        .from("user_badges")
        .select("*")
        .eq("wallet_address", walletAddress);

      // Calculate which badges should be earned
      const points = pointsData?.total_points || 0;
      const badgesList: Badge[] = BADGE_DEFINITIONS.map((def) => {
        const earned = points >= def.minPoints;
        const existingBadge = earnedBadges?.find((b) => b.badge_level === def.level);
        
        // Auto-earn badges if not in DB
        if (earned && !existingBadge) {
          supabase.from("user_badges").insert({
            wallet_address: walletAddress,
            badge_level: def.level,
          }).then(() => {});
        }

        return {
          level: def.level,
          name: def.name,
          minPoints: def.minPoints,
          icon: def.icon,
          color: def.color,
          earned: earned,
          minted: existingBadge?.minted || false,
          mint_address: existingBadge?.mint_address || undefined,
          image_url: (existingBadge as any)?.image_url || undefined,
        };
      });
      setBadges(badgesList);

      // Get trade history
      const { data: tradeData } = await supabase
        .from("trade_history")
        .select("*")
        .eq("wallet_address", walletAddress)
        .order("created_at", { ascending: false })
        .limit(20);
      
      setTrades(tradeData || []);

      // Get referrals (people who used this user's code)
      if (pointsData?.referral_code) {
        const { data: referralData } = await supabase
          .from("user_points")
          .select("wallet_address, username, total_points")
          .eq("referred_by", pointsData.referral_code);
        
        setReferrals(referralData || []);
      }

    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const saveUsername = async () => {
    if (!publicKey || !username.trim()) return;
    
    setSavingUsername(true);
    try {
      await supabase
        .from("user_points")
        .update({ username: username.trim() })
        .eq("wallet_address", publicKey.toString());
      
      setUserStats((prev) => prev ? { ...prev, username: username.trim() } : null);
      toast.success("Username saved!");
    } catch (error) {
      toast.error("Failed to save username");
    } finally {
      setSavingUsername(false);
    }
  };

  const requestAirdrop = async () => {
    if (!publicKey) return;

    setRequestingAirdrop(true);
    try {
      const { data, error, response } = await supabase.functions.invoke("devnet-faucet", {
        body: { walletAddress: publicKey.toBase58() },
      });

      // Preferred path: backend returns 200 + rateLimited payload
      if (data?.rateLimited) {
        const minutes = typeof data.minutesRemaining === "number" ? data.minutesRemaining : null;
        const nextAllowedAt = typeof data.nextAllowedAt === "string" ? data.nextAllowedAt : null;

        if (minutes != null) {
          toast.error(
            `Please wait ${minutes} minute${minutes > 1 ? "s" : ""} before requesting again`
          );
          return;
        }

        if (nextAllowedAt) {
          const t = new Date(nextAllowedAt);
          toast.error(`Please wait until ${t.toLocaleTimeString()} to request again`);
          return;
        }

        toast.error("Rate limited. Please try again later.");
        return;
      }

      // If the backend responded with an error status (e.g. 429), Supabase returns:
      // - data: null
      // - error: FunctionsHttpError
      // - response: Response
      if (error) {
        const status = (response as any)?.status;

        // Handle 429 rate limit by reading the JSON body from the Response
        if (status === 429 && response) {
          let body: any = null;
          try {
            body = await (response as Response).clone().json();
          } catch {
            // ignore
          }

          const minutes = typeof body?.minutesRemaining === "number" ? body.minutesRemaining : null;
          const nextAllowedAt = typeof body?.nextAllowedAt === "string" ? body.nextAllowedAt : null;

          if (minutes != null) {
            toast.error(
              `Please wait ${minutes} minute${minutes > 1 ? "s" : ""} before requesting again`
            );
            return;
          }

          if (nextAllowedAt) {
            const t = new Date(nextAllowedAt);
            toast.error(`Please wait until ${t.toLocaleTimeString()} to request again`);
            return;
          }

          toast.error("Rate limited. Please try again later.");
          return;
        }

        const msg = (error as any)?.message ? String((error as any).message) : String(error);
        throw new Error(msg || "Faucet request failed");
      }

      // Backward-compatible handling (if the function ever returns 200 with an error payload)
      if (data?.error) {
        if (data.minutesRemaining) {
          toast.error(
            `Please wait ${data.minutesRemaining} minute${data.minutesRemaining > 1 ? "s" : ""} before requesting again`
          );
          return;
        }
        throw new Error(data.error);
      }

      const receivedAmount = data?.amount ?? 0.5;
      toast.success(`Received ${receivedAmount} SOL! (Devnet)`);
      setTimeout(() => refetchBalance(), 2000);
    } catch (error: any) {
      console.error("Faucet error:", error);
      // Final fallback check for rate limit in error message
      if (error.message?.includes("Rate limited") || error.message?.includes("429")) {
        toast.error("Please wait before requesting again. Limit: 1 request per hour.");
        return;
      }
      toast.error(error.message || "Faucet request failed. Try again later.");
    } finally {
      setRequestingAirdrop(false);
    }
  };

  const applyReferralCode = async () => {
    if (!publicKey || !referralInput.trim() || userStats?.referred_by) return;
    
    setApplyingReferral(true);
    try {
      // Check if code exists
      const { data: referrer } = await supabase
        .from("user_points")
        .select("wallet_address, referral_code")
        .eq("referral_code", referralInput.trim().toUpperCase())
        .maybeSingle();

      if (!referrer) {
        toast.error("Invalid referral code");
        return;
      }

      if (referrer.wallet_address === publicKey.toString()) {
        toast.error("You can't use your own referral code");
        return;
      }

      // Apply referral
      await supabase
        .from("user_points")
        .update({ referred_by: referralInput.trim().toUpperCase() })
        .eq("wallet_address", publicKey.toString());

      // Bonus points to user who applied the code
      const currentPoints = userStats?.total_points || 0;
      await supabase
        .from("user_points")
        .update({ total_points: currentPoints + 100 })
        .eq("wallet_address", publicKey.toString());

      setUserStats((prev) => prev ? { 
        ...prev, 
        referred_by: referralInput.trim().toUpperCase(),
        total_points: (prev.total_points || 0) + 100
      } : null);
      toast.success("Referral code applied! You earned 100 bonus points!");
      setReferralInput("");
    } catch (error) {
      toast.error("Failed to apply referral code");
    } finally {
      setApplyingReferral(false);
    }
  };

  const copyReferralCode = () => {
    if (userStats?.referral_code) {
      navigator.clipboard.writeText(userStats.referral_code);
      toast.success("Referral code copied!");
    }
  };


  const formatWallet = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatLamports = (lamports: number) => {
    return (lamports / 1e9).toFixed(4);
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background pb-16 md:pb-0">
        <Navbar />
        <main className="pt-24 pb-20 min-h-screen">
          <div className="container mx-auto px-4">
            <div className="max-w-md mx-auto text-center py-20">
              <User className="w-16 h-16 mx-auto mb-6 text-muted-foreground" />
              <h1 className="text-2xl font-bold text-foreground mb-4">Connect Wallet</h1>
              <p className="text-muted-foreground">
                Please connect your wallet to view your profile.
              </p>
            </div>
          </div>
        </main>
        <Footer />
        <MobileTabBar />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-16 md:pb-0">
        <Navbar />
        <main className="pt-24 pb-20 min-h-screen">
          <div className="container mx-auto px-4 text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </main>
        <Footer />
        <MobileTabBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Navbar />
      <main className="pt-24 pb-20 min-h-screen">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              My Profile
            </h1>
            <p className="text-muted-foreground">
              {formatWallet(publicKey?.toString() || "")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Stats & Settings */}
            <div className="space-y-6">
              {/* Points Card */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-primary p-6 text-primary-foreground text-center">
                  <Trophy className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-4xl font-bold">{userStats?.total_points?.toLocaleString() || 0}</p>
                  <p className="text-sm text-primary-foreground/80">Total Points</p>
                </div>
                
                {/* Referral Earnings */}
                {(userStats?.referral_earnings || 0) > 0 && (
                  <div className="bg-green-500/10 p-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Referral Earnings</span>
                      <span className="font-bold text-green-500">+{userStats?.referral_earnings?.toLocaleString() || 0} pts</span>
                    </div>
                  </div>
                )}
                
                <div className="p-4">
                  <Label className="text-sm">Username</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      maxLength={20}
                    />
                    <Button 
                      size="sm" 
                      onClick={saveUsername}
                      disabled={savingUsername || !username.trim()}
                    >
                      {savingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Wallet Balance & Faucet (Mobile-friendly) */}
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-foreground">Wallet</h3>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-bold text-foreground">
                    {balanceLoading ? "..." : `${balance?.toFixed(4) ?? "0"} SOL`}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestAirdrop}
                  disabled={requestingAirdrop}
                  className="w-full"
                >
                  {requestingAirdrop ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Droplets className="w-4 h-4 mr-2" />
                  )}
                  Get Devnet SOL
                </Button>

                {/* Switch Wallet */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearMobileWalletCache();
                    disconnect();
                    toast.success("Wallet disconnected");
                    setTimeout(() => setVisible(true), 150);
                  }}
                  className="w-full mt-2 text-muted-foreground"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Switch Wallet
                </Button>
              </div>

              {/* Referral Program */}
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-foreground">Referral Program</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm">Your Referral Code</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Share this code to earn bonus points when friends join!
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={userStats?.referral_code || ""}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button size="icon" variant="outline" onClick={copyReferralCode}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {!userStats?.referred_by && (
                    <div>
                      <Label className="text-sm">Enter Referral Code</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Have a friend's code? Enter it to earn 100 bonus points!
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={referralInput}
                          onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                          placeholder="Enter code"
                          maxLength={8}
                          className="font-mono"
                        />
                        <Button 
                          size="sm" 
                          onClick={applyReferralCode}
                          disabled={applyingReferral || !referralInput.trim()}
                        >
                          {applyingReferral ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {userStats?.referred_by && (
                    <p className="text-sm text-muted-foreground">
                      ✓ You were referred by someone
                    </p>
                  )}
                </div>
              </div>

              {/* Referrals List */}
              {referrals.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <h3 className="font-bold text-foreground mb-4">Your Referrals ({referrals.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {referrals.map((ref) => (
                      <div key={ref.wallet_address} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <span className="font-medium text-foreground text-sm">
                          {ref.username || formatWallet(ref.wallet_address)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {ref.total_points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Middle Column - Badges (Coming Soon) */}
            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-muted p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Medal className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-foreground">Badges</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Earn badges based on your activity
                  </p>
                </div>

                <div className="p-4 space-y-3">
                  {badges.map((badge) => {
                    const Icon = badge.icon;
                    const badgeDef = BADGE_DEFINITIONS.find((b) => b.level === badge.level);
                    
                    return (
                      <div
                        key={badge.level}
                        className={`p-4 rounded-lg border ${
                          badge.earned 
                            ? "bg-primary/10 border-primary/30"
                            : "bg-muted/50 border-border/50 opacity-50"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full ${badgeDef?.bgColor} flex items-center justify-center`}>
                            <Icon className={`w-6 h-6 ${badge.color}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-foreground">{badge.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {badge.minPoints.toLocaleString()}+ points required
                            </p>
                          </div>
                          {badge.earned && (
                            <span className="text-xs font-semibold text-primary bg-primary/20 px-2 py-1 rounded-full">
                              Earned ✓
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Coming Soon Notice */}
                  <div className="mt-4 p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">
                      🔒 NFT minting unlocks after testnet phase
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Trade History */}
            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-muted p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-foreground">Trade History</h3>
                  </div>
                </div>

                {trades.length === 0 ? (
                  <div className="p-8 text-center">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No trades yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border max-h-96 overflow-y-auto">
                    {trades.map((trade) => (
                      <div key={trade.id} className="p-4 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          trade.trade_type === "buy" ? "bg-green-500/20" : "bg-red-500/20"
                        }`}>
                          {trade.trade_type === "buy" ? (
                            <ArrowDownLeft className="w-5 h-5 text-green-500" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {formatWallet(trade.mint_address)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(trade.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${
                            trade.trade_type === "buy" ? "text-green-500" : "text-red-500"
                          }`}>
                            {trade.trade_type === "buy" ? "+" : "-"}{(trade.amount / 1e9).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatLamports(trade.price_lamports)} SOL
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <MobileTabBar />
    </div>
  );
};

export default ProfilePage;
