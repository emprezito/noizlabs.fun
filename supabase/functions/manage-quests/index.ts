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

    const { action, wallet_address, quest_id, quest_data } = await req.json();

    // Verify admin wallet
    const { data: adminWallet } = await supabase
      .from("admin_wallets")
      .select("id")
      .eq("wallet_address", wallet_address)
      .maybeSingle();

    if (!adminWallet) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Not an admin wallet" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;

    switch (action) {
      case "create":
        const { data: created, error: createError } = await supabase
          .from("quest_definitions")
          .insert({
            task_type: quest_data.task_type,
            display_name: quest_data.display_name,
            description: quest_data.description || null,
            target: quest_data.target,
            points_reward: quest_data.points_reward,
            reset_period: quest_data.reset_period,
            icon: quest_data.icon,
            is_active: quest_data.is_active,
            social_link: quest_data.social_link || null,
          })
          .select()
          .single();

        if (createError) throw createError;
        result = created;
        break;

      case "update":
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        
        if (quest_data.display_name !== undefined) updateData.display_name = quest_data.display_name;
        if (quest_data.description !== undefined) updateData.description = quest_data.description;
        if (quest_data.target !== undefined) updateData.target = quest_data.target;
        if (quest_data.points_reward !== undefined) updateData.points_reward = quest_data.points_reward;
        if (quest_data.reset_period !== undefined) updateData.reset_period = quest_data.reset_period;
        if (quest_data.icon !== undefined) updateData.icon = quest_data.icon;
        if (quest_data.is_active !== undefined) updateData.is_active = quest_data.is_active;
        if (quest_data.social_link !== undefined) updateData.social_link = quest_data.social_link || null;

        const { data: updated, error: updateError } = await supabase
          .from("quest_definitions")
          .update(updateData)
          .eq("id", quest_id)
          .select()
          .single();

        if (updateError) throw updateError;
        result = updated;
        break;

      case "delete":
        const { error: deleteError } = await supabase
          .from("quest_definitions")
          .delete()
          .eq("id", quest_id);

        if (deleteError) throw deleteError;
        result = { deleted: true };
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error managing quests:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});