import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, Star, Zap, TrendingUp, Music, Coins, RefreshCw, Clock, 
  Heart, Upload, Headphones, BarChart, LineChart, Gift, Flame, 
  Rocket, Target, Award, Send, Twitter, ExternalLink, Link, Check,
  Calendar, CalendarDays, Wallet
} from "lucide-react";
import { toast } from "sonner";
import { updateTaskProgress, ensureUserTasks } from "@/lib/taskUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

interface QuestDefinition {
  id: string;
  task_type: string;
  display_name: string;
  description: string | null;
  target: number;
  points_reward: number;
  reset_period: string;
  icon: string;
  is_active: boolean;
  social_link: string | null;
}

interface UserPoints {
  total_points: number;
}

const ICON_MAP: Record<string, any> = {
  star: Star,
  headphones: Headphones,
  heart: Heart,
  "share-2": ExternalLink,
  upload: Upload,
  coins: Coins,
  "trending-up": TrendingUp,
  "bar-chart": BarChart,
  "line-chart": LineChart,
  zap: Zap,
  trophy: Trophy,
  gift: Gift,
  flame: Flame,
  rocket: Rocket,
  target: Target,
  award: Award,
  twitter: Twitter,
  send: Send,
  link: Link,
  wallet: Wallet,
};

const PointsRewards = () => {
  const { publicKey } = useWallet();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [questDefinitions, setQuestDefinitions] = useState<QuestDefinition[]>([]);
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeUntilReset, setTimeUntilReset] = useState("");
  const [completingSocial, setCompletingSocial] = useState<string | null>(null);
  const [tweetUrl, setTweetUrl] = useState("");
  const [verifyingTweet, setVerifyingTweet] = useState(false);
  const [tweetDialogOpen, setTweetDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("daily");

  useEffect(() => {
    if (publicKey) {
      fetchUserData();
      fetchQuestDefinitions();
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

  const fetchQuestDefinitions = async () => {
    const { data } = await supabase
      .from("quest_definitions")
      .select("*")
      .eq("is_active", true);
    
    if (data) {
      setQuestDefinitions(data as QuestDefinition[]);
    }
  };

  const fetchUserData = async () => {
    if (!publicKey) return;
    
    const walletAddress = publicKey.toString();
    setLoading(true);

    try {
      // Ensure user has tasks created
      await ensureUserTasks(walletAddress);

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

  const handleSocialQuest = async (task: Task, questDef: QuestDefinition) => {
    if (!publicKey || !questDef.social_link) return;

    setCompletingSocial(task.id);

    // Ensure the social link has a protocol
    let socialUrl = questDef.social_link;
    if (!socialUrl.startsWith('http://') && !socialUrl.startsWith('https://')) {
      socialUrl = 'https://' + socialUrl;
    }

    // Open the social link in a new tab
    window.open(socialUrl, '_blank', 'noopener,noreferrer');

    // Mark the quest as complete after a short delay
    setTimeout(async () => {
      try {
        const completed = await updateTaskProgress(publicKey.toString(), task.task_type, task.target);
        if (completed) {
          toast.success(`Quest completed: ${questDef.display_name}! 🎉`);
        }
      } catch (error) {
        console.error("Error completing social quest:", error);
      } finally {
        setCompletingSocial(null);
      }
    }, 1500);
  };

  const handleVerifyTweet = async () => {
    if (!publicKey || !tweetUrl.trim()) {
      toast.error("Please enter a valid tweet URL");
      return;
    }

    setVerifyingTweet(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-tweet', {
        body: {
          tweetUrl: tweetUrl.trim(),
          walletAddress: publicKey.toString()
        }
      });

      if (error) {
        console.error('Tweet verification error:', error);
        toast.error('Failed to verify tweet. Please try again.');
        return;
      }

      if (data.success) {
        toast.success(data.message || 'Tweet verified! Points awarded!');
        setTweetUrl("");
        setTweetDialogOpen(false);
        // Refresh user data
        fetchUserData();
      } else {
        toast.error(data.error || 'Could not verify the tweet.');
      }
    } catch (error) {
      console.error('Error verifying tweet:', error);
      toast.error('An error occurred while verifying the tweet.');
    } finally {
      setVerifyingTweet(false);
    }
  };

  const getQuestDefinition = (taskType: string): QuestDefinition | undefined => {
    return questDefinitions.find(q => q.task_type === taskType);
  };

  const getTaskInfo = (task: Task) => {
    const questDef = getQuestDefinition(task.task_type);
    if (questDef) {
      const IconComponent = ICON_MAP[questDef.icon] || Star;
      return {
        label: questDef.display_name,
        icon: IconComponent,
        socialLink: questDef.social_link,
        description: questDef.description,
      };
    }
    return { label: task.task_type, icon: Star, socialLink: null, description: null };
  };

  // Filter tasks by reset period
  const dailyTasks = tasks.filter(t => t.reset_period === 'daily');
  const weeklyTasks = tasks.filter(t => t.reset_period === 'weekly');
  const monthlyTasks = tasks.filter(t => t.reset_period === 'monthly' || t.reset_period === 'one_time');

  const renderTask = (task: Task) => {
    const info = getTaskInfo(task);
    const Icon = info.icon;
    const progressPercent = Math.min((task.progress / task.target) * 100, 100);
    const isSocialQuest = !!info.socialLink;
    const isTweetQuest = task.task_type === 'tweet_about_noizlabs';
    const questDef = getQuestDefinition(task.task_type);

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
                +{task.points_reward} pts
              </p>
            </div>
          </div>
          {task.completed ? (
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
              ✓ Claimed
            </span>
          ) : isTweetQuest ? (
            <Dialog open={tweetDialogOpen} onOpenChange={setTweetDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1"
                >
                  <Twitter className="w-3 h-3" />
                  Verify Tweet
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Twitter className="w-5 h-5 text-primary" />
                    Tweet About NoizLabs
                  </DialogTitle>
                  <DialogDescription>
                    Share your thoughts about NoizLabs on X/Twitter, then paste your tweet link below for verification.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="bg-muted/50 p-3 rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Step 1:</strong> Post a tweet mentioning NoizLabs
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => {
                        const tweetText = encodeURIComponent(
                          "Just discovered @NoizLabs - the future of audio tokens on Solana! 🎵🔥\n\n$NOIZ #NoizLabs #Solana #Web3 #AudioNFT"
                        );
                        window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Twitter to Post
                    </Button>
                  </div>
                  
                  <div className="bg-muted/50 p-3 rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Step 2:</strong> Paste your tweet link
                    </p>
                    <Input
                      placeholder="https://x.com/yourname/status/..."
                      value={tweetUrl}
                      onChange={(e) => setTweetUrl(e.target.value)}
                      className="mb-2"
                    />
                    <Button
                      onClick={handleVerifyTweet}
                      disabled={verifyingTweet || !tweetUrl.trim()}
                      className="w-full gap-2"
                    >
                      {verifyingTweet ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Verify & Claim Points
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Your tweet should mention NoizLabs, @NoizLabs, or $NOIZ
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          ) : isSocialQuest && questDef ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSocialQuest(task, questDef)}
              disabled={completingSocial === task.id}
              className="text-xs gap-1"
            >
              {completingSocial === task.id ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <ExternalLink className="w-3 h-3" />
              )}
              Complete
            </Button>
          ) : null}
        </div>
        
        {!isSocialQuest && !isTweetQuest && (
          <div className="flex items-center gap-3">
            <Progress value={progressPercent} className="flex-1 h-2" />
            <span className="text-xs text-muted-foreground min-w-[60px] text-right">
              {task.progress.toLocaleString()}/{task.target.toLocaleString()}
            </span>
          </div>
        )}
        
        {isSocialQuest && !task.completed && (
          <p className="text-xs text-muted-foreground mt-2">
            Click "Complete" to visit and earn points
          </p>
        )}
        
        {isTweetQuest && !task.completed && (
          <p className="text-xs text-muted-foreground mt-2">
            Tweet about NoizLabs and paste the link to earn points!
          </p>
        )}
      </div>
    );
  };

  const renderTaskList = (taskList: Task[], emptyMessage: string) => (
    <div className="space-y-3">
      {taskList.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">
          {emptyMessage}
        </p>
      ) : (
        taskList.map(renderTask)
      )}
    </div>
  );

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
            <h3 className="font-bold text-lg">Quests</h3>
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
          <span>Daily reset in {timeUntilReset}</span>
        </div>
      </div>

      {/* Auto-claim notice */}
      <div className="px-4 py-2 bg-accent/10 border-b border-border">
        <p className="text-xs text-muted-foreground text-center">
          ✨ Points are automatically claimed when you complete a quest!
        </p>
      </div>

      {/* Quest Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 rounded-none border-b border-border bg-muted/50">
          <TabsTrigger value="daily" className="gap-1.5 data-[state=active]:bg-background">
            <Clock className="w-3.5 h-3.5" />
            Daily
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1.5 data-[state=active]:bg-background">
            <Calendar className="w-3.5 h-3.5" />
            Weekly
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5 data-[state=active]:bg-background">
            <CalendarDays className="w-3.5 h-3.5" />
            Monthly
          </TabsTrigger>
        </TabsList>

        <div className="p-4 max-h-96 overflow-y-auto">
          <TabsContent value="daily" className="mt-0">
            {renderTaskList(dailyTasks, "No daily quests available.")}
          </TabsContent>

          <TabsContent value="weekly" className="mt-0">
            {renderTaskList(weeklyTasks, "No weekly quests available.")}
          </TabsContent>

          <TabsContent value="monthly" className="mt-0">
            {renderTaskList(monthlyTasks, "No monthly quests available.")}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default PointsRewards;