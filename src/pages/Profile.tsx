import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { BadgeLevel } from "@/lib/solana/metaplex";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  User, Trophy, Star, Zap, TrendingUp, Medal, Crown, 
  Copy, Users, ArrowUpRight, ArrowDownLeft, Clock, Coins,
  Loader2, Check, Download, Share2, X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [username, setUsername] = useState("");
  const [referralInput, setReferralInput] = useState("");
  const [mintingBadge, setMintingBadge] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const [applyingReferral, setApplyingReferral] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

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

  const mintBadgeNFTHandler = async (badge: Badge) => {
    if (!publicKey || !badge.earned || badge.minted) return;
    
    setMintingBadge(badge.level);
    try {
      const walletAddress = publicKey.toString();
      
      // Create metadata on IPFS and register badge
      toast.info("Creating badge NFT...");
      const { data: metadataResult, error: metadataError } = await supabase.functions.invoke(
        'create-badge-metadata',
        {
          body: { badgeLevel: badge.level, walletAddress },
        }
      );

      if (metadataError || !metadataResult?.success) {
        throw new Error(metadataResult?.error || metadataError?.message || 'Failed to create badge');
      }

      // Generate a unique badge ID for the mint address
      const mintAddress = `badge_${badge.level}_${Date.now()}_${walletAddress.slice(0, 8)}`;
      const imageUrl = metadataResult.imageUrl;

      // Update database with badge info including image URL
      await supabase
        .from("user_badges")
        .update({ 
          minted: true, 
          minted_at: new Date().toISOString(),
          mint_address: mintAddress,
          image_url: imageUrl
        } as any)
        .eq("wallet_address", walletAddress)
        .eq("badge_level", badge.level);

      const updatedBadge = { ...badge, minted: true, mint_address: mintAddress, image_url: imageUrl };
      setBadges(badges.map((b) => 
        b.level === badge.level ? updatedBadge : b
      ));
      
      // Show the badge modal after successful mint
      setSelectedBadge(updatedBadge);
      
      toast.success(`${badge.name} badge created!`);
    } catch (error: unknown) {
      console.error("Error creating badge:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create badge";
      toast.error(errorMessage);
    } finally {
      setMintingBadge(null);
    }
  };

  const shareToX = async (badge: Badge) => {
    // First download the badge image
    if (badge.image_url) {
      try {
        toast.info("Downloading badge image for your tweet...");
        const response = await fetch(badge.image_url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `noizlabs-${badge.level}-badge.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("Badge downloaded! Attach it to your tweet.");
      } catch (error) {
        console.error("Error downloading badge:", error);
      }
    }
    
    // Open Twitter with the tweet text
    const text = `🎉 I just earned the ${badge.name} Badge on NoizLabs! 🏆\n\nJoin the sound revolution and start earning badges too!\n\n#NoizLabs #Web3 #Solana #NFT`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(tweetUrl, '_blank');
  };

  const downloadBadge = async (badge: Badge) => {
    if (!badge.image_url) {
      toast.error("Badge image not available");
      return;
    }
    
    try {
      toast.info("Downloading badge...");
      const response = await fetch(badge.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noizlabs-${badge.level}-badge.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Badge downloaded!");
    } catch (error) {
      console.error("Error downloading badge:", error);
      toast.error("Failed to download badge");
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
      <div className="min-h-screen bg-background">
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
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 pb-20 min-h-screen">
          <div className="container mx-auto px-4 text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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

              {/* Referral Code */}
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-foreground">Referral Program</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm">Your Referral Code</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={userStats?.referral_code || ""}
                        readOnly
                        className="font-mono"
                      />
                      <Button size="icon" variant="outline" onClick={copyReferralCode}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {!userStats?.referred_by && (
                    <div>
                      <Label className="text-sm">Enter Referral Code</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={referralInput}
                          onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                          placeholder="XXXXXXXX"
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
                      Referred by: <span className="font-mono">{userStats.referred_by}</span>
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

            {/* Middle Column - Badges */}
            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-muted p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Medal className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-foreground">Badge NFTs</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Earn badges and mint them as NFTs
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
                            ? badge.minted 
                              ? "bg-primary/10 border-primary/30 cursor-pointer hover:bg-primary/15 transition-colors" 
                              : "bg-card border-border"
                            : "bg-muted/50 border-border/50 opacity-50"
                        }`}
                        onClick={() => badge.minted && setSelectedBadge(badge)}
                      >
                        <div className="flex items-center gap-4">
                          {badge.minted && badge.image_url ? (
                            <img 
                              src={badge.image_url} 
                              alt={badge.name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-primary/30"
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded-full ${badgeDef?.bgColor} flex items-center justify-center`}>
                              <Icon className={`w-6 h-6 ${badge.color}`} />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-bold text-foreground">{badge.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {badge.minPoints.toLocaleString()}+ points required
                            </p>
                          </div>
                          {badge.earned && (
                            badge.minted ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); shareToX(badge); }}
                                  title="Share to X"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); downloadBadge(badge); }}
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => mintBadgeNFTHandler(badge)}
                                disabled={mintingBadge === badge.level}
                              >
                                {mintingBadge === badge.level ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Coins className="w-4 h-4 mr-1" />
                                    Mint NFT
                                  </>
                                )}
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
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

      {/* Badge Detail Modal */}
      <Dialog open={!!selectedBadge} onOpenChange={() => setSelectedBadge(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">{selectedBadge?.name} Badge</DialogTitle>
          </DialogHeader>
          {selectedBadge && (
            <div className="flex flex-col items-center gap-6 py-4">
              {selectedBadge.image_url ? (
                <img 
                  src={selectedBadge.image_url} 
                  alt={selectedBadge.name}
                  className="w-64 h-64 rounded-xl border-2 border-primary/30 shadow-lg"
                />
              ) : (
                <div className="w-64 h-64 rounded-xl bg-muted flex items-center justify-center">
                  <selectedBadge.icon className={`w-24 h-24 ${selectedBadge.color}`} />
                </div>
              )}
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  {selectedBadge.minPoints.toLocaleString()}+ points required
                </p>
                <p className="text-xs text-muted-foreground">
                  Minted as NFT
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <Button 
                  className="flex-1" 
                  onClick={() => shareToX(selectedBadge)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Share to X
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => downloadBadge(selectedBadge)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
