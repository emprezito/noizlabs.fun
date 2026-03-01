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
    const { action, clipId, walletAddress } = body;

    // Validate inputs
    if (!action || typeof action !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!clipId || typeof clipId !== "string" || clipId.length > 100) {
      return new Response(
        JSON.stringify({ error: "Invalid clipId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validActions = ["like", "unlike", "play", "share"];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify clip exists
    const { data: clip, error: clipError } = await supabase
      .from("audio_clips")
      .select("id, likes, plays, shares, wallet_address")
      .eq("id", clipId)
      .single();

    if (clipError || !clip) {
      return new Response(
        JSON.stringify({ error: "Clip not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let newLikes = clip.likes || 0;
    let newPlays = clip.plays || 0;
    let newShares = clip.shares || 0;

    if (action === "like") {
      if (!walletAddress || typeof walletAddress !== "string" || walletAddress.length > 50) {
        return new Response(
          JSON.stringify({ error: "walletAddress required for like action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already liked
      const { data: existing } = await supabase
        .from("clip_likes")
        .select("id")
        .eq("audio_clip_id", clipId)
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: "Already liked", alreadyLiked: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert like record
      const { error: likeError } = await supabase
        .from("clip_likes")
        .insert({ audio_clip_id: clipId, wallet_address: walletAddress });

      if (likeError) {
        if (likeError.code === "23505") {
          return new Response(
            JSON.stringify({ error: "Already liked", alreadyLiked: true }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw likeError;
      }

      // Record interaction
      await supabase.from("user_interactions").insert({
        wallet_address: walletAddress,
        audio_clip_id: clipId,
        interaction_type: "like",
      });

      // Compute count from clip_likes
      const { count } = await supabase
        .from("clip_likes")
        .select("id", { count: "exact", head: true })
        .eq("audio_clip_id", clipId);

      newLikes = count || 0;

    } else if (action === "unlike") {
      if (!walletAddress || typeof walletAddress !== "string" || walletAddress.length > 50) {
        return new Response(
          JSON.stringify({ error: "walletAddress required for unlike action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("clip_likes")
        .delete()
        .eq("audio_clip_id", clipId)
        .eq("wallet_address", walletAddress);

      const { count } = await supabase
        .from("clip_likes")
        .select("id", { count: "exact", head: true })
        .eq("audio_clip_id", clipId);

      newLikes = count || 0;

    } else if (action === "play") {
      newPlays = (clip.plays || 0) + 1;

      if (walletAddress && typeof walletAddress === "string" && walletAddress.length <= 50) {
        await supabase.from("user_interactions").insert({
          wallet_address: walletAddress,
          audio_clip_id: clipId,
          interaction_type: "play",
        });
      }

    } else if (action === "share") {
      newShares = (clip.shares || 0) + 1;

      if (walletAddress && typeof walletAddress === "string" && walletAddress.length <= 50) {
        await supabase.from("user_interactions").insert({
          wallet_address: walletAddress,
          audio_clip_id: clipId,
          interaction_type: "share",
        });
      }
    }

    // Update audio_clips with computed counts (service role bypasses RLS)
    await supabase
      .from("audio_clips")
      .update({ likes: newLikes, plays: newPlays, shares: newShares })
      .eq("id", clipId);

    // Update task progress if wallet provided
    if (walletAddress && typeof walletAddress === "string") {
      const taskTypeMap: Record<string, string> = {
        like: "like_clips",
        play: "listen_clips",
        share: "share_clips",
      };
      const taskType = taskTypeMap[action];
      if (taskType) {
        // Update task progress server-side
        const { data: task } = await supabase
          .from("user_tasks")
          .select("*")
          .eq("wallet_address", walletAddress)
          .eq("task_type", taskType)
          .maybeSingle();

        if (task && !task.completed) {
          const newProgress = Math.min((task.progress || 0) + 1, task.target);
          const completed = newProgress >= task.target;

          await supabase
            .from("user_tasks")
            .update({ progress: newProgress, completed })
            .eq("id", task.id);

          // Auto-claim points if completed
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
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        likes: newLikes,
        plays: newPlays,
        shares: newShares,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error updating engagement:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
