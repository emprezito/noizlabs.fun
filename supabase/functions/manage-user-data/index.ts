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
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action } = body;

    if (!action || typeof action !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const validActions = [
      "track_wallet", "upsert_notification_prefs", "upsert_push_subscription",
      "delete_push_subscription", "create_notification", "mark_notification_read",
      "mark_all_notifications_read", "create_audio_clip", "create_token_record",
    ];

    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Common wallet validation
    const walletAddress = body.walletAddress as string | undefined;
    if (action !== "create_token_record" && (!walletAddress || typeof walletAddress !== "string" || walletAddress.length < 20 || walletAddress.length > 50)) {
      return new Response(
        JSON.stringify({ error: "Invalid walletAddress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Track wallet connection ===
    if (action === "track_wallet") {
      await supabase.from("connected_wallets").upsert(
        { wallet_address: walletAddress, last_connected_at: new Date().toISOString() },
        { onConflict: "wallet_address", ignoreDuplicates: false }
      );
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Upsert notification preferences ===
    if (action === "upsert_notification_prefs") {
      const priceAlertsEnabled = typeof body.priceAlertsEnabled === "boolean" ? body.priceAlertsEnabled : false;
      const { error } = await supabase.from("notification_preferences").upsert(
        { wallet_address: walletAddress, price_alerts_enabled: priceAlertsEnabled, updated_at: new Date().toISOString() },
        { onConflict: "wallet_address" }
      );
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Upsert push subscription ===
    if (action === "upsert_push_subscription") {
      const { endpoint, p256dh, auth } = body as Record<string, string>;
      if (!endpoint || typeof endpoint !== "string" || endpoint.length > 2000) {
        return new Response(JSON.stringify({ error: "Invalid endpoint" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!p256dh || typeof p256dh !== "string" || !auth || typeof auth !== "string") {
        return new Response(JSON.stringify({ error: "Invalid push keys" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabase.from("push_subscriptions").upsert(
        { wallet_address: walletAddress, endpoint, p256dh, auth },
        { onConflict: "wallet_address,endpoint" }
      );
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Delete push subscription ===
    if (action === "delete_push_subscription") {
      const endpoint = body.endpoint as string;
      if (!endpoint) {
        return new Response(JSON.stringify({ error: "Missing endpoint" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("push_subscriptions").delete().eq("wallet_address", walletAddress!).eq("endpoint", endpoint);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Create notification ===
    if (action === "create_notification") {
      const { title, message, type, tokenMint } = body as Record<string, string>;
      if (!title || typeof title !== "string" || title.length > 200) {
        return new Response(JSON.stringify({ error: "Invalid title" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!message || typeof message !== "string" || message.length > 1000) {
        return new Response(JSON.stringify({ error: "Invalid message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabase.from("notifications").insert({
        wallet_address: walletAddress, title, message,
        type: type || "info", token_mint: tokenMint || null,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Mark notification read ===
    if (action === "mark_notification_read") {
      const notificationId = body.notificationId as string;
      if (!notificationId) {
        return new Response(JSON.stringify({ error: "Missing notificationId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("notifications").update({ read: true }).eq("id", notificationId).eq("wallet_address", walletAddress!);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Mark all notifications read ===
    if (action === "mark_all_notifications_read") {
      await supabase.from("notifications").update({ read: true }).eq("wallet_address", walletAddress!).eq("read", false);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Create audio clip ===
    if (action === "create_audio_clip") {
      const { title, creator, audioUrl, coverImageUrl, category } = body as Record<string, string>;
      if (!title || typeof title !== "string" || title.length > 200) {
        return new Response(JSON.stringify({ error: "Invalid title" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!creator || typeof creator !== "string" || creator.length > 100) {
        return new Response(JSON.stringify({ error: "Invalid creator" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!audioUrl || typeof audioUrl !== "string" || audioUrl.length > 2000) {
        return new Response(JSON.stringify({ error: "Invalid audioUrl" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("audio_clips").insert({
        title, creator, audio_url: audioUrl,
        cover_image_url: coverImageUrl || null,
        category: category || "other",
        wallet_address: walletAddress,
        likes: 0, shares: 0, plays: 0,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Create token record ===
    if (action === "create_token_record") {
      const tokenData = body.tokenData as Record<string, unknown>;
      if (!tokenData) {
        return new Response(JSON.stringify({ error: "Missing tokenData" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { mintAddress, name, symbol, creatorWallet, metadataUri, audioClipId, audioUrl, coverImageUrl,
              solReserves, tokenReserves, isRemix, originalTokenId, royaltyRecipient, royaltyPercentage } = tokenData as Record<string, unknown>;
      
      if (!mintAddress || typeof mintAddress !== "string" || mintAddress.length < 20 || mintAddress.length > 50) {
        return new Response(JSON.stringify({ error: "Invalid mintAddress" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!name || typeof name !== "string" || name.length > 50) {
        return new Response(JSON.stringify({ error: "Invalid token name" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!symbol || typeof symbol !== "string" || symbol.length > 15) {
        return new Response(JSON.stringify({ error: "Invalid symbol" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!creatorWallet || typeof creatorWallet !== "string" || creatorWallet.length < 20 || creatorWallet.length > 50) {
        return new Response(JSON.stringify({ error: "Invalid creatorWallet" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: tokenError } = await supabase.from("tokens").insert({
        mint_address: mintAddress,
        name: (name as string).slice(0, 32),
        symbol: (symbol as string).slice(0, 10),
        creator_wallet: creatorWallet,
        initial_price: 1,
        total_supply: 1_000_000_000,
        metadata_uri: metadataUri || null,
        audio_clip_id: audioClipId || null,
        audio_url: audioUrl || null,
        cover_image_url: coverImageUrl || null,
        sol_reserves: solReserves || 10000000,
        token_reserves: tokenReserves || 100000000000000000,
        tokens_sold: 0,
        total_volume: 0,
        is_active: true,
        is_remix: isRemix || false,
        original_token_id: isRemix ? originalTokenId : null,
        royalty_recipient: royaltyRecipient || null,
        royalty_percentage: royaltyPercentage || 0,
      });
      if (tokenError) throw tokenError;

      // Create vesting record if vestingData provided
      const vestingData = body.vestingData as Record<string, unknown> | undefined;
      if (vestingData) {
        const { vestingWallet, tokenAmount, cliffEnd } = vestingData as Record<string, unknown>;
        if (vestingWallet && tokenAmount && cliffEnd) {
          await supabase.from("token_vesting").insert({
            mint_address: mintAddress,
            wallet_address: vestingWallet,
            token_amount: tokenAmount,
            cliff_end: cliffEnd,
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unhandled action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Error in manage-user-data:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
