import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Remix variation types with their properties and audio prompts
const REMIX_VARIATIONS = {
  slow: { 
    name: "Slow", 
    description: "Slowed down version with dreamy vibes", 
    isFree: true,
    audioPrompt: "slow tempo dreamy ambient electronic music with reverb and soft pads, relaxing chill vibes"
  },
  reverb: { 
    name: "Reverb", 
    description: "Heavy reverb with spacious atmosphere", 
    isFree: true,
    audioPrompt: "spacious atmospheric reverb-heavy ambient sound, cathedral echo effect, ethereal and floating"
  },
  distorted: { 
    name: "Distorted", 
    description: "Crunchy distortion with aggressive edge", 
    isFree: true,
    audioPrompt: "distorted crunchy aggressive electronic bass drop with hard hitting drums and gritty synths"
  },
  lofi: { 
    name: "Lo-Fi", 
    description: "Lo-fi hip hop style with vinyl crackle", 
    isFree: false,
    audioPrompt: "lofi hip hop beat with vinyl crackle, warm jazzy piano chords, chill study music vibes, tape hiss"
  },
  vaporwave: { 
    name: "Vaporwave", 
    description: "Aesthetic slowed vaporwave remix", 
    isFree: false,
    audioPrompt: "vaporwave aesthetic slowed 80s synth, retro mall music, dreamy nostalgic elevator music with chorus effect"
  },
  nightcore: { 
    name: "Nightcore", 
    description: "Sped up with high energy", 
    isFree: false,
    audioPrompt: "nightcore style fast tempo high energy electronic dance music, upbeat euphoric synth melody, happy hardcore"
  },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokenId, mintAddress, variationType, walletAddress, paymentTxSignature } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
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

    // Check if AI audio remix feature is enabled
    const { data: featureFlag } = await supabase
      .from("feature_flags")
      .select("is_enabled")
      .eq("feature_key", "ai_audio_remix")
      .maybeSingle();

    const aiAudioEnabled = featureFlag?.is_enabled && !!ELEVENLABS_API_KEY;

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
        hasAudio: !!existingRemix.remix_audio_url,
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
    console.log(`AI Audio generation enabled: ${aiAudioEnabled}`);

    // Use Lovable AI to generate creative remix concept
    const conceptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!conceptResponse.ok) {
      if (conceptResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded. Please try again later." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (conceptResponse.status === 402) {
        return new Response(JSON.stringify({ 
          error: "AI credits depleted. Please add credits to continue." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${conceptResponse.status}`);
    }

    const aiConceptResponse = await conceptResponse.json();
    const remixConcept = aiConceptResponse.choices?.[0]?.message?.content;

    if (!remixConcept) {
      throw new Error("Failed to generate remix concept");
    }

    console.log("Generated remix concept successfully");

    let remixAudioUrl: string | null = null;
    let audioBase64: string | null = null;

    // Generate actual audio using ElevenLabs if enabled
    if (aiAudioEnabled) {
      console.log("Generating audio with ElevenLabs...");
      
      try {
        // Create a customized prompt based on the token name and variation
        const customPrompt = `${variation.audioPrompt}, inspired by "${token.name}", short memorable sound effect`;
        
        const audioResponse = await fetch(
          "https://api.elevenlabs.io/v1/sound-generation",
          {
            method: "POST",
            headers: {
              "xi-api-key": ELEVENLABS_API_KEY!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: customPrompt,
              duration_seconds: 10,
              prompt_influence: 0.4,
            }),
          }
        );

        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer();
          audioBase64 = base64Encode(audioBuffer);
          
          // For now, we'll return the audio as base64
          // In production, you'd upload to storage and return a URL
          remixAudioUrl = `data:audio/mpeg;base64,${audioBase64}`;
          console.log("Audio generated successfully!");
        } else {
          const errorText = await audioResponse.text();
          console.error("ElevenLabs error:", audioResponse.status, errorText);
          // Continue without audio if generation fails
        }
      } catch (audioError) {
        console.error("Error generating audio:", audioError);
        // Continue without audio if generation fails
      }
    }

    // Save remix to database
    const { data: newRemix, error: insertError } = await supabase
      .from("token_remixes")
      .insert({
        token_id: tokenId,
        mint_address: mintAddress,
        variation_type: variationType,
        remix_concept: remixConcept,
        remix_audio_url: remixAudioUrl,
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
      hasAudio: !!remixAudioUrl,
      message: remixAudioUrl 
        ? `${variation.name} remix created with AI audio!`
        : `${variation.name} remix created! Audio generation coming soon.`,
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
