import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const url = new URL(req.url);
    const mintAddress = url.searchParams.get('mint');
    const clipId = url.searchParams.get('clip');
    
    if (!mintAddress && !clipId) {
      // Return default OG image
      return Response.redirect('https://noizlabs-io.vercel.app/icon.png', 302);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let title = "NoizLabs";
    let subtitle = "Turn Audio Memes Into Tradeable Assets";
    let price = "";
    let marketCap = "";
    let coverImageUrl = "";
    let symbol = "";

    if (mintAddress) {
      // Fetch token data
      const { data: token, error } = await supabase
        .from("tokens")
        .select("name, symbol, cover_image_url, sol_reserves, token_reserves, audio_clip_id")
        .eq("mint_address", mintAddress)
        .maybeSingle();

      if (token) {
        title = token.name;
        symbol = token.symbol;
        coverImageUrl = token.cover_image_url || "";
        
        // Calculate price and market cap
        const solReserves = Number(token.sol_reserves) / 1e9;
        const tokenReserves = Number(token.token_reserves) / 1e9;
        const tokenPrice = tokenReserves > 0 ? solReserves / tokenReserves : 0;
        const mcSol = solReserves * 2;
        
        price = `${tokenPrice.toFixed(8)} SOL`;
        marketCap = `${mcSol.toFixed(4)} SOL`;
        subtitle = `$${symbol} on NoizLabs`;

        // Try to get cover image from audio clip if not on token
        if (!coverImageUrl && token.audio_clip_id) {
          const { data: clip } = await supabase
            .from("audio_clips")
            .select("cover_image_url")
            .eq("id", token.audio_clip_id)
            .maybeSingle();
          coverImageUrl = clip?.cover_image_url || "";
        }
      }
    } else if (clipId) {
      // Fetch audio clip data
      const { data: clip, error } = await supabase
        .from("audio_clips")
        .select("title, creator, cover_image_url, plays, likes")
        .eq("id", clipId)
        .maybeSingle();

      if (clip) {
        title = clip.title;
        subtitle = `by ${clip.creator} on NoizLabs`;
        coverImageUrl = clip.cover_image_url || "";
        price = `${clip.plays || 0} plays`;
        marketCap = `${clip.likes || 0} likes`;
      }
    }

    // Generate OG image using Lovable AI
    if (LOVABLE_API_KEY) {
      console.log("Generating OG image with AI...");
      
      const prompt = `Create a professional social media preview card image for a music/audio token:
- Dark gradient background (purple to dark blue, similar to crypto/Web3 aesthetic)
- Title: "${title}" in large bold white text at the top
- Subtitle: "${subtitle}" in smaller text below
${price ? `- Price displayed: "${price}"` : ""}
${marketCap ? `- Market Cap: "${marketCap}"` : ""}
- Add musical note icons or sound wave graphics
- NoizLabs branding at the bottom
- Modern, clean Web3/crypto trading platform style
- 1200x630 pixels aspect ratio (Twitter/Facebook OG standard)
- Make it eye-catching and shareable`;

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            modalities: ["image", "text"]
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (imageData && imageData.startsWith('data:image')) {
            // Extract base64 data and return as image
            const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
            if (base64Match) {
              const mimeType = `image/${base64Match[1]}`;
              const base64Data = base64Match[2];
              const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              
              return new Response(binaryData, {
                headers: {
                  ...corsHeaders,
                  'Content-Type': mimeType,
                  'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
                },
              });
            }
          }
        } else {
          console.error("AI image generation failed:", response.status);
        }
      } catch (aiError) {
        console.error("AI image generation error:", aiError);
      }
    }

    // Fallback: Generate a simple SVG OG image
    const svg = generateFallbackSVG(title, subtitle, symbol, price, marketCap);
    
    return new Response(svg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error("OG image generation error:", error);
    
    // Return a simple fallback SVG
    const fallbackSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1a1a2e"/>
      <text x="600" y="300" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle">NoizLabs</text>
      <text x="600" y="360" font-family="Arial, sans-serif" font-size="24" fill="#888" text-anchor="middle">Turn Audio Memes Into Tradeable Assets</text>
    </svg>`;
    
    return new Response(fallbackSvg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
      },
    });
  }
});

function generateFallbackSVG(title: string, subtitle: string, symbol: string, price: string, marketCap: string): string {
  // Escape special characters for SVG
  const escapeXml = (str: string) => str.replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c] || c));

  const safeTitle = escapeXml(title.slice(0, 50));
  const safeSubtitle = escapeXml(subtitle.slice(0, 60));
  const safeSymbol = escapeXml(symbol);
  const safePrice = escapeXml(price);
  const safeMc = escapeXml(marketCap);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a2e"/>
        <stop offset="50%" style="stop-color:#16213e"/>
        <stop offset="100%" style="stop-color:#0f0f23"/>
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#a855f7"/>
        <stop offset="100%" style="stop-color:#6366f1"/>
      </linearGradient>
    </defs>
    
    <!-- Background -->
    <rect width="100%" height="100%" fill="url(#bg)"/>
    
    <!-- Decorative elements -->
    <circle cx="100" cy="100" r="200" fill="#a855f7" opacity="0.1"/>
    <circle cx="1100" cy="530" r="250" fill="#6366f1" opacity="0.1"/>
    
    <!-- Sound wave decoration -->
    <g transform="translate(80, 280)" opacity="0.3">
      <rect x="0" y="20" width="8" height="60" rx="4" fill="#a855f7"/>
      <rect x="15" y="0" width="8" height="100" rx="4" fill="#a855f7"/>
      <rect x="30" y="30" width="8" height="40" rx="4" fill="#a855f7"/>
      <rect x="45" y="10" width="8" height="80" rx="4" fill="#a855f7"/>
      <rect x="60" y="25" width="8" height="50" rx="4" fill="#a855f7"/>
    </g>
    
    <g transform="translate(1020, 280)" opacity="0.3">
      <rect x="0" y="25" width="8" height="50" rx="4" fill="#6366f1"/>
      <rect x="15" y="10" width="8" height="80" rx="4" fill="#6366f1"/>
      <rect x="30" y="30" width="8" height="40" rx="4" fill="#6366f1"/>
      <rect x="45" y="0" width="8" height="100" rx="4" fill="#6366f1"/>
      <rect x="60" y="20" width="8" height="60" rx="4" fill="#6366f1"/>
    </g>
    
    <!-- Content card -->
    <rect x="150" y="120" width="900" height="390" rx="24" fill="#ffffff" opacity="0.05"/>
    <rect x="150" y="120" width="900" height="390" rx="24" stroke="url(#accent)" stroke-width="2" fill="none" opacity="0.3"/>
    
    <!-- Symbol badge -->
    ${safeSymbol ? `<rect x="520" y="150" width="160" height="40" rx="20" fill="url(#accent)"/>
    <text x="600" y="178" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">$${safeSymbol}</text>` : ''}
    
    <!-- Title -->
    <text x="600" y="250" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle">${safeTitle}</text>
    
    <!-- Subtitle -->
    <text x="600" y="300" font-family="Arial, sans-serif" font-size="24" fill="#a0a0a0" text-anchor="middle">${safeSubtitle}</text>
    
    <!-- Stats -->
    ${safePrice ? `
    <rect x="280" y="340" width="280" height="80" rx="12" fill="#ffffff" opacity="0.05"/>
    <text x="420" y="375" font-family="Arial, sans-serif" font-size="16" fill="#888" text-anchor="middle">PRICE</text>
    <text x="420" y="405" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#22c55e" text-anchor="middle">${safePrice}</text>
    ` : ''}
    
    ${safeMc ? `
    <rect x="640" y="340" width="280" height="80" rx="12" fill="#ffffff" opacity="0.05"/>
    <text x="780" y="375" font-family="Arial, sans-serif" font-size="16" fill="#888" text-anchor="middle">MARKET CAP</text>
    <text x="780" y="405" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#a855f7" text-anchor="middle">${safeMc}</text>
    ` : ''}
    
    <!-- Branding -->
    <text x="600" y="470" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="url(#accent)" text-anchor="middle">🎵 NoizLabs</text>
    <text x="600" y="500" font-family="Arial, sans-serif" font-size="16" fill="#666" text-anchor="middle">The Sound of Web3</text>
    
    <!-- Footer -->
    <text x="600" y="590" font-family="Arial, sans-serif" font-size="18" fill="#555" text-anchor="middle">noizlabs-io.vercel.app</text>
  </svg>`;
}
