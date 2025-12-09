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
        const taskDef = await getTaskDefinition(taskType);
        if (taskDef) {
          await autoClaimPoints(walletAddress, task.id, task.points_reward, taskDef.display_name);
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