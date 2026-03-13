import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...params } = await req.json();

    switch (action) {
      case "check_sounds": {
        // Check multiple sound IDs at once for their registry status
        const { soundIds } = params;
        if (!soundIds || !Array.isArray(soundIds)) {
          throw new Error("soundIds array required");
        }

        const { data, error } = await supabase
          .from("sounds_registry")
          .select("*")
          .in("sound_id", soundIds);

        if (error) throw error;

        return new Response(JSON.stringify({ registry: data || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check_hash": {
        const { audioHash } = params;
        if (!audioHash) throw new Error("audioHash required");

        const { data, error } = await supabase
          .from("sounds_registry")
          .select("*")
          .eq("audio_hash", audioHash)
          .maybeSingle();

        if (error) throw error;

        return new Response(JSON.stringify({ exists: !!data, entry: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reserve": {
        const { soundId, audioUrl, audioHash, walletAddress } = params;
        if (!soundId || !walletAddress || !audioUrl) {
          throw new Error("soundId, audioUrl, walletAddress required");
        }

        // Atomic reservation: only succeeds if no existing entry or status=available
        // First check if entry exists
        const { data: existing } = await supabase
          .from("sounds_registry")
          .select("*")
          .eq("sound_id", soundId)
          .maybeSingle();

        if (existing) {
          if (existing.status === "minted") {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "This sound is already minted! 🔒",
              entry: existing 
            }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (existing.status === "reserved") {
            // Check if reservation expired
            if (existing.reservation_expires_at && new Date(existing.reservation_expires_at) > new Date()) {
              return new Response(JSON.stringify({ 
                success: false, 
                error: "Someone just grabbed this sound! Try another one 🏃",
                entry: existing 
              }), {
                status: 409,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            // Expired reservation - update it
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
            const { data: updated, error: updateErr } = await supabase
              .from("sounds_registry")
              .update({
                status: "reserved",
                reserved_by: walletAddress,
                reserved_at: new Date().toISOString(),
                reservation_expires_at: expiresAt,
                audio_hash: audioHash || null,
              })
              .eq("id", existing.id)
              .select()
              .single();

            if (updateErr) throw updateErr;
            return new Response(JSON.stringify({ success: true, entry: updated }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          // Status is "available" - reserve it
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
          const { data: updated, error: updateErr } = await supabase
            .from("sounds_registry")
            .update({
              status: "reserved",
              reserved_by: walletAddress,
              reserved_at: new Date().toISOString(),
              reservation_expires_at: expiresAt,
              audio_hash: audioHash || null,
            })
            .eq("id", existing.id)
            .select()
            .single();

          if (updateErr) throw updateErr;
          return new Response(JSON.stringify({ success: true, entry: updated }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Also check by audio hash if provided
        if (audioHash) {
          const { data: hashMatch } = await supabase
            .from("sounds_registry")
            .select("*")
            .eq("audio_hash", audioHash)
            .maybeSingle();

          if (hashMatch && hashMatch.status === "minted") {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "A duplicate of this sound has already been minted! 🔒",
              entry: hashMatch 
            }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Create new entry with reservation
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const { data: newEntry, error: insertErr } = await supabase
          .from("sounds_registry")
          .insert({
            sound_id: soundId,
            audio_url: audioUrl,
            audio_hash: audioHash || null,
            status: "reserved",
            reserved_by: walletAddress,
            reserved_at: new Date().toISOString(),
            reservation_expires_at: expiresAt,
          })
          .select()
          .single();

        if (insertErr) {
          // Unique constraint violation = someone else just reserved
          if (insertErr.code === "23505") {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Someone just grabbed this sound! Try another one 🏃" 
            }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw insertErr;
        }

        return new Response(JSON.stringify({ success: true, entry: newEntry }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "complete_mint": {
        const { soundId, walletAddress, tokenName, tokenTicker, tokenAddress } = params;
        if (!soundId || !walletAddress || !tokenAddress) {
          throw new Error("soundId, walletAddress, tokenAddress required");
        }

        const { data, error } = await supabase
          .from("sounds_registry")
          .update({
            status: "minted",
            minted_by: walletAddress,
            minted_at: new Date().toISOString(),
            token_name: tokenName,
            token_ticker: tokenTicker,
            token_address: tokenAddress,
            reserved_by: null,
            reserved_at: null,
            reservation_expires_at: null,
          })
          .eq("sound_id", soundId)
          .eq("reserved_by", walletAddress)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, entry: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "release_reservation": {
        const { soundId, walletAddress } = params;
        if (!soundId || !walletAddress) {
          throw new Error("soundId, walletAddress required");
        }

        const { error } = await supabase
          .from("sounds_registry")
          .update({
            status: "available",
            reserved_by: null,
            reserved_at: null,
            reservation_expires_at: null,
          })
          .eq("sound_id", soundId)
          .eq("reserved_by", walletAddress);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cleanup_expired": {
        // Release all expired reservations
        const { data, error } = await supabase
          .from("sounds_registry")
          .update({
            status: "available",
            reserved_by: null,
            reserved_at: null,
            reservation_expires_at: null,
          })
          .eq("status", "reserved")
          .lt("reservation_expires_at", new Date().toISOString())
          .select();

        if (error) throw error;

        return new Response(JSON.stringify({ 
          success: true, 
          released: data?.length || 0 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "recent_mints": {
        const { data, error } = await supabase
          .from("sounds_registry")
          .select("*")
          .eq("status", "minted")
          .order("minted_at", { ascending: false })
          .limit(20);

        if (error) throw error;

        return new Response(JSON.stringify({ mints: data || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error("Sounds registry error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = (error as any)?.status || 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
