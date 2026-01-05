import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

// Cache for quest definitions
let questDefinitionsCache: QuestDefinition[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 1 minute

/**
 * Fetch quest definitions from database
 */
export const fetchQuestDefinitions = async (): Promise<QuestDefinition[]> => {
  const now = Date.now();
  
  // Return cached data if still valid
  if (questDefinitionsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return questDefinitionsCache;
  }

  const { data, error } = await supabase
    .from("quest_definitions")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching quest definitions:", error);
    return questDefinitionsCache || [];
  }

  questDefinitionsCache = data as QuestDefinition[];
  cacheTimestamp = now;
  return questDefinitionsCache;
};

/**
 * Get task definition by type
 */
const getTaskDefinition = async (taskType: string): Promise<QuestDefinition | undefined> => {
  const definitions = await fetchQuestDefinitions();
  return definitions.find(def => def.task_type === taskType);
};

/**
 * Auto-claim points for a completed task
 */
const autoClaimPoints = async (
  walletAddress: string,
  taskId: string,
  pointsReward: number,
  taskLabel: string
): Promise<void> => {
  try {
    // Get current user points
    const { data: userPoints } = await supabase
      .from("user_points")
      .select("total_points")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    const currentPoints = userPoints?.total_points || 0;
    const newPoints = currentPoints + pointsReward;

    // Update user points
    const { error: pointsError } = await supabase
      .from("user_points")
      .update({ 
        total_points: newPoints, 
        updated_at: new Date().toISOString() 
      })
      .eq("wallet_address", walletAddress);

    if (pointsError) {
      console.error("Error updating points:", pointsError);
      return;
    }

    // Keep task completed=true until daily reset (don't reset progress)
    // The reset-tasks edge function will handle resetting at midnight UTC

    // Show celebration toast
    toast.success(`🎉 Quest Complete: ${taskLabel}! +${pointsReward} points`, {
      duration: 5000,
      description: `Total points: ${newPoints.toLocaleString()}`,
    });

    console.log(`Auto-claimed ${pointsReward} points for ${taskLabel}`);
  } catch (error) {
    console.error("Error auto-claiming points:", error);
  }
};

/**
 * Update task progress for a user
 * Automatically claims points when target is reached
 */
export const updateTaskProgress = async (
  walletAddress: string, 
  taskType: string, 
  increment: number
): Promise<boolean> => {
  try {
    // First ensure tasks exist for this user
    await ensureUserTasks(walletAddress);
    
    const { data: task, error: fetchError } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("wallet_address", walletAddress)
      .eq("task_type", taskType)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching task:", fetchError);
      return false;
    }

    if (task) {
      // Skip if already completed (waiting for reset)
      if (task.completed) {
        console.log(`Task ${taskType} already completed, skipping`);
        return true;
      }

      const newProgress = Math.min((task.progress || 0) + increment, task.target);
      const completed = newProgress >= task.target;

      const { error: updateError } = await supabase
        .from("user_tasks")
        .update({ progress: newProgress, completed })
        .eq("id", task.id);

      if (updateError) {
        console.error("Error updating task progress:", updateError);
        return false;
      }

      console.log(`Task ${taskType}: progress ${newProgress}/${task.target}, completed: ${completed}`);

      // Auto-claim if task just completed
      if (completed) {
        const taskDef = await getTaskDefinition(taskType);
        if (taskDef) {
          await autoClaimPoints(walletAddress, task.id, task.points_reward, taskDef.display_name);
        }
      }

      return completed;
    } else {
      console.log(`Task ${taskType} not found for wallet ${walletAddress}`);
    }
    return false;
  } catch (error) {
    console.error("Error updating task:", error);
    return false;
  }
};

/**
 * Update trading volume tasks
 * Handles all daily trading volume tracking
 */
export const updateTradingVolume = async (
  walletAddress: string,
  volumeUsd: number
): Promise<void> => {
  try {
    // Get all active trading volume tasks from DB
    const definitions = await fetchQuestDefinitions();
    const tradingTasks = definitions.filter(def => 
      def.task_type.includes("trade") || def.task_type.includes("trading")
    );

    // Update each trading task
    for (const task of tradingTasks) {
      if (task.task_type.includes("volume")) {
        await updateTaskProgress(walletAddress, task.task_type, volumeUsd);
      } else {
        await updateTaskProgress(walletAddress, task.task_type, 1);
      }
    }
    
    console.log(`Trading volume updated: $${volumeUsd} for ${walletAddress}`);
  } catch (error) {
    console.error("Error updating trading volume:", error);
  }
};

/**
 * Ensure user has task records created
 * Called when wallet connects
 */
export const ensureUserTasks = async (walletAddress: string): Promise<void> => {
  try {
    // Fetch current quest definitions from database
    const questDefinitions = await fetchQuestDefinitions();
    
    // Check if user has tasks
    const { data: existingTasks } = await supabase
      .from("user_tasks")
      .select("task_type")
      .eq("wallet_address", walletAddress);

    const existingTypes = new Set((existingTasks || []).map(t => t.task_type));
    
    // Create missing tasks based on database definitions
    const missingTasks = questDefinitions
      .filter(def => !existingTypes.has(def.task_type))
      .map(def => ({
        wallet_address: walletAddress,
        task_type: def.task_type,
        progress: 0,
        target: def.target,
        points_reward: def.points_reward,
        completed: false,
        reset_period: def.reset_period,
      }));

    if (missingTasks.length > 0) {
      // Insert missing tasks one by one to avoid constraint issues
      for (const task of missingTasks) {
        const { error } = await supabase
          .from("user_tasks")
          .insert(task);
        
        if (error && !error.message.includes("duplicate") && !error.message.includes("unique")) {
          console.error("Error creating task:", task.task_type, error);
        }
      }
      console.log(`Created ${missingTasks.length} missing tasks for ${walletAddress}`);
    }

    // Sync existing user tasks with updated quest definitions
    for (const def of questDefinitions) {
      await supabase
        .from("user_tasks")
        .update({ 
          target: def.target, 
          points_reward: def.points_reward,
          reset_period: def.reset_period 
        })
        .eq("wallet_address", walletAddress)
        .eq("task_type", def.task_type);
    }

    // Ensure user points record exists
    const { data: existingPoints } = await supabase
      .from("user_points")
      .select("id")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (!existingPoints) {
      await supabase
        .from("user_points")
        .insert({
          wallet_address: walletAddress,
          total_points: 0,
        });
    }

    // Update creator fees progress for weekly quest
    await updateCreatorFeesProgress(walletAddress);
  } catch (error) {
    console.error("Error ensuring user tasks:", error);
  }
};

/**
 * Update creator fees progress from creator_earnings table
 * Tracks weekly creator fees for the quest
 */
export const updateCreatorFeesProgress = async (walletAddress: string): Promise<void> => {
  try {
    // Get start of current week (Sunday at 00:00 UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - dayOfWeek);
    startOfWeek.setUTCHours(0, 0, 0, 0);

    // Get total creator earnings this week
    const { data: earnings } = await supabase
      .from("creator_earnings")
      .select("amount_lamports")
      .eq("wallet_address", walletAddress)
      .gte("created_at", startOfWeek.toISOString());

    const totalLamports = (earnings || []).reduce((sum, e) => sum + (e.amount_lamports || 0), 0);
    const totalSol = totalLamports / 1_000_000_000; // Convert lamports to SOL

    // Update the creator_fees_1sol task progress
    const { data: task } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("wallet_address", walletAddress)
      .eq("task_type", "creator_fees_1sol")
      .maybeSingle();

    if (task) {
      // Store progress as milli-SOL (1 SOL = 1000)
      const progressMilliSol = Math.floor(totalSol * 1000);
      const targetMilliSol = task.target * 1000; // target is 1 SOL = 1000 milli-SOL
      const completed = progressMilliSol >= targetMilliSol;

      // Only update if progress changed or if just completed
      if (task.progress !== progressMilliSol || (completed && !task.completed)) {
        await supabase
          .from("user_tasks")
          .update({ 
            progress: progressMilliSol,
            completed 
          })
          .eq("id", task.id);

        console.log(`Creator fees quest: ${totalSol.toFixed(4)} SOL (${progressMilliSol} milli-SOL)`);

        // Auto-claim if just completed
        if (completed && !task.completed) {
          const taskDef = await getTaskDefinition("creator_fees_1sol");
          if (taskDef) {
            await autoClaimPoints(walletAddress, task.id, task.points_reward, taskDef.display_name);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error updating creator fees progress:", error);
  }
};

/**
 * Update engagement progress for a clip owner
 * Called when someone likes/shares their clip
 * Tracks total engagements (likes + shares) on all user's clips for the week
 */
export const updateEngagementProgress = async (clipOwnerWallet: string): Promise<void> => {
  try {
    // Get start of current week (Sunday at 00:00 UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - dayOfWeek);
    startOfWeek.setUTCHours(0, 0, 0, 0);

    // Get all clips owned by this wallet
    const { data: userClips } = await supabase
      .from("audio_clips")
      .select("id")
      .eq("wallet_address", clipOwnerWallet);

    if (!userClips || userClips.length === 0) {
      return;
    }

    const clipIds = userClips.map(c => c.id);

    // Count total engagements (likes) on user's clips this week
    const { count: likesCount } = await supabase
      .from("clip_likes")
      .select("id", { count: "exact", head: true })
      .in("audio_clip_id", clipIds)
      .gte("created_at", startOfWeek.toISOString());

    // Count shares from user_interactions table this week
    const { count: sharesCount } = await supabase
      .from("user_interactions")
      .select("id", { count: "exact", head: true })
      .in("audio_clip_id", clipIds)
      .eq("interaction_type", "share")
      .gte("created_at", startOfWeek.toISOString());

    const totalEngagements = (likesCount || 0) + (sharesCount || 0);

    // Update the engagement_500 task
    const { data: task } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("wallet_address", clipOwnerWallet)
      .eq("task_type", "engagement_500")
      .maybeSingle();

    if (task) {
      const newProgress = Math.min(totalEngagements, task.target);
      const completed = newProgress >= task.target;

      // Only update if progress changed
      if (task.progress !== newProgress || (completed && !task.completed)) {
        await supabase
          .from("user_tasks")
          .update({ progress: newProgress, completed })
          .eq("id", task.id);

        console.log(`Engagement quest for ${clipOwnerWallet}: ${newProgress}/${task.target}`);

        // Auto-claim if just completed
        if (completed && !task.completed) {
          const taskDef = await getTaskDefinition("engagement_500");
          if (taskDef) {
            await autoClaimPoints(clipOwnerWallet, task.id, task.points_reward, taskDef.display_name);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error updating engagement progress:", error);
  }
};