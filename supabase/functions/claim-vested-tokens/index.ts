import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
} from "https://esm.sh/@solana/web3.js@1.98.0";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "https://esm.sh/@solana/spl-token@0.4.8";
import { decode as decodeBase58 } from "https://deno.land/std@0.168.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_WALLET = new PublicKey("FL2wxMs6q8sR2pfypRSWUpYN7qcpA52rnLYH9WLQufUc");
const RPC_URL = "https://api.devnet.solana.com";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vestingId, walletAddress } = await req.json();

    if (!vestingId || !walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing vestingId or walletAddress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Claim vested tokens request:", { vestingId, walletAddress });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch vesting record
    const { data: vesting, error: vestingError } = await supabase
      .from("token_vesting")
      .select("*")
      .eq("id", vestingId)
      .single();

    if (vestingError || !vesting) {
      console.error("Vesting record not found:", vestingError);
      return new Response(
        JSON.stringify({ error: "Vesting record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify wallet ownership
    if (vesting.wallet_address !== walletAddress) {
      return new Response(
        JSON.stringify({ error: "Wallet address does not match vesting record" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already claimed
    if (vesting.claimed) {
      return new Response(
        JSON.stringify({ error: "Tokens already claimed", claimedAt: vesting.claimed_at }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if cliff period has ended
    const cliffEnd = new Date(vesting.cliff_end);
    const now = new Date();
    if (now < cliffEnd) {
      const daysRemaining = Math.ceil((cliffEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return new Response(
        JSON.stringify({ 
          error: "Cliff period not ended", 
          cliffEnd: vesting.cliff_end,
          daysRemaining 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get platform wallet private key
    const platformWalletPrivateKey = Deno.env.get("PLATFORM_WALLET_PRIVATE_KEY");
    if (!platformWalletPrivateKey) {
      console.error("PLATFORM_WALLET_PRIVATE_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Solana connection
    const connection = new Connection(RPC_URL, "confirmed");
    
    // Decode platform wallet keypair
    const platformKeypair = Keypair.fromSecretKey(decodeBase58(platformWalletPrivateKey));
    
    // Get addresses
    const mintAddress = new PublicKey(vesting.mint_address);
    const creatorWallet = new PublicKey(walletAddress);
    const platformATA = await getAssociatedTokenAddress(mintAddress, PLATFORM_WALLET);
    const creatorATA = await getAssociatedTokenAddress(mintAddress, creatorWallet);

    console.log("Transferring vested tokens:", {
      mint: vesting.mint_address,
      amount: vesting.token_amount,
      from: platformATA.toString(),
      to: creatorATA.toString(),
    });

    // Build transaction
    const tx = new Transaction();
    
    // Check if creator ATA exists
    const creatorATAInfo = await connection.getAccountInfo(creatorATA);
    if (!creatorATAInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          platformKeypair.publicKey, // payer
          creatorATA,
          creatorWallet,
          mintAddress
        )
      );
    }

    // Transfer vested tokens from platform wallet to creator
    tx.add(
      createTransferInstruction(
        platformATA,
        creatorATA,
        platformKeypair.publicKey,
        BigInt(vesting.token_amount),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    tx.feePayer = platformKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    // Sign and send
    tx.sign(platformKeypair);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, "confirmed");

    console.log("Vested tokens transferred:", signature);

    // Update vesting record as claimed
    const { error: updateError } = await supabase
      .from("token_vesting")
      .update({
        claimed: true,
        claimed_at: new Date().toISOString(),
        claim_signature: signature,
      })
      .eq("id", vestingId);

    if (updateError) {
      console.error("Error updating vesting record:", updateError);
      // Transaction succeeded, so we still return success
    }

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        amount: vesting.token_amount,
        message: "Vested tokens claimed successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error claiming vested tokens:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to claim vested tokens";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
