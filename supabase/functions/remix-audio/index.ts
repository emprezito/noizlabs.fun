import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clipId, title, audioUrl, remixStyle } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!clipId || !title) {
      throw new Error("Missing required parameters");
    }

    console.log(`Generating remix instructions for: ${title}`);

    // Use Lovable AI to generate creative remix suggestions
    // Since Lovable AI doesn't directly support audio generation,
    // we generate creative remix instructions and metadata
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
            content: `You are a creative audio remix artist AI. Generate unique remix concepts for audio clips.
            
For each remix, provide:
1. A creative remixed title (catchy, meme-worthy)
2. A remix style description (e.g., "synthwave", "lo-fi beats", "trap remix", "vaporwave")
3. A description of how the audio would be transformed
4. Suggested BPM and key
5. Effects to apply (reverb, delay, pitch shift, etc.)

Be creative and fun! This is for a meme audio token platform.`
          },
          {
            role: "user",
            content: `Create a ${remixStyle || "creative"} remix concept for this audio clip:

Title: "${title}"
Original Audio URL: ${audioUrl}

Generate a unique remix concept that would make this go viral!`
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

    return new Response(JSON.stringify({
      success: true,
      originalClipId: clipId,
      originalTitle: title,
      remixConcept,
      message: "Remix concept generated! Note: Full audio generation requires additional audio processing services.",
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
