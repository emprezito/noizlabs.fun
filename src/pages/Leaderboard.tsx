import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PointsRewards from "@/components/PointsRewards";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, Medal, Star, Users, Zap, TrendingUp, Music, Clock, Calendar, Play, Heart, Share2, Award, ExternalLink } from "lucide-react";

interface LeaderboardUser {
  wallet_address: string;
  total_points: number;
  rank: number;
}

interface TopClip {
  id: string;
  title: string;
  creator: string;
  cover_image_url: string | null;
  likes: number;
  plays: number;
  shares: number;
  total_engagement: number;
}

interface MintedWinner {
  id: string;
  name: string;
  symbol: string;
  mint_address: string;
  created_at: string;
  audio_url: string | null;
  audio_clip: {
    title: string;
    creator: string;
    cover_image_url: string | null;
    likes: number;
    plays: number;
    shares: number;
  } | null;
}

const BADGES = [
  { minPoints: 0, name: "Newcomer", icon: Star, color: "text-muted-foreground" },
  { minPoints: 500, name: "Explorer", icon: Zap, color: "text-blue-500" },
  { minPoints: 2000, name: "Enthusiast", icon: TrendingUp, color: "text-green-500" },
  { minPoints: 5000, name: "Champion", icon: Medal, color: "text-yellow-500" },
  { minPoints: 10000, name: "Legend", icon: Crown, color: "text-purple-500" },
  { minPoints: 25000, name: "Elite", icon: Trophy, color: "text-orange-500" },
];

const getBadge = (points: number) => {
  for (let i = BADGES.length - 1; i >= 0; i--) {
    if (points >= BADGES[i].minPoints) {
      return BADGES[i];
    }
  }
  return BADGES[0];
};

// Calculate time until Sunday midnight UTC
const getCountdownToSunday = () => {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sunday
  
  // Calculate days until next Sunday
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  
  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(0, 0, 0, 0);
  
  const diff = nextSunday.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isSunday: true };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds, isSunday: false };
};

const LeaderboardPage = () => {
  const { publicKey } = useWallet();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [topClips, setTopClips] = useState<TopClip[]>([]);
  const [loadingClips, setLoadingClips] = useState(true);
  const [countdown, setCountdown] = useState(getCountdownToSunday());
  const [pastWinners, setPastWinners] = useState<MintedWinner[]>([]);
  const [loadingWinners, setLoadingWinners] = useState(true);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getCountdownToSunday());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    fetchWeeklyTopClips();
    fetchPastWinners();
  }, [publicKey]);

  const fetchPastWinners = async () => {
    try {
      // Get tokens that were minted from audio clips (winners)
      const { data, error } = await supabase
        .from("tokens")
        .select(`
          id,
          name,
          symbol,
          mint_address,
          created_at,
          audio_url,
          audio_clips:audio_clip_id (
            title,
            creator,
            cover_image_url,
            likes,
            plays,
            shares
          )
        `)
        .not("audio_clip_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const winners = (data || []).map((token: any) => ({
        ...token,
        audio_clip: token.audio_clips,
      }));

      setPastWinners(winners);
    } catch (error) {
      console.error("Error fetching past winners:", error);
    } finally {
      setLoadingWinners(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from("user_points")
        .select("wallet_address, total_points")
        .order("total_points", { ascending: false })
        .limit(100);

      if (error) throw error;

      const rankedData: LeaderboardUser[] = (data || []).map((user, index) => ({
        ...user,
        total_points: user.total_points || 0,
        rank: index + 1,
      }));

      setLeaderboard(rankedData);

      if (publicKey) {
        const userEntry = rankedData.find(
          (u) => u.wallet_address === publicKey.toString()
        );
        if (userEntry) {
          setUserRank(userEntry);
        }
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyTopClips = async () => {
    try {
      // Get current week's Monday
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const monday = new Date(now);
      if (dayOfWeek === 0) {
        monday.setUTCDate(now.getUTCDate() - 6);
      } else {
        monday.setUTCDate(now.getUTCDate() - (dayOfWeek - 1));
      }
      monday.setUTCHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("audio_clips")
        .select("*")
        .gte("created_at", monday.toISOString())
        .order("likes", { ascending: false })
        .limit(5);

      if (error) throw error;

      const clipsWithEngagement = (data || []).map(clip => ({
        ...clip,
        total_engagement: (clip.likes || 0) + (clip.plays || 0) + (clip.shares || 0),
      })).sort((a, b) => b.total_engagement - a.total_engagement);

      setTopClips(clipsWithEngagement);
    } catch (error) {
      console.error("Error fetching weekly clips:", error);
    } finally {
      setLoadingClips(false);
    }
  };

  const formatWallet = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center font-bold text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20 min-h-screen">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-4">
              <Trophy className="w-10 h-10 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Leaderboard
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Top earners in the NoizLabs community
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Leaderboard */}
            <div className="lg:col-span-2 space-y-6">
              {/* User's Current Rank */}
              {userRank && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                        #{userRank.rank}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">Your Ranking</p>
                        <p className="text-sm text-muted-foreground">
                          {formatWallet(userRank.wallet_address)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {userRank.total_points.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">points</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Top 3 Podium */}
              {leaderboard.length >= 3 && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {/* 2nd Place */}
                  <div className="bg-card rounded-xl border border-border p-4 text-center order-1">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gray-400/20 flex items-center justify-center mb-3">
                      <Medal className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="font-bold text-foreground truncate">
                      {formatWallet(leaderboard[1].wallet_address)}
                    </p>
                    <p className="text-xl font-bold text-muted-foreground">
                      {leaderboard[1].total_points.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">2nd Place</p>
                  </div>

                  {/* 1st Place */}
                  <div className="bg-gradient-to-b from-yellow-500/20 to-card rounded-xl border-2 border-yellow-500/50 p-4 text-center order-0 lg:order-1 transform lg:-translate-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center mb-3">
                      <Crown className="w-10 h-10 text-yellow-500" />
                    </div>
                    <p className="font-bold text-foreground truncate">
                      {formatWallet(leaderboard[0].wallet_address)}
                    </p>
                    <p className="text-2xl font-bold text-yellow-500">
                      {leaderboard[0].total_points.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">🏆 1st Place</p>
                  </div>

                  {/* 3rd Place */}
                  <div className="bg-card rounded-xl border border-border p-4 text-center order-2">
                    <div className="w-16 h-16 mx-auto rounded-full bg-amber-600/20 flex items-center justify-center mb-3">
                      <Medal className="w-8 h-8 text-amber-600" />
                    </div>
                    <p className="font-bold text-foreground truncate">
                      {formatWallet(leaderboard[2].wallet_address)}
                    </p>
                    <p className="text-xl font-bold text-muted-foreground">
                      {leaderboard[2].total_points.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">3rd Place</p>
                  </div>
                </div>
              )}

              {/* Full Leaderboard */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-muted p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-bold text-foreground">All Rankings</h3>
                  </div>
                </div>

                {loading ? (
                  <div className="p-8 text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading rankings...</p>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="p-8 text-center">
                    <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No rankings yet. Be the first!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {leaderboard.map((user) => {
                      const badge = getBadge(user.total_points);
                      const BadgeIcon = badge.icon;
                      const isCurrentUser = publicKey?.toString() === user.wallet_address;

                      return (
                        <div
                          key={user.wallet_address}
                          className={`p-4 flex items-center gap-4 transition-colors hover:bg-muted/50 ${
                            isCurrentUser ? "bg-primary/5" : ""
                          }`}
                        >
                          {/* Rank */}
                          <div className="w-10 flex-shrink-0 flex justify-center">
                            {getRankDisplay(user.rank)}
                          </div>

                          {/* Badge */}
                          <div className={`w-8 flex-shrink-0 ${badge.color}`}>
                            <BadgeIcon className="w-5 h-5" />
                          </div>

                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold truncate ${isCurrentUser ? "text-primary" : "text-foreground"}`}>
                              {formatWallet(user.wallet_address)}
                              {isCurrentUser && <span className="ml-2 text-xs">(You)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{badge.name}</p>
                          </div>

                          {/* Points */}
                          <div className="text-right">
                            <p className="font-bold text-foreground">
                              {user.total_points.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">pts</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Weekly Clips & Rewards */}
            <div className="space-y-6">
              {/* Weekly Top Clips Countdown */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-gradient-to-r from-primary/20 to-accent/20 p-4 border-b border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-foreground">Weekly Top Clips</h3>
                  </div>
                  {countdown.isSunday ? (
                    <div className="flex items-center gap-2 text-primary">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm font-semibold">📸 Snapshot Day!</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Snapshot in:</span>
                    </div>
                  )}
                </div>
                
                {!countdown.isSunday && (
                  <div className="p-4 bg-muted/50">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-background rounded-lg p-2">
                        <p className="text-2xl font-bold text-primary">{countdown.days}</p>
                        <p className="text-xs text-muted-foreground">Days</p>
                      </div>
                      <div className="bg-background rounded-lg p-2">
                        <p className="text-2xl font-bold text-primary">{countdown.hours}</p>
                        <p className="text-xs text-muted-foreground">Hours</p>
                      </div>
                      <div className="bg-background rounded-lg p-2">
                        <p className="text-2xl font-bold text-primary">{countdown.minutes}</p>
                        <p className="text-xs text-muted-foreground">Mins</p>
                      </div>
                      <div className="bg-background rounded-lg p-2">
                        <p className="text-2xl font-bold text-primary">{countdown.seconds}</p>
                        <p className="text-xs text-muted-foreground">Secs</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {loadingClips ? (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : topClips.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-4">
                      No clips uploaded this week yet
                    </p>
                  ) : (
                    topClips.map((clip, index) => (
                      <div
                        key={clip.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate("/discover")}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? "bg-yellow-500 text-yellow-950" :
                          index === 1 ? "bg-gray-400 text-gray-900" :
                          index === 2 ? "bg-amber-600 text-amber-950" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {index + 1}
                        </div>
                        {clip.cover_image_url ? (
                          <img
                            src={clip.cover_image_url}
                            alt={clip.title}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Music className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate text-foreground">{clip.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Heart className="w-3 h-3" /> {clip.likes}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Play className="w-3 h-3" /> {clip.plays}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-primary">{clip.total_engagement}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 pt-0">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/discover")}
                  >
                    Upload & Compete
                  </Button>
                </div>
              </div>

              <PointsRewards />

              {/* Past Winners Archive */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-bold text-foreground">Hall of Fame</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Past winning clips minted as tokens</p>
                </div>
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                  {loadingWinners ? (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : pastWinners.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-4">
                      No winners minted yet. Check back after Sunday!
                    </p>
                  ) : (
                    pastWinners.map((winner) => (
                      <div
                        key={winner.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/trade?mint=${winner.mint_address}`)}
                      >
                        {winner.audio_clip?.cover_image_url ? (
                          <img
                            src={winner.audio_clip.cover_image_url}
                            alt={winner.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-yellow-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate text-foreground">{winner.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ${winner.symbol} • {new Date(winner.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Badge Guide */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-muted p-4 border-b border-border">
                  <h3 className="font-bold text-foreground">Badge Levels</h3>
                </div>
                <div className="p-4 space-y-3">
                  {BADGES.map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <div key={badge.name} className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${badge.color}`} />
                        <div className="flex-1">
                          <p className="font-medium text-foreground text-sm">{badge.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {badge.minPoints.toLocaleString()}+ pts
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LeaderboardPage;
