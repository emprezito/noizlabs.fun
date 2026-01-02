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

// Calculate claimable amount based on linear vesting
function calculateClaimableAmount(
  vestingStart: Date,
  totalAmount: number,
  totalClaimed: number,
  vestingDurationDays: number,
  claimIntervalDays: number,
  lastClaimAt: Date | null
): { claimable: number; percentVested: number; canClaim: boolean; nextClaimIn: number } {
  const now = new Date();
  const startTime = vestingStart.getTime();
  const nowTime = now.getTime();
  const vestingDurationMs = vestingDurationDays * 24 * 60 * 60 * 1000;
  const claimIntervalMs = claimIntervalDays * 24 * 60 * 60 * 1000;
  
  // Calculate time elapsed since vesting start
  const elapsed = Math.max(0, nowTime - startTime);
  
  // Calculate percentage vested (0 to 100)
  const percentVested = Math.min(100, (elapsed / vestingDurationMs) * 100);
  
  // Calculate total tokens that should be vested by now
  const totalVestedNow = Math.floor((totalAmount * percentVested) / 100);
  
  // Claimable = total vested - already claimed
  const claimable = Math.max(0, totalVestedNow - totalClaimed);
  
  // Check if enough time has passed since last claim (minimum 2 days)
  let canClaim = claimable > 0;
  let nextClaimIn = 0;
  
  if (lastClaimAt) {
    const lastClaimTime = lastClaimAt.getTime();
    const timeSinceLastClaim = nowTime - lastClaimTime;
    if (timeSinceLastClaim < claimIntervalMs) {
      canClaim = false;
      nextClaimIn = Math.ceil((claimIntervalMs - timeSinceLastClaim) / (1000 * 60 * 60)); // hours
    }
  }
  
  return { claimable, percentVested, canClaim, nextClaimIn };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vestingId, walletAddress, action } = await req.json();

    if (!vestingId || !walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing vestingId or walletAddress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Claim vested tokens request:", { vestingId, walletAddress, action });

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

    // Calculate claimable amount
    const vestingStart = new Date(vesting.vesting_start);
    const totalAmount = Number(vesting.token_amount);
    const totalClaimed = Number(vesting.total_claimed || 0);
    const vestingDurationDays = vesting.vesting_duration_days || 21;
    const claimIntervalDays = vesting.claim_interval_days || 2;
    const lastClaimAt = vesting.last_claim_at ? new Date(vesting.last_claim_at) : null;

    const { claimable, percentVested, canClaim, nextClaimIn } = calculateClaimableAmount(
      vestingStart,
      totalAmount,
      totalClaimed,
      vestingDurationDays,
      claimIntervalDays,
      lastClaimAt
    );

    // If just checking status, return info
    if (action === "status") {
      return new Response(
        JSON.stringify({
          vestingId: vesting.id,
          mintAddress: vesting.mint_address,
          totalAmount,
          totalClaimed,
          claimable,
          percentVested,
          canClaim,
          nextClaimIn,
          vestingStart: vesting.vesting_start,
          vestingDurationDays,
          claimIntervalDays,
          lastClaimAt: vesting.last_claim_at,
          fullyVested: percentVested >= 100,
          fullyClaimed: totalClaimed >= totalAmount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if can claim
    if (!canClaim) {
      if (nextClaimIn > 0) {
        return new Response(
          JSON.stringify({ 
            error: "Too soon to claim", 
            nextClaimIn,
            message: `You can claim again in ${nextClaimIn} hours`
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "No tokens available to claim" }),
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
    
    // Decode platform wallet keypair - handle both JSON array and base58 formats
    let platformKeypair: Keypair;
    try {
      // Check if it's a JSON array format (starts with '[')
      if (platformWalletPrivateKey.trim().startsWith('[')) {
        const secretKeyArray = JSON.parse(platformWalletPrivateKey);
        platformKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
      } else {
        // Assume base58 format
        platformKeypair = Keypair.fromSecretKey(decodeBase58(platformWalletPrivateKey));
      }
    } catch (keyError) {
      console.error("Error parsing PLATFORM_WALLET_PRIVATE_KEY:", keyError);
      return new Response(
        JSON.stringify({ error: "Invalid platform wallet configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get addresses
    const mintAddress = new PublicKey(vesting.mint_address);
    const creatorWallet = new PublicKey(walletAddress);
    const platformATA = await getAssociatedTokenAddress(mintAddress, PLATFORM_WALLET);
    const creatorATA = await getAssociatedTokenAddress(mintAddress, creatorWallet);

    console.log("Transferring vested tokens:", {
      mint: vesting.mint_address,
      claimableAmount: claimable,
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

    // Transfer claimable tokens from platform wallet to creator
    tx.add(
      createTransferInstruction(
        platformATA,
        creatorATA,
        platformKeypair.publicKey,
        BigInt(claimable),
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

    // Update vesting record
    const newTotalClaimed = totalClaimed + claimable;
    const fullyClaimed = newTotalClaimed >= totalAmount;
    
    const { error: updateError } = await supabase
      .from("token_vesting")
      .update({
        total_claimed: newTotalClaimed,
        claimed: fullyClaimed,
        claimed_at: fullyClaimed ? new Date().toISOString() : null,
        claim_signature: signature,
        last_claim_at: new Date().toISOString(),
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
        amountClaimed: claimable,
        totalClaimed: newTotalClaimed,
        remainingToVest: totalAmount - newTotalClaimed,
        percentVested,
        fullyClaimed,
        message: `Successfully claimed ${(claimable / 1e9).toFixed(4)} tokens`,
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
