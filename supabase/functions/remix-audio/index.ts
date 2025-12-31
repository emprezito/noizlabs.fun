import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Remix variation types with their audio transformation prompts
const REMIX_VARIATIONS = {
  slow: { 
    name: "Slow", 
    description: "Slowed down version with dreamy vibes", 
    isFree: true,
    // Prompt to create slowed/reverb effect overlay
    effectPrompt: "slow dreamy reverb ambience pad, slowed down ethereal atmosphere, lo-fi chill background texture",
    speedFactor: 0.75,
  },
  reverb: { 
    name: "Reverb", 
    description: "Heavy reverb with spacious atmosphere", 
    isFree: true,
    effectPrompt: "spacious cathedral reverb tail, atmospheric echo resonance, floating ambient wash",
    speedFactor: 1.0,
  },
  distorted: { 
    name: "Distorted", 
    description: "Crunchy distortion with aggressive edge", 
    isFree: true,
    effectPrompt: "crunchy distortion bass drop, aggressive electronic glitch texture, hard hitting impact",
    speedFactor: 1.0,
  },
  lofi: { 
    name: "Lo-Fi", 
    description: "Lo-fi hip hop style with vinyl crackle", 
    isFree: false,
    effectPrompt: "vinyl crackle pop noise, warm analog tape hiss, lo-fi dust particles scratching",
    speedFactor: 0.9,
  },
  vaporwave: { 
    name: "Vaporwave", 
    description: "Aesthetic slowed vaporwave remix", 
    isFree: false,
    effectPrompt: "vaporwave aesthetic synth pad, 80s nostalgic reverb, chopped and screwed atmosphere",
    speedFactor: 0.7,
  },
  nightcore: { 
    name: "Nightcore", 
    description: "Sped up with high energy", 
    isFree: false,
    effectPrompt: "euphoric trance synth stab, high energy electronic arpeggio, uplifting bright texture",
    speedFactor: 1.3,
  },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokenId, mintAddress, variationType, walletAddress, paymentTxSignature, originalAudioUrl } = await req.json();
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

    // Fetch token details including audio URL
    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .select("name, symbol, audio_url, audio_clip_id")
      .eq("id", tokenId)
      .single();

    if (tokenError || !token) {
      throw new Error("Token not found");
    }

    // Get the audio URL - from param, token, or audio_clip
    let audioUrl = originalAudioUrl || token.audio_url;
    
    if (!audioUrl && token.audio_clip_id) {
      const { data: clip } = await supabase
        .from("audio_clips")
        .select("audio_url")
        .eq("id", token.audio_clip_id)
        .maybeSingle();
      audioUrl = clip?.audio_url;
    }

    console.log(`Generating ${variation.name} remix for: ${token.name}`);
    console.log(`Original audio URL: ${audioUrl}`);
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
Original Audio: ${audioUrl || "Meme audio clip"}
Remix Style: ${variation.name} - ${variation.description}
Speed Factor: ${variation.speedFactor}x

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

    // Generate remix audio using ElevenLabs if enabled
    if (aiAudioEnabled && audioUrl) {
      console.log("Generating remix audio with ElevenLabs...");
      
      try {
        // Step 1: Download the original audio
        console.log("Downloading original audio...");
        const originalAudioResponse = await fetch(audioUrl);
        if (!originalAudioResponse.ok) {
          throw new Error(`Failed to fetch original audio: ${originalAudioResponse.status}`);
        }
        const originalAudioBuffer = await originalAudioResponse.arrayBuffer();
        const originalAudioBase64 = base64Encode(originalAudioBuffer);
        console.log(`Original audio size: ${originalAudioBuffer.byteLength} bytes`);

        // Step 2: Generate the effect/texture layer using ElevenLabs
        console.log("Generating effect layer with ElevenLabs...");
        const effectResponse = await fetch(
          "https://api.elevenlabs.io/v1/sound-generation",
          {
            method: "POST",
            headers: {
              "xi-api-key": ELEVENLABS_API_KEY!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: `${variation.effectPrompt}, based on ${token.name}, audio effect layer`,
              duration_seconds: 15,
              prompt_influence: 0.5,
            }),
          }
        );

        if (!effectResponse.ok) {
          const errorText = await effectResponse.text();
          console.error("ElevenLabs error:", effectResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${effectResponse.status}`);
        }

        const effectAudioBuffer = await effectResponse.arrayBuffer();
        const effectAudioBase64 = base64Encode(effectAudioBuffer);
        console.log(`Effect audio size: ${effectAudioBuffer.byteLength} bytes`);

        // For now, we'll blend the original audio with the effect
        // In a production environment, you'd use a proper audio processing service
        // The effect layer adds the remix texture to the original audio
        
        // Create a combined audio data URL that includes remix info
        // The client will handle playback with speed adjustment
        remixAudioUrl = JSON.stringify({
          original: `data:audio/mpeg;base64,${originalAudioBase64}`,
          effect: `data:audio/mpeg;base64,${effectAudioBase64}`,
          speedFactor: variation.speedFactor,
          variationType: variationType,
        });

        console.log("Remix audio generated successfully!");

      } catch (audioError) {
        console.error("Error generating remix audio:", audioError);
        // If processing fails, generate a standalone effect as fallback
        try {
          console.log("Falling back to standalone effect generation...");
          const fallbackResponse = await fetch(
            "https://api.elevenlabs.io/v1/sound-generation",
            {
              method: "POST",
              headers: {
                "xi-api-key": ELEVENLABS_API_KEY!,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: `${variation.effectPrompt}, ${variation.name} remix of ${token.name}, short memorable sound`,
                duration_seconds: 12,
                prompt_influence: 0.4,
              }),
            }
          );

          if (fallbackResponse.ok) {
            const fallbackBuffer = await fallbackResponse.arrayBuffer();
            const fallbackBase64 = base64Encode(fallbackBuffer);
            remixAudioUrl = `data:audio/mpeg;base64,${fallbackBase64}`;
            console.log("Fallback audio generated successfully!");
          }
        } catch (fallbackError) {
          console.error("Fallback audio generation failed:", fallbackError);
        }
      }
    } else if (!audioUrl) {
      console.log("No original audio URL available for remixing");
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
      variationInfo: {
        ...variation,
        hasOriginalAudio: !!audioUrl,
      },
      hasAudio: !!remixAudioUrl,
      message: remixAudioUrl 
        ? `${variation.name} remix created with AI audio!`
        : `${variation.name} remix created! ${audioUrl ? 'Audio processing coming soon.' : 'No original audio available.'}`,
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
