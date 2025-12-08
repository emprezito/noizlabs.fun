import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Badge metadata templates
const BADGE_METADATA = {
  newcomer: {
    name: "NoizLabs Newcomer Badge",
    symbol: "NOIZ-NEW",
    description: "Awarded to new members of the NoizLabs community. Welcome to the sound revolution!",
    rarity: "Common",
    color: "#6B7280",
  },
  explorer: {
    name: "NoizLabs Explorer Badge",
    symbol: "NOIZ-EXP",
    description: "Awarded to explorers who have earned 500+ points. Keep discovering new sounds!",
    rarity: "Uncommon",
    color: "#3B82F6",
  },
  enthusiast: {
    name: "NoizLabs Enthusiast Badge",
    symbol: "NOIZ-ENT",
    description: "Awarded to enthusiasts who have earned 2000+ points. Your passion for audio is inspiring!",
    rarity: "Rare",
    color: "#22C55E",
  },
  champion: {
    name: "NoizLabs Champion Badge",
    symbol: "NOIZ-CHP",
    description: "Awarded to champions who have earned 5000+ points. You're a true audio champion!",
    rarity: "Epic",
    color: "#EAB308",
  },
  legend: {
    name: "NoizLabs Legend Badge",
    symbol: "NOIZ-LEG",
    description: "Awarded to legends who have earned 10000+ points. Your legacy echoes through the soundscape!",
    rarity: "Legendary",
    color: "#A855F7",
  },
  elite: {
    name: "NoizLabs Elite Badge",
    symbol: "NOIZ-ELT",
    description: "Awarded to the elite who have earned 25000+ points. You are among the greatest in NoizLabs!",
    rarity: "Mythic",
    color: "#F97316",
  },
};

// Generate SVG badge image
function generateBadgeSVG(badgeLevel: string, metadata: typeof BADGE_METADATA.newcomer): string {
  const levelName = badgeLevel.charAt(0).toUpperCase() + badgeLevel.slice(1);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a2e"/>
        <stop offset="100%" style="stop-color:#16213e"/>
      </linearGradient>
      <linearGradient id="badge" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${metadata.color}"/>
        <stop offset="100%" style="stop-color:${metadata.color}88"/>
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    <!-- Background -->
    <rect width="500" height="500" fill="url(#bg)"/>
    
    <!-- Decorative circles -->
    <circle cx="250" cy="250" r="200" fill="none" stroke="${metadata.color}22" stroke-width="2"/>
    <circle cx="250" cy="250" r="180" fill="none" stroke="${metadata.color}33" stroke-width="1"/>
    <circle cx="250" cy="250" r="160" fill="none" stroke="${metadata.color}44" stroke-width="1"/>
    
    <!-- Main badge circle -->
    <circle cx="250" cy="220" r="120" fill="url(#badge)" filter="url(#glow)"/>
    
    <!-- Badge icon (star/trophy shape) -->
    <polygon points="250,130 270,190 335,190 282,230 302,290 250,255 198,290 218,230 165,190 230,190" 
             fill="#ffffff" opacity="0.9"/>
    
    <!-- Level name -->
    <text x="250" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="${metadata.color}">
      ${levelName}
    </text>
    
    <!-- Badge title -->
    <text x="250" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#ffffff88">
      NoizLabs Badge
    </text>
    
    <!-- Rarity -->
    <text x="250" y="455" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${metadata.color}">
      ${metadata.rarity}
    </text>
    
    <!-- Border -->
    <rect x="10" y="10" width="480" height="480" rx="20" fill="none" stroke="${metadata.color}" stroke-width="3"/>
  </svg>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PINATA_API_KEY = Deno.env.get('PINATA_API_KEY');
    const PINATA_SECRET_KEY = Deno.env.get('PINATA_SECRET_KEY');

    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'IPFS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { badgeLevel, walletAddress } = await req.json();

    if (!badgeLevel || !walletAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing badgeLevel or walletAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metadata = BADGE_METADATA[badgeLevel as keyof typeof BADGE_METADATA];
    if (!metadata) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid badge level' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating badge NFT metadata for ${badgeLevel} - ${walletAddress}`);

    // Generate SVG image
    const svgContent = generateBadgeSVG(badgeLevel, metadata);
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });

    // Upload SVG to Pinata
    const imageFormData = new FormData();
    imageFormData.append('file', svgBlob, `noizlabs-${badgeLevel}-badge.svg`);
    imageFormData.append('pinataMetadata', JSON.stringify({
      name: `NoizLabs ${badgeLevel} Badge Image`,
    }));

    const imageResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: imageFormData,
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error('Failed to upload image:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to upload badge image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageResult = await imageResponse.json();
    const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageResult.IpfsHash}`;

    console.log(`Badge image uploaded: ${imageUrl}`);

    // Create NFT metadata JSON
    const nftMetadata = {
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description,
      image: imageUrl,
      external_url: "https://noizlabs.io",
      attributes: [
        { trait_type: "Badge Level", value: badgeLevel.charAt(0).toUpperCase() + badgeLevel.slice(1) },
        { trait_type: "Rarity", value: metadata.rarity },
        { trait_type: "Owner", value: walletAddress },
        { trait_type: "Minted At", value: new Date().toISOString() },
      ],
      properties: {
        files: [{ uri: imageUrl, type: "image/svg+xml" }],
        category: "image",
        creators: [{ address: walletAddress, share: 100 }],
      },
    };

    // Upload metadata JSON to Pinata
    const metadataResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: JSON.stringify({
        pinataContent: nftMetadata,
        pinataMetadata: {
          name: `NoizLabs ${badgeLevel} Badge Metadata`,
        },
      }),
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error('Failed to upload metadata:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to upload metadata' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metadataResult = await metadataResponse.json();
    const metadataUri = `https://gateway.pinata.cloud/ipfs/${metadataResult.IpfsHash}`;

    console.log(`Badge metadata uploaded: ${metadataUri}`);

    return new Response(
      JSON.stringify({
        success: true,
        metadataUri,
        imageUrl,
        metadata: nftMetadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in create-badge-metadata:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
