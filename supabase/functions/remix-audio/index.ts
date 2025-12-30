import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Remix variation types with their properties
const REMIX_VARIATIONS = {
  slow: { name: "Slow", description: "Slowed down version with dreamy vibes", isFree: true },
  reverb: { name: "Reverb", description: "Heavy reverb with spacious atmosphere", isFree: true },
  distorted: { name: "Distorted", description: "Crunchy distortion with aggressive edge", isFree: true },
  lofi: { name: "Lo-Fi", description: "Lo-fi hip hop style with vinyl crackle", isFree: false },
  vaporwave: { name: "Vaporwave", description: "Aesthetic slowed vaporwave remix", isFree: false },
  nightcore: { name: "Nightcore", description: "Sped up with high energy", isFree: false },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokenId, mintAddress, variationType, walletAddress, paymentTxSignature } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!tokenId || !mintAddress || !variationType || !walletAddress) {
      throw new Error("Missing required parameters: tokenId, mintAddress, variationType, walletAddress");
    }

    const variation = REMIX_VARIATIONS[variationType as keyof typeof REMIX_VARIATIONS];
    if (!variation) {
      throw new Error(`Invalid variation type: ${variationType}. Valid types: ${Object.keys(REMIX_VARIATIONS).join(', ')}`);
    }

    // Check if variation requires payment
    if (!variation.isFree && !paymentTxSignature) {
      return new Response(JSON.stringify({
        error: "This variation requires payment of 0.01 SOL",
        requiresPayment: true,
        cost: 0.01,
      }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check if this variation already exists for this token
    const { data: existingRemix } = await supabase
      .from("token_remixes")
      .select("*")
      .eq("token_id", tokenId)
      .eq("variation_type", variationType)
      .maybeSingle();

    if (existingRemix) {
      return new Response(JSON.stringify({
        success: true,
        remix: existingRemix,
        message: "This remix variation already exists",
        alreadyExists: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch token details
    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .select("name, symbol, audio_url")
      .eq("id", tokenId)
      .single();

    if (tokenError || !token) {
      throw new Error("Token not found");
    }

    console.log(`Generating ${variation.name} remix for: ${token.name}`);

    // Use Lovable AI to generate creative remix concept
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional audio remix artist AI. Generate creative and detailed remix concepts.

For each remix, provide a vivid description of how the audio would be transformed including:
1. Technical effects applied (BPM changes, pitch shifts, filters, etc.)
2. Mood and atmosphere changes
3. What makes this remix unique and viral-worthy

Keep it concise but exciting - max 150 words. Be creative and fun! This is for a meme audio token platform.`
          },
          {
            role: "user",
            content: `Create a ${variation.name} (${variation.description}) remix concept for this audio token:

Title: "${token.name}" (${token.symbol})
Original Audio: ${token.audio_url}
Remix Style: ${variation.name} - ${variation.description}

Generate a unique ${variation.name} remix concept that would make this go viral!`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded. Please try again later." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "AI credits depleted. Please add credits to continue." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const remixConcept = aiResponse.choices?.[0]?.message?.content;

    if (!remixConcept) {
      throw new Error("Failed to generate remix concept");
    }

    console.log("Generated remix concept successfully");

    // Save remix to database
    const { data: newRemix, error: insertError } = await supabase
      .from("token_remixes")
      .insert({
        token_id: tokenId,
        mint_address: mintAddress,
        variation_type: variationType,
        remix_concept: remixConcept,
        created_by: walletAddress,
        is_paid: !variation.isFree,
        payment_tx_signature: paymentTxSignature || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving remix:", insertError);
      throw new Error("Failed to save remix");
    }

    return new Response(JSON.stringify({
      success: true,
      remix: newRemix,
      variationInfo: variation,
      message: `${variation.name} remix created! Full audio generation coming soon.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Remix generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate remix";
    return new Response(JSON.stringify({
      error: message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
