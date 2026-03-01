import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const MAX_UPLOADS_PER_WINDOW = 10;

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

    // Extract wallet address from request headers for rate limiting
    const walletAddress = req.headers.get('x-wallet-address');
    
    if (walletAddress && walletAddress.length >= 20 && walletAddress.length <= 50) {
      // Rate limit check using Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
        
        const { count } = await supabase
          .from("user_interactions")
          .select("id", { count: "exact", head: true })
          .eq("wallet_address", walletAddress)
          .eq("interaction_type", "ipfs_upload")
          .gte("created_at", windowStart);

        if ((count || 0) >= MAX_UPLOADS_PER_WINDOW) {
          return new Response(
            JSON.stringify({ success: false, error: `Rate limit exceeded. Maximum ${MAX_UPLOADS_PER_WINDOW} uploads per hour.` }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Record this upload for rate limiting
        await supabase.from("user_interactions").insert({
          wallet_address: walletAddress,
          interaction_type: "ipfs_upload",
        });
      }
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string || 'audio';

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // File name length validation
    if (fileName.length > 200) {
      return new Response(
        JSON.stringify({ success: false, error: 'File name too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Uploading file: ${fileName}, size: ${file.size} bytes`);

    // Upload to Pinata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file, fileName);
    
    const pinataMetadata = JSON.stringify({
      name: fileName.substring(0, 100),
      keyvalues: { app: 'noizlabs', type: 'audio' }
    });
    pinataFormData.append('pinataMetadata', pinataMetadata);
    pinataFormData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: pinataFormData,
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('Pinata upload failed:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to upload to IPFS' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pinataResult = await pinataResponse.json();
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${pinataResult.IpfsHash}`;

    console.log(`File uploaded successfully: ${ipfsUrl}`);

    return new Response(
      JSON.stringify({ success: true, url: ipfsUrl, hash: pinataResult.IpfsHash }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in upload-to-ipfs function:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: 'Upload failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
