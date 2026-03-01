import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, walletAddress } = body;

    // Validate inputs
    if (!action || typeof action !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!walletAddress || typeof walletAddress !== "string" || walletAddress.length < 20 || walletAddress.length > 50) {
      return new Response(
        JSON.stringify({ error: "Invalid walletAddress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validActions = ["apply_referral", "ensure_user", "claim_task", "update_task_progress"];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "apply_referral") {
      const { referralCode } = body;
      if (!referralCode || typeof referralCode !== "string" || referralCode.length > 20) {
        return new Response(
          JSON.stringify({ error: "Invalid referral code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const code = referralCode.trim().toUpperCase();

      // Check user hasn't already applied a referral
      const { data: user } = await supabase
        .from("user_points")
        .select("referred_by, total_points")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (user?.referred_by) {
        return new Response(
          JSON.stringify({ error: "You have already applied a referral code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate referral code exists and isn't self-referral
      const { data: referrer } = await supabase
        .from("user_points")
        .select("wallet_address")
        .eq("referral_code", code)
        .maybeSingle();

      if (!referrer) {
        return new Response(
          JSON.stringify({ error: "Invalid referral code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (referrer.wallet_address === walletAddress) {
        return new Response(
          JSON.stringify({ error: "You can't use your own referral code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Apply referral and award 100 points
      const currentPoints = user?.total_points || 0;
      await supabase
        .from("user_points")
        .update({
          referred_by: code,
          total_points: currentPoints + 100,
          updated_at: new Date().toISOString(),
        })
        .eq("wallet_address", walletAddress);

      return new Response(
        JSON.stringify({ success: true, pointsAwarded: 100, newTotal: currentPoints + 100 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "ensure_user") {
      // Ensure user_points record exists
      const { data: existingPoints } = await supabase
        .from("user_points")
        .select("id")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (!existingPoints) {
        await supabase.from("user_points").insert({ wallet_address: walletAddress, total_points: 0 });
      }

      // Fetch quest definitions
      const { data: questDefs } = await supabase
        .from("quest_definitions")
        .select("*")
        .eq("is_active", true);

      // Check existing tasks
      const { data: existingTasks } = await supabase
        .from("user_tasks")
        .select("task_type")
        .eq("wallet_address", walletAddress);

      const existingTypes = new Set((existingTasks || []).map((t: { task_type: string }) => t.task_type));

      // Create missing tasks
      const missing = (questDefs || [])
        .filter((def: { task_type: string }) => !existingTypes.has(def.task_type))
        .map((def: { task_type: string; target: number; points_reward: number; reset_period: string }) => ({
          wallet_address: walletAddress,
          task_type: def.task_type,
          progress: 0,
          target: def.target,
          points_reward: def.points_reward,
          completed: false,
          reset_period: def.reset_period,
        }));

      for (const task of missing) {
        await supabase.from("user_tasks").insert(task);
      }

      // Sync existing tasks with latest definitions
      for (const def of (questDefs || [])) {
        await supabase
          .from("user_tasks")
          .update({ target: def.target, points_reward: def.points_reward, reset_period: def.reset_period })
          .eq("wallet_address", walletAddress)
          .eq("task_type", def.task_type);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_task_progress") {
      const { taskType, increment } = body;
      if (!taskType || typeof taskType !== "string" || taskType.length > 50) {
        return new Response(
          JSON.stringify({ error: "Invalid taskType" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (typeof increment !== "number" || increment <= 0 || increment > 10000) {
        return new Response(
          JSON.stringify({ error: "Invalid increment" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: task } = await supabase
        .from("user_tasks")
        .select("*")
        .eq("wallet_address", walletAddress)
        .eq("task_type", taskType)
        .maybeSingle();

      if (!task) {
        return new Response(
          JSON.stringify({ error: "Task not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (task.completed) {
        return new Response(
          JSON.stringify({ success: true, alreadyCompleted: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newProgress = Math.min((task.progress || 0) + increment, task.target);
      const completed = newProgress >= task.target;

      await supabase
        .from("user_tasks")
        .update({ progress: newProgress, completed })
        .eq("id", task.id);

      // Auto-claim points
      if (completed) {
        const { data: userPoints } = await supabase
          .from("user_points")
          .select("total_points")
          .eq("wallet_address", walletAddress)
          .maybeSingle();

        const currentPoints = userPoints?.total_points || 0;
        await supabase
          .from("user_points")
          .update({
            total_points: currentPoints + task.points_reward,
            updated_at: new Date().toISOString(),
          })
          .eq("wallet_address", walletAddress);
      }

      return new Response(
        JSON.stringify({ success: true, progress: newProgress, completed, pointsAwarded: completed ? task.points_reward : 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unhandled action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in update-points:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
