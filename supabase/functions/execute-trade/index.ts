import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bonding curve constants (pump.fun style)
const PLATFORM_FEE_BPS = 100; // 1% platform fee
const BASIS_POINTS_DIVISOR = 10000;

// Initial virtual reserves for $5k market cap at ~$200/SOL
// Virtual SOL = 25 SOL, Virtual Tokens = 950M (95% of 1B supply)
// Market cap = (sol_reserves / token_reserves) * total_supply = 25 SOL = ~$5k
const INITIAL_VIRTUAL_SOL = 25_000_000_000; // 25 SOL in lamports
const INITIAL_TOKEN_RESERVES = 950_000_000_000_000_000; // 950M tokens with 9 decimals

interface TradeRequest {
  mintAddress: string;
  walletAddress: string;
  tradeType: 'buy' | 'sell';
  amount: number; // SOL amount in lamports for buy, token amount (with decimals) for sell
  signature: string;
}

interface BondingCurveResult {
  tokensOut?: number;
  solOut?: number;
  newSolReserves: number;
  newTokenReserves: number;
  platformFee: number;
  priceImpact: number;
}

/**
 * Pump.fun style bonding curve: x * y = k (constant product)
 * Price = sol_reserves / token_reserves
 * As people buy, sol_reserves ↑ and token_reserves ↓, so price ↑
 */
function calculateBuy(solAmount: number, solReserves: number, tokenReserves: number): BondingCurveResult {
  const platformFee = Math.floor(solAmount * PLATFORM_FEE_BPS / BASIS_POINTS_DIVISOR);
  const solAfterFee = solAmount - platformFee;
  
  // Constant product: k = x * y
  const k = solReserves * tokenReserves;
  const newSolReserves = solReserves + solAfterFee;
  const newTokenReserves = Math.floor(k / newSolReserves);
  const tokensOut = tokenReserves - newTokenReserves;
  
  // Calculate price impact
  const spotPrice = solReserves / tokenReserves;
  const executionPrice = tokensOut > 0 ? solAfterFee / tokensOut : 0;
  const priceImpact = spotPrice > 0 ? Math.abs((executionPrice - spotPrice) / spotPrice) * 100 : 0;
  
  return {
    tokensOut,
    newSolReserves,
    newTokenReserves,
    platformFee,
    priceImpact,
  };
}

/**
 * Sell tokens back to the curve
 */
function calculateSell(tokenAmount: number, solReserves: number, tokenReserves: number): BondingCurveResult {
  const k = solReserves * tokenReserves;
  const newTokenReserves = tokenReserves + tokenAmount;
  const newSolReserves = Math.floor(k / newTokenReserves);
  const solOutBeforeFee = solReserves - newSolReserves;
  
  const platformFee = Math.floor(solOutBeforeFee * PLATFORM_FEE_BPS / BASIS_POINTS_DIVISOR);
  const solOut = solOutBeforeFee - platformFee;
  
  const spotPrice = solReserves / tokenReserves;
  const executionPrice = tokenAmount > 0 ? solOutBeforeFee / tokenAmount : 0;
  const priceImpact = spotPrice > 0 ? Math.abs((executionPrice - spotPrice) / spotPrice) * 100 : 0;
  
  return {
    solOut,
    newSolReserves,
    newTokenReserves,
    platformFee,
    priceImpact,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mintAddress, walletAddress, tradeType, amount, signature }: TradeRequest = await req.json();

    console.log(`Processing ${tradeType} trade:`, { mintAddress, walletAddress, amount, signature });

    // Validate inputs
    if (!mintAddress || !walletAddress || !tradeType || !amount || amount <= 0 || !signature) {
      return new Response(
        JSON.stringify({ error: 'Invalid trade parameters. Required: mintAddress, walletAddress, tradeType, amount, signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current token state
    const { data: token, error: tokenError } = await supabase
      .from('tokens')
      .select('*')
      .eq('mint_address', mintAddress)
      .maybeSingle();

    if (tokenError || !token) {
      console.error('Token not found:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Token not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!token.is_active) {
      return new Response(
        JSON.stringify({ error: 'Token trading is disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const solReserves = Number(token.sol_reserves);
    const tokenReserves = Number(token.token_reserves);

    let result: BondingCurveResult;
    let tradeRecord: any;

    if (tradeType === 'buy') {
      result = calculateBuy(amount, solReserves, tokenReserves);
      
      if (!result.tokensOut || result.tokensOut <= 0) {
        return new Response(
          JSON.stringify({ error: 'Insufficient liquidity for this trade' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store: amount = tokens received, price_lamports = SOL spent
      // This allows calculating price per token as price_lamports / amount
      tradeRecord = {
        mint_address: mintAddress,
        wallet_address: walletAddress,
        trade_type: 'buy',
        amount: result.tokensOut,
        price_lamports: amount, // SOL spent in lamports
        signature,
        token_id: token.id,
      };

      console.log(`Buy result: ${result.tokensOut} tokens for ${amount} lamports, sig: ${signature}`);

    } else {
      result = calculateSell(amount, solReserves, tokenReserves);
      
      if (!result.solOut || result.solOut <= 0) {
        return new Response(
          JSON.stringify({ error: 'Insufficient liquidity for this trade' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store: amount = tokens sold, price_lamports = SOL received
      tradeRecord = {
        mint_address: mintAddress,
        wallet_address: walletAddress,
        trade_type: 'sell',
        amount: amount, // tokens sold
        price_lamports: result.solOut, // SOL received in lamports
        signature,
        token_id: token.id,
      };

      console.log(`Sell result: ${result.solOut} lamports for ${amount} tokens, sig: ${signature}`);
    }

    // Update token reserves
    const { error: updateError } = await supabase
      .from('tokens')
      .update({
        sol_reserves: result.newSolReserves,
        token_reserves: result.newTokenReserves,
        tokens_sold: tradeType === 'buy' 
          ? (token.tokens_sold || 0) + (result.tokensOut || 0)
          : (token.tokens_sold || 0) - amount,
        total_volume: (token.total_volume || 0) + (tradeType === 'buy' ? amount : result.solOut!),
      })
      .eq('mint_address', mintAddress);

    if (updateError) {
      console.error('Failed to update reserves:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update reserves' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record trade in history
    const { error: historyError } = await supabase
      .from('trade_history')
      .insert(tradeRecord);

    if (historyError) {
      console.error('Failed to record trade:', historyError);
    }

    const response = {
      success: true,
      tradeType,
      tokensOut: result.tokensOut,
      solOut: result.solOut,
      platformFee: result.platformFee,
      priceImpact: result.priceImpact,
      newSolReserves: result.newSolReserves,
      newTokenReserves: result.newTokenReserves,
      signature,
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
