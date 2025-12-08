import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Zap, TrendingUp, Music, Coins, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Task {
  id: string;
  task_type: string;
  progress: number;
  target: number;
  points_reward: number;
  completed: boolean;
  reset_period: string;
}

interface UserPoints {
  total_points: number;
}

const TASK_DEFINITIONS = [
  { task_type: "interact_clips", target: 20, points_reward: 50, reset_period: "daily", label: "Interact with 20 audio clips", icon: Music },
  { task_type: "upload_clips", target: 2, points_reward: 100, reset_period: "daily", label: "Upload 2 clips", icon: Zap },
  { task_type: "mint_token", target: 1, points_reward: 200, reset_period: "daily", label: "Mint 1 token", icon: Coins },
  { task_type: "trading_500", target: 500, points_reward: 300, reset_period: "daily", label: "Complete $500 trading volume", icon: TrendingUp },
  { task_type: "trading_1000", target: 1000, points_reward: 500, reset_period: "daily", label: "Complete $1000 trading volume daily", icon: TrendingUp },
  { task_type: "trading_2000_weekly", target: 2000, points_reward: 1000, reset_period: "weekly", label: "Complete $2000 weekly trading volume", icon: TrendingUp },
  { task_type: "trade_5_tokens", target: 5, points_reward: 150, reset_period: "daily", label: "Trade 5 tokens", icon: Star },
];

const PointsRewards = () => {
  const { publicKey } = useWallet();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (publicKey) {
      initializeUserData();
    }
  }, [publicKey]);

  const initializeUserData = async () => {
    if (!publicKey) return;
    
    const walletAddress = publicKey.toString();
    setLoading(true);

    try {
      // Get or create user points
      const { data: existingPoints } = await supabase
        .from("user_points")
        .select("*")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (!existingPoints) {
        await supabase.from("user_points").insert({
          wallet_address: walletAddress,
          total_points: 0,
        });
        setUserPoints({ total_points: 0 });
      } else {
        setUserPoints({ total_points: existingPoints.total_points || 0 });
      }

      // Get or create tasks
      const { data: existingTasks } = await supabase
        .from("user_tasks")
        .select("*")
        .eq("wallet_address", walletAddress);

      if (!existingTasks || existingTasks.length === 0) {
        // Create tasks for user
        const tasksToCreate = TASK_DEFINITIONS.map((def) => ({
          wallet_address: walletAddress,
          task_type: def.task_type,
          progress: 0,
          target: def.target,
          points_reward: def.points_reward,
          completed: false,
          reset_period: def.reset_period,
        }));

        await supabase.from("user_tasks").insert(tasksToCreate);
        setTasks(tasksToCreate.map((t, i) => ({ ...t, id: `temp-${i}` })));
      } else {
        setTasks(existingTasks);
      }
    } catch (error) {
      console.error("Error initializing user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (task: Task) => {
    if (!publicKey || !task.completed) return;

    const walletAddress = publicKey.toString();

    try {
      // Update user points
      const newPoints = (userPoints?.total_points || 0) + task.points_reward;
      
      await supabase
        .from("user_points")
        .update({ total_points: newPoints, updated_at: new Date().toISOString() })
        .eq("wallet_address", walletAddress);

      // Reset task
      await supabase
        .from("user_tasks")
        .update({ progress: 0, completed: false })
        .eq("id", task.id);

      setUserPoints({ total_points: newPoints });
      setTasks(tasks.map((t) => (t.id === task.id ? { ...t, progress: 0, completed: false } : t)));
      
      toast.success(`Claimed ${task.points_reward} points!`);
    } catch (error) {
      console.error("Error claiming reward:", error);
      toast.error("Failed to claim reward");
    }
  };

  const getTaskDefinition = (taskType: string) => {
    return TASK_DEFINITIONS.find((def) => def.task_type === taskType);
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
            <h3 className="font-bold text-lg">Rewards & Points</h3>
          </div>
          <div className="flex items-center gap-2 bg-background/20 px-4 py-2 rounded-full">
            <Star className="w-5 h-5" />
            <span className="font-bold text-xl">{userPoints?.total_points || 0}</span>
            <span className="text-sm">pts</span>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {tasks.map((task) => {
          const def = getTaskDefinition(task.task_type);
          if (!def) return null;
          
          const Icon = def.icon;
          const progressPercent = Math.min((task.progress / task.target) * 100, 100);

          return (
            <div
              key={task.id}
              className={`p-4 rounded-lg border ${
                task.completed ? "bg-primary/10 border-primary/30" : "bg-muted border-border"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${task.completed ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-medium text-foreground text-sm">{def.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {task.reset_period} • +{task.points_reward} pts
                    </p>
                  </div>
                </div>
                {task.completed && (
                  <Button size="sm" onClick={() => claimReward(task)}>
                    Claim
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Progress value={progressPercent} className="flex-1 h-2" />
                <span className="text-xs text-muted-foreground min-w-[60px] text-right">
                  {task.progress}/{task.target}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PointsRewards;
