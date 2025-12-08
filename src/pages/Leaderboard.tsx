import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PointsRewards from "@/components/PointsRewards";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, Medal, Star, Users, Zap, TrendingUp } from "lucide-react";

interface LeaderboardUser {
  wallet_address: string;
  total_points: number;
  rank: number;
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

const LeaderboardPage = () => {
  const { publicKey } = useWallet();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [publicKey]);

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

      // Find current user's rank
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

            {/* Sidebar - Rewards & Tasks */}
            <div className="space-y-6">
              <PointsRewards />

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
