import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// All tasks are now daily
const TASK_DEFINITIONS = [
  { task_type: "interact_clips", target: 20, points_reward: 50, reset_period: "daily", label: "Interact with 20 audio clips" },
  { task_type: "upload_clips", target: 2, points_reward: 100, reset_period: "daily", label: "Upload 2 clips" },
  { task_type: "mint_token", target: 1, points_reward: 200, reset_period: "daily", label: "Mint 1 token" },
  { task_type: "trading_500", target: 500, points_reward: 300, reset_period: "daily", label: "Complete $500 trading volume" },
  { task_type: "trading_1000", target: 1000, points_reward: 500, reset_period: "daily", label: "Complete $1000 trading volume" },
  { task_type: "trading_2000", target: 2000, points_reward: 1000, reset_period: "daily", label: "Complete $2000 trading volume" },
  { task_type: "trade_5_tokens", target: 5, points_reward: 150, reset_period: "daily", label: "Trade 5 tokens" },
];

/**
 * Get task definition by type
 */
const getTaskDefinition = (taskType: string) => {
  return TASK_DEFINITIONS.find(def => def.task_type === taskType);
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
    await supabase
      .from("user_points")
      .update({ 
        total_points: newPoints, 
        updated_at: new Date().toISOString() 
      })
      .eq("wallet_address", walletAddress);

    // Mark task as claimed by resetting progress
    await supabase
      .from("user_tasks")
      .update({ progress: 0, completed: false })
      .eq("id", taskId);

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
    const { data: task } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("wallet_address", walletAddress)
      .eq("task_type", taskType)
      .maybeSingle();

    if (task) {
      // Skip if already completed (waiting for reset)
      if (task.completed) {
        return true;
      }

      const newProgress = Math.min((task.progress || 0) + increment, task.target);
      const completed = newProgress >= task.target;

      await supabase
        .from("user_tasks")
        .update({ progress: newProgress, completed })
        .eq("id", task.id);

      console.log(`Task ${taskType}: progress ${newProgress}/${task.target}, completed: ${completed}`);

      // Auto-claim if task just completed
      if (completed) {
        const taskDef = getTaskDefinition(taskType);
        if (taskDef) {
          await autoClaimPoints(walletAddress, task.id, task.points_reward, taskDef.label);
        }
      }

      return completed;
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
    // Update all trading volume tasks
    await updateTaskProgress(walletAddress, "trading_500", volumeUsd);
    await updateTaskProgress(walletAddress, "trading_1000", volumeUsd);
    await updateTaskProgress(walletAddress, "trading_2000", volumeUsd);
    
    // Update trade count task
    await updateTaskProgress(walletAddress, "trade_5_tokens", 1);
    
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
    // Check if user has tasks
    const { data: existingTasks } = await supabase
      .from("user_tasks")
      .select("task_type")
      .eq("wallet_address", walletAddress);

    const existingTypes = new Set((existingTasks || []).map(t => t.task_type));
    
    // Create missing tasks (all daily now)
    const missingTasks = TASK_DEFINITIONS
      .filter(def => !existingTypes.has(def.task_type))
      .map(def => ({
        wallet_address: walletAddress,
        task_type: def.task_type,
        progress: 0,
        target: def.target,
        points_reward: def.points_reward,
        completed: false,
        reset_period: "daily",
      }));

    if (missingTasks.length > 0) {
      await supabase.from("user_tasks").insert(missingTasks);
      console.log(`Created ${missingTasks.length} missing tasks for ${walletAddress}`);
    }

    // Update existing tasks to be daily if they weren't
    const { data: weeklyTasks } = await supabase
      .from("user_tasks")
      .select("id")
      .eq("wallet_address", walletAddress)
      .eq("reset_period", "weekly");

    if (weeklyTasks && weeklyTasks.length > 0) {
      await supabase
        .from("user_tasks")
        .update({ reset_period: "daily" })
        .eq("wallet_address", walletAddress)
        .eq("reset_period", "weekly");
      console.log(`Updated ${weeklyTasks.length} tasks to daily reset`);
    }

    // Ensure user points record exists
    const { data: existingPoints } = await supabase
      .from("user_points")
      .select("id")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (!existingPoints) {
      await supabase.from("user_points").insert({
        wallet_address: walletAddress,
        total_points: 0,
      });
      console.log(`Created user points record for ${walletAddress}`);
    }
  } catch (error) {
    console.error("Error ensuring user tasks:", error);
  }
};

export { TASK_DEFINITIONS };
