import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string || 'audio';

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Uploading file: ${fileName}, size: ${file.size} bytes`);

    // Upload to Pinata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file, fileName);
    
    const pinataMetadata = JSON.stringify({
      name: fileName,
      keyvalues: {
        app: 'noizlabs',
        type: 'audio'
      }
    });
    pinataFormData.append('pinataMetadata', pinataMetadata);

    const pinataOptions = JSON.stringify({
      cidVersion: 1
    });
    pinataFormData.append('pinataOptions', pinataOptions);

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
      JSON.stringify({ 
        success: true, 
        url: ipfsUrl,
        hash: pinataResult.IpfsHash 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in upload-to-ipfs function:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
