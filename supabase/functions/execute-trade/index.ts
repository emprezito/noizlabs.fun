import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "https://esm.sh/@solana/web3.js@1.98.4";
import { 
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "https://esm.sh/@solana/spl-token@0.4.14?deps=@solana/web3.js@1.98.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform wallet that holds tokens for bonding curve
const BONDING_CURVE_WALLET = new PublicKey("FL2wxMs6q8sR2pfypRSWUpYN7qcpA52rnLYH9WLQufUc");
const PLATFORM_FEE_WALLET = new PublicKey("5NC3whTedkRHALefgSPjRmV2WEfFMczBNQ2sYT4EdoD7");

// Trade limits
const MAX_TRADE_SOL = 10 * LAMPORTS_PER_SOL; // 10 SOL max per trade
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 trades per minute

// Solana RPC endpoints
const heliusKey = Deno.env.get('HELIUS_API_KEY');
const SOLANA_RPC_ENDPOINTS = [
  "https://api.devnet.solana.com",
  ...(heliusKey ? [`https://devnet.helius-rpc.com/?api-key=${heliusKey}`] : []),
];

interface TradeRequest {
  mintAddress: string;
  walletAddress: string;
  tradeType: 'buy' | 'sell';
  amount: number;
  signature: string;
}

function loadPlatformWallet(): Keypair {
  const privateKeyStr = Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY');
  if (!privateKeyStr) throw new Error('PLATFORM_WALLET_PRIVATE_KEY not configured');
  try {
    const keyArray = JSON.parse(privateKeyStr);
    return Keypair.fromSecretKey(new Uint8Array(keyArray));
  } catch {
    throw new Error('Invalid PLATFORM_WALLET_PRIVATE_KEY format. Expected JSON array.');
  }
}

function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/** Check and update rate limit for a wallet. Returns true if allowed. */
async function checkRateLimit(supabase: any, walletAddress: string): Promise<boolean> {
  const key = `trade_rate_${walletAddress}`;
  
  const { data } = await supabase
    .from('rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .maybeSingle();

  const now = new Date();

  if (!data) {
    await supabase.from('rate_limits').upsert({ key, count: 1, window_start: now.toISOString() });
    return true;
  }

  const windowAge = now.getTime() - new Date(data.window_start).getTime();
  
  if (windowAge >= RATE_LIMIT_WINDOW_MS) {
    // Reset window
    await supabase.from('rate_limits').upsert({ key, count: 1, window_start: now.toISOString() });
    return true;
  }

  if (data.count >= RATE_LIMIT_MAX) {
    return false;
  }

  await supabase.from('rate_limits').upsert({ key, count: data.count + 1, window_start: data.window_start });
  return true;
}

/** Connect to Solana with retry across multiple endpoints */
async function getConnection(): Promise<Connection> {
  for (const endpoint of SOLANA_RPC_ENDPOINTS) {
    try {
      const conn = new Connection(endpoint, 'confirmed');
      await conn.getLatestBlockhash();
      console.log('Connected to RPC:', endpoint);
      return conn;
    } catch {
      console.log('RPC endpoint failed:', endpoint);
    }
  }
  throw new Error('All Solana RPC endpoints failed');
}

/** Send transaction with retry logic */
async function sendWithRetry(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  maxRetries = 2
): Promise<string> {
  let lastError: Error | null = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await sendAndConfirmTransaction(connection, transaction, signers, { commitment: 'confirmed' });
    } catch (err: any) {
      lastError = err;
      console.error(`Transaction attempt ${i + 1} failed:`, err.message);
      if (i < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // exponential backoff
      }
    }
  }
  throw lastError!;
}

/** Build buy transaction: transfer tokens from platform to user + fee transfers */
async function buildBuyTransaction(
  connection: Connection,
  platformWallet: Keypair,
  mintPubkey: PublicKey,
  userPubkey: PublicKey,
  tokensOut: bigint,
  platformFee: number,
  creatorFee: number,
  creatorWallet: string | null,
): Promise<Transaction> {
  const platformATA = await getAssociatedTokenAddress(mintPubkey, platformWallet.publicKey);
  const userATA = await getAssociatedTokenAddress(mintPubkey, userPubkey);

  // Verify platform has tokens
  try {
    const acct = await getAccount(connection, platformATA);
    console.log('Platform token balance:', acct.amount.toString());
  } catch {
    throw new Error('Platform wallet has no tokens for this mint.');
  }

  const tx = new Transaction();

  // Create user ATA if needed
  try {
    await getAccount(connection, userATA);
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(platformWallet.publicKey, userATA, userPubkey, mintPubkey));
  }

  // Transfer tokens
  tx.add(createTransferInstruction(platformATA, userATA, platformWallet.publicKey, tokensOut, [], TOKEN_PROGRAM_ID));

  // Platform fee
  if (platformFee > 0) {
    tx.add(SystemProgram.transfer({ fromPubkey: platformWallet.publicKey, toPubkey: PLATFORM_FEE_WALLET, lamports: platformFee }));
  }

  // Creator fee
  if (creatorFee > 0 && creatorWallet) {
    tx.add(SystemProgram.transfer({ fromPubkey: platformWallet.publicKey, toPubkey: new PublicKey(creatorWallet), lamports: creatorFee }));
  }

  return tx;
}

/** Build sell transaction: transfer SOL from platform to user + fee transfers */
function buildSellTransaction(
  platformWallet: Keypair,
  userPubkey: PublicKey,
  solOut: number,
  platformFee: number,
  creatorFee: number,
  creatorWallet: string | null,
): Transaction {
  const tx = new Transaction();

  tx.add(SystemProgram.transfer({ fromPubkey: platformWallet.publicKey, toPubkey: userPubkey, lamports: solOut }));

  if (platformFee > 0) {
    tx.add(SystemProgram.transfer({ fromPubkey: platformWallet.publicKey, toPubkey: PLATFORM_FEE_WALLET, lamports: platformFee }));
  }

  if (creatorFee > 0 && creatorWallet) {
    tx.add(SystemProgram.transfer({ fromPubkey: platformWallet.publicKey, toPubkey: new PublicKey(creatorWallet), lamports: creatorFee }));
  }

  return tx;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mintAddress, walletAddress, tradeType, amount, signature } = await req.json() as TradeRequest;
    console.log(`Processing ${tradeType} trade:`, { mintAddress, walletAddress, amount, signature });

    // --- Input validation ---
    if (!mintAddress || typeof mintAddress !== 'string' || mintAddress.length < 32 || mintAddress.length > 50) {
      return errorResponse('Invalid mintAddress');
    }
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 32 || walletAddress.length > 50) {
      return errorResponse('Invalid walletAddress');
    }
    if (tradeType !== 'buy' && tradeType !== 'sell') {
      return errorResponse('tradeType must be buy or sell');
    }
    if (typeof amount !== 'number' || amount <= 0 || amount > 1e15 || !Number.isFinite(amount)) {
      return errorResponse('Invalid amount');
    }
    if (!signature || typeof signature !== 'string' || signature.length < 64 || signature.length > 128) {
      return errorResponse('Invalid signature');
    }

    // --- Trade size limit ---
    if (tradeType === 'buy' && amount > MAX_TRADE_SOL) {
      return errorResponse(`Trade too large. Maximum ${MAX_TRADE_SOL / LAMPORTS_PER_SOL} SOL per trade.`);
    }

    // --- Rate limiting ---
    const allowed = await checkRateLimit(supabase, walletAddress);
    if (!allowed) {
      return errorResponse('Rate limit exceeded. Max 10 trades per minute.', 429);
    }

    // --- Connect to Solana ---
    const connection = await getConnection();
    const platformWallet = loadPlatformWallet();

    // --- Verify user's transaction ---
    try {
      const txStatus = await connection.getSignatureStatus(signature);
      if (!txStatus?.value || txStatus.value.err) {
        return errorResponse('Transaction not confirmed or failed. Please try again.');
      }
      console.log('Transaction verified:', signature);
    } catch (verifyError) {
      console.error('Transaction verification failed:', verifyError);
      // Continue - might be too recent
    }

    // --- ATOMIC trade calculation via DB function ---
    const { data: tradeResult, error: tradeError } = await supabase.rpc('execute_trade_atomic', {
      p_mint_address: mintAddress,
      p_trade_type: tradeType,
      p_sol_amount: tradeType === 'buy' ? amount : 0,
      p_token_amount: tradeType === 'sell' ? amount : 0,
    });

    if (tradeError) {
      console.error('Atomic trade failed:', tradeError);
      // Check if it's a known error
      if (tradeError.message?.includes('not found or inactive')) {
        return errorResponse('Token not found or trading is disabled', 404);
      }
      if (tradeError.message?.includes('Insufficient liquidity')) {
        return errorResponse('Insufficient liquidity for this trade');
      }
      return errorResponse(`Trade calculation failed: ${tradeError.message}`, 500);
    }

    if (!tradeResult || tradeResult.length === 0) {
      return errorResponse('Trade failed - token may have been updated by another trade. Please retry.');
    }

    const result = tradeResult[0];
    const mintPubkey = new PublicKey(mintAddress);
    const userPubkey = new PublicKey(walletAddress);

    // --- Execute on-chain transfer ---
    let platformTxSignature: string;
    try {
      if (tradeType === 'buy') {
        console.log(`Buy: ${result.tokens_out} tokens for ${amount} lamports`);
        const tx = await buildBuyTransaction(
          connection, platformWallet, mintPubkey, userPubkey,
          BigInt(result.tokens_out), Number(result.platform_fee), Number(result.creator_fee), result.creator_wallet
        );
        platformTxSignature = await sendWithRetry(connection, tx, [platformWallet]);
      } else {
        console.log(`Sell: ${result.sol_out} lamports for ${amount} tokens`);
        const tx = buildSellTransaction(
          platformWallet, userPubkey,
          Number(result.sol_out), Number(result.platform_fee), Number(result.creator_fee), result.creator_wallet
        );
        platformTxSignature = await sendWithRetry(connection, tx, [platformWallet]);
      }
      console.log('On-chain transfer confirmed:', platformTxSignature);
    } catch (transferError: any) {
      console.error('On-chain transfer failed:', transferError);
      // CRITICAL: The DB reserves were already updated. We need to roll back.
      // Re-run atomic trade in reverse direction to restore reserves
      try {
        await supabase.rpc('execute_trade_atomic', {
          p_mint_address: mintAddress,
          p_trade_type: tradeType === 'buy' ? 'sell' : 'buy',
          p_sol_amount: tradeType === 'sell' ? amount : 0,
          p_token_amount: tradeType === 'buy' ? amount : 0,
        });
        console.log('Reserves rolled back after failed transfer');
      } catch (rollbackError) {
        console.error('CRITICAL: Failed to rollback reserves:', rollbackError);
      }
      return errorResponse(`Transfer failed: ${transferError.message}`, 500);
    }

    // --- Record trade history ---
    const tradeRecord = {
      mint_address: mintAddress,
      wallet_address: walletAddress,
      trade_type: tradeType,
      amount: tradeType === 'buy' ? Number(result.tokens_out) : amount,
      price_lamports: tradeType === 'buy' ? amount : Number(result.sol_out),
      signature: platformTxSignature,
      token_id: result.token_id,
    };

    const { data: tradeData, error: historyError } = await supabase
      .from('trade_history')
      .insert(tradeRecord)
      .select('id')
      .single();

    if (historyError) {
      console.error('Failed to record trade:', historyError);
    }

    // --- Record creator earnings ---
    if (Number(result.creator_fee) > 0 && result.creator_wallet && tradeData) {
      const { error: earningsError } = await supabase
        .from('creator_earnings')
        .insert({
          wallet_address: result.creator_wallet,
          token_id: result.token_id,
          mint_address: mintAddress,
          amount_lamports: Number(result.creator_fee),
          trade_id: tradeData.id,
        });

      if (earningsError) console.error('Failed to record creator earnings:', earningsError);
    }

    // --- Response ---
    const response = {
      success: true,
      tradeType,
      tokensOut: Number(result.tokens_out),
      solOut: Number(result.sol_out),
      platformFee: Number(result.platform_fee),
      creatorFee: Number(result.creator_fee),
      priceImpact: Number(result.price_impact),
      newSolReserves: Number(result.new_sol_reserves),
      newTokenReserves: Number(result.new_token_reserves),
      signature: platformTxSignature,
    };

    console.log('Trade completed successfully:', response);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Trade execution error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
