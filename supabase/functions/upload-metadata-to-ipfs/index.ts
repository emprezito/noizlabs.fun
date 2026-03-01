import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const MAX_UPLOADS_PER_WINDOW = 10;
const MAX_METADATA_SIZE = 1024 * 1024; // 1MB for metadata JSON
const MAX_NAME_LENGTH = 200;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PINATA_API_KEY = Deno.env.get('PINATA_API_KEY');
    const PINATA_SECRET_KEY = Deno.env.get('PINATA_SECRET_KEY');

    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      console.error('Pinata API keys not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'IPFS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit check
    const walletAddress = req.headers.get('x-wallet-address');
    
    if (walletAddress && walletAddress.length >= 20 && walletAddress.length <= 50) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
        
        const { count } = await supabase
          .from("user_interactions")
          .select("id", { count: "exact", head: true })
          .eq("wallet_address", walletAddress)
          .eq("interaction_type", "ipfs_metadata_upload")
          .gte("created_at", windowStart);

        if ((count || 0) >= MAX_UPLOADS_PER_WINDOW) {
          return new Response(
            JSON.stringify({ success: false, error: `Rate limit exceeded. Maximum ${MAX_UPLOADS_PER_WINDOW} uploads per hour.` }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase.from("user_interactions").insert({
          wallet_address: walletAddress,
          interaction_type: "ipfs_metadata_upload",
        });
      }
    }

    const rawBody = await req.text();
    
    // Size check
    if (rawBody.length > MAX_METADATA_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: 'Metadata too large' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { metadata, name } = parsed;

    if (!metadata || !name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Metadata and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Uploading metadata for: ${name}`);

    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `${name.substring(0, 100)}-metadata`,
          keyvalues: { app: 'noizlabs', type: 'metadata' }
        },
        pinataOptions: { cidVersion: 1 }
      }),
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('Pinata metadata upload failed:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to upload metadata to IPFS' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pinataResult = await pinataResponse.json();
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${pinataResult.IpfsHash}`;

    console.log(`Metadata uploaded successfully: ${ipfsUrl}`);

    return new Response(
      JSON.stringify({ success: true, url: ipfsUrl, hash: pinataResult.IpfsHash }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in upload-metadata-to-ipfs function:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: 'Upload failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
