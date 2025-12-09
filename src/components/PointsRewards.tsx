import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Zap, TrendingUp, Music, Coins, RefreshCw, Clock } from "lucide-react";

interface Task {
  id: string;
  task_type: string;
  progress: number;
  target: number;
  points_reward: number;
  completed: boolean;
  reset_period: string;
  last_reset: string;
}

interface UserPoints {
  total_points: number;
}

const TASK_LABELS: Record<string, { label: string; icon: any }> = {
  interact_clips: { label: "Interact with 20 audio clips", icon: Music },
  upload_clips: { label: "Upload 2 clips", icon: Zap },
  mint_token: { label: "Mint 1 token", icon: Coins },
  trading_500: { label: "Complete $500 trading volume", icon: TrendingUp },
  trading_1000: { label: "Complete $1000 trading volume", icon: TrendingUp },
  trading_2000: { label: "Complete $2000 trading volume", icon: TrendingUp },
  trading_2000_weekly: { label: "Complete $2000 trading volume", icon: TrendingUp },
  trade_5_tokens: { label: "Trade 5 tokens", icon: Star },
};

const PointsRewards = () => {
  const { publicKey } = useWallet();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeUntilReset, setTimeUntilReset] = useState("");

  useEffect(() => {
    if (publicKey) {
      fetchUserData();
    }
  }, [publicKey]);

  // Update countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilReset(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchUserData = async () => {
    if (!publicKey) return;
    
    const walletAddress = publicKey.toString();
    setLoading(true);

    try {
      // Get user points
      const { data: points } = await supabase
        .from("user_points")
        .select("total_points")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      setUserPoints({ total_points: points?.total_points || 0 });

      // Get tasks
      const { data: userTasks } = await supabase
        .from("user_tasks")
        .select("*")
        .eq("wallet_address", walletAddress);

      setTasks(userTasks || []);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time updates for tasks and points
  useEffect(() => {
    if (!publicKey) return;

    const walletAddress = publicKey.toString();

    const channel = supabase
      .channel('user-rewards-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_tasks',
          filter: `wallet_address=eq.${walletAddress}`
        },
        (payload) => {
          const updated = payload.new as Task;
          setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_points',
          filter: `wallet_address=eq.${walletAddress}`
        },
        (payload) => {
          const updated = payload.new as any;
          setUserPoints({ total_points: updated.total_points || 0 });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [publicKey]);

  const getTaskInfo = (taskType: string) => {
    return TASK_LABELS[taskType] || { label: taskType, icon: Star };
  };

  if (!publicKey) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Connect wallet to view rewards</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center">
        <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading rewards...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-primary p-4 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6" />
            <h3 className="font-bold text-lg">Daily Quests</h3>
          </div>
          <div className="flex items-center gap-2 bg-background/20 px-4 py-2 rounded-full">
            <Star className="w-5 h-5" />
            <span className="font-bold text-xl">{userPoints?.total_points?.toLocaleString() || 0}</span>
            <span className="text-sm">pts</span>
          </div>
        </div>
        {/* Reset Timer */}
        <div className="flex items-center gap-2 mt-3 text-sm text-primary-foreground/80">
          <Clock className="w-4 h-4" />
          <span>Resets in {timeUntilReset}</span>
        </div>
      </div>

      {/* Auto-claim notice */}
      <div className="px-4 py-2 bg-accent/10 border-b border-border">
        <p className="text-xs text-muted-foreground text-center">
          ✨ Points are automatically claimed when you complete a quest!
        </p>
      </div>

      {/* Tasks */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No quests available. Start interacting to see your progress!
          </p>
        ) : (
          tasks.map((task) => {
            const info = getTaskInfo(task.task_type);
            const Icon = info.icon;
            const progressPercent = Math.min((task.progress / task.target) * 100, 100);

            return (
              <div
                key={task.id}
                className={`p-4 rounded-lg border transition-all ${
                  task.completed 
                    ? "bg-primary/10 border-primary/30" 
                    : "bg-muted border-border"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${task.completed ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-medium text-foreground text-sm">{info.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Daily • +{task.points_reward} pts
                      </p>
                    </div>
                  </div>
                  {task.completed && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
                      ✓ Claimed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={progressPercent} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground min-w-[60px] text-right">
                    {task.progress.toLocaleString()}/{task.target.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PointsRewards;
