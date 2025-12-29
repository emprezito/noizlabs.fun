import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "https://esm.sh/@solana/web3.js@1.98.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Amount to send per request (0.5 SOL)
const FAUCET_AMOUNT = 0.5 * LAMPORTS_PER_SOL;

// Rate limit: 1 request per 6 hours (in milliseconds)
const RATE_LIMIT_MS = 6 * 60 * 60 * 1000; // 6 hours

// Devnet RPC endpoint
const DEVNET_RPC = "https://api.devnet.solana.com";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress } = await req.json();

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "Wallet address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate wallet address
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(walletAddress);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid wallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client for rate limiting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_MS).toISOString();
    const { data: recentRequests, error: rateError } = await supabase
      .from("faucet_requests")
      .select("requested_at")
      .eq("wallet_address", walletAddress)
      .gte("requested_at", oneHourAgo)
      .order("requested_at", { ascending: false })
      .limit(1);

    if (rateError) {
      console.error("Rate limit check error:", rateError);
    }

    if (recentRequests && recentRequests.length > 0) {
      const lastRequest = new Date(recentRequests[0].requested_at);
      const nextAllowed = new Date(lastRequest.getTime() + RATE_LIMIT_MS);
      const minutesRemaining = Math.ceil((nextAllowed.getTime() - Date.now()) / 60000);
      
      console.log(`Rate limited: ${walletAddress}, next allowed in ${minutesRemaining} minutes`);
      
      return new Response(
        JSON.stringify({
          success: false,
          rateLimited: true,
          message: `Rate limited. Please try again in ${minutesRemaining} minute${minutesRemaining > 1 ? "s" : ""}.`,
          nextAllowedAt: nextAllowed.toISOString(),
          minutesRemaining,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get faucet wallet private key from secrets
    const privateKeyString = Deno.env.get("FAUCET_WALLET_PRIVATE_KEY");
    if (!privateKeyString) {
      console.error("FAUCET_WALLET_PRIVATE_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Faucet not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the private key (supports both JSON array and base58 formats)
    let faucetKeypair: Keypair;
    try {
      // Try parsing as JSON array first
      const privateKeyArray = JSON.parse(privateKeyString);
      faucetKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    } catch {
      // If JSON parse fails, try base58
      try {
        const { decode } = await import("https://esm.sh/bs58@5.0.0");
        const privateKeyBytes = decode(privateKeyString);
        faucetKeypair = Keypair.fromSecretKey(privateKeyBytes);
      } catch {
        console.error("Failed to parse private key");
        return new Response(
          JSON.stringify({ error: "Invalid faucet configuration" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Connect to devnet
    const connection = new Connection(DEVNET_RPC, "confirmed");

    // Check faucet balance
    const faucetBalance = await connection.getBalance(faucetKeypair.publicKey);
    console.log(`Faucet balance: ${faucetBalance / LAMPORTS_PER_SOL} SOL`);

    if (faucetBalance < FAUCET_AMOUNT + 10000) { // Leave some for fees
      console.error("Faucet wallet has insufficient funds");
      return new Response(
        JSON.stringify({ error: "Faucet temporarily unavailable. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: faucetKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: FAUCET_AMOUNT,
      })
    );

    // Send and confirm transaction
    console.log(`Sending ${FAUCET_AMOUNT / LAMPORTS_PER_SOL} SOL to ${walletAddress}`);
    const signature = await sendAndConfirmTransaction(connection, transaction, [faucetKeypair]);

    console.log(`Transfer successful: ${signature}`);

    // Record the request for rate limiting
    const { error: insertError } = await supabase
      .from("faucet_requests")
      .insert({
        wallet_address: walletAddress,
        amount_lamports: FAUCET_AMOUNT,
        tx_signature: signature,
      });

    if (insertError) {
      console.error("Failed to record faucet request:", insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        amount: FAUCET_AMOUNT / LAMPORTS_PER_SOL,
        message: `Sent ${FAUCET_AMOUNT / LAMPORTS_PER_SOL} SOL to your wallet`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Faucet error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send SOL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
