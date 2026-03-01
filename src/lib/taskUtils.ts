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
 * Update task progress for a user via server-side edge function
 * Automatically claims points when target is reached
 */
export const updateTaskProgress = async (
  walletAddress: string, 
  taskType: string, 
  increment: number
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke("update-points", {
      body: {
        action: "update_task_progress",
        walletAddress,
        taskType,
        increment,
      },
    });

    if (error) {
      console.error("Error updating task progress:", error);
      return false;
    }

    if (data?.completed && data?.pointsAwarded > 0) {
      toast.success(`🎉 Quest Complete! +${data.pointsAwarded} points`, {
        duration: 5000,
      });
    }

    return data?.completed || false;
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
 * Ensure user has task records created via server-side edge function
 * Called when wallet connects
 */
export const ensureUserTasks = async (walletAddress: string): Promise<void> => {
  try {
    const { error } = await supabase.functions.invoke("update-points", {
      body: {
        action: "ensure_user",
        walletAddress,
      },
    });

    if (error) {
      console.error("Error ensuring user tasks:", error);
    }
  } catch (error) {
    console.error("Error ensuring user tasks:", error);
  }
};

/**
 * Update creator fees progress from creator_earnings table
 * Now read-only from client - just checks progress
 */
export const updateCreatorFeesProgress = async (_walletAddress: string): Promise<void> => {
  // Creator fees progress is now tracked server-side
  // This function is kept for API compatibility but is a no-op on client
};

/**
 * Update engagement progress for a clip owner
 * Now handled server-side via update-engagement edge function
 */
export const updateEngagementProgress = async (_clipOwnerWallet: string): Promise<void> => {
  // Engagement progress is now tracked server-side via update-engagement
  // This function is kept for API compatibility but is a no-op on client
};
