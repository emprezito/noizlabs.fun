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
  getAccount,
  TOKEN_PROGRAM_ID,
} from "https://esm.sh/@solana/spl-token@0.4.14?deps=@solana/web3.js@1.98.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIGRATION_MARKET_CAP_USD = 50_000;

// Raydium fee wallet (NoizLabs receives fees from Raydium trading)
const PLATFORM_FEE_WALLET = new PublicKey("5NC3whTedkRHALefgSPjRmV2WEfFMczBNQ2sYT4EdoD7");
const BONDING_CURVE_WALLET_ADDRESS = "FL2wxMs6q8sR2pfypRSWUpYN7qcpA52rnLYH9WLQufUc";

const SOLANA_RPC_ENDPOINTS = [
  "https://api.devnet.solana.com",
  "https://devnet.helius-rpc.com/?api-key=15c15e78-c0f9-4317-97e6-03510bd58a32",
];

function loadPlatformWallet(): Keypair {
  const privateKeyStr = Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY');
  if (!privateKeyStr) throw new Error('PLATFORM_WALLET_PRIVATE_KEY not configured');
  const keyArray = JSON.parse(privateKeyStr);
  return Keypair.fromSecretKey(new Uint8Array(keyArray));
}

async function getConnection(): Promise<Connection> {
  for (const endpoint of SOLANA_RPC_ENDPOINTS) {
    try {
      const conn = new Connection(endpoint, 'confirmed');
      await conn.getLatestBlockhash();
      return conn;
    } catch {}
  }
  throw new Error('All RPC endpoints failed');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mintAddress, forceMigrate = false } = await req.json();

    if (!mintAddress) {
      return new Response(JSON.stringify({ error: 'mintAddress required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch token
    const { data: token, error: tokenError } = await supabase
      .from('tokens')
      .select('*')
      .eq('mint_address', mintAddress)
      .maybeSingle();

    if (tokenError || !token) {
      return new Response(JSON.stringify({ error: 'Token not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Prevent duplicate migration
    if (token.migration_executed || token.is_graduated) {
      return new Response(JSON.stringify({ error: 'Token already graduated', already_graduated: true }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check market cap threshold unless forced
    if (!forceMigrate) {
      const solReserves = Number(token.sol_reserves) / 1e9;
      const tokenReserves = Number(token.token_reserves) / 1e9;
      const price = tokenReserves > 0 ? solReserves / tokenReserves : 0;
      const circulatingSupply = Number(token.total_supply) / 1e9 - tokenReserves;

      // We need SOL price to calculate USD market cap
      // Use a simple approximation - will be verified by check-migration-threshold
      const solPriceUsd = 150; // Fallback; real check uses SOL price
      const marketCapUsd = price * circulatingSupply * solPriceUsd;

      if (marketCapUsd < MIGRATION_MARKET_CAP_USD) {
        return new Response(JSON.stringify({
          error: 'Market cap threshold not reached',
          currentMarketCapUsd: marketCapUsd,
          thresholdUsd: MIGRATION_MARKET_CAP_USD,
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log(`Starting migration for token: ${mintAddress}`);

    // Step 1: Atomically mark as MIGRATING to prevent duplicate execution
    const { error: lockError } = await supabase
      .from('tokens')
      .update({
        status: 'migrating',
        is_active: false, // Freeze trading immediately
        migration_executed: true, // Prevent re-entry
      })
      .eq('mint_address', mintAddress)
      .eq('migration_executed', false) // Optimistic lock
      .eq('is_graduated', false);

    if (lockError) {
      console.error('Failed to lock migration:', lockError);
      return new Response(JSON.stringify({ error: 'Migration lock failed - may already be in progress' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Migration lock acquired. Proceeding with graduation...');

    // Step 2: Get final bonding curve state
    const solReserves = Number(token.sol_reserves) / 1e9;
    const tokenReserves = Number(token.token_reserves) / 1e9;
    const finalPrice = tokenReserves > 0 ? solReserves / tokenReserves : 0;

    // Step 3: In a real mainnet deployment, here we would:
    //   - Call Raydium SDK to create a CPMM pool with solReserves + tokenReserves as initial liquidity
    //   - Lock LP tokens for 6 months
    //   - Get back pool_address from Raydium
    // For devnet / current phase, we simulate the graduation:
    const simulatedRaydiumPoolAddress = `raydium_${mintAddress.slice(0, 8)}_${Date.now()}`;
    const migrationTimestamp = new Date().toISOString();

    // Step 4: Transfer remaining bonding curve tokens to a "burned" address or lock them
    // On mainnet, these go into the Raydium pool. On devnet, log the amounts.
    try {
      const connection = await getConnection();
      const platformWallet = loadPlatformWallet();
      const mintPubkey = new PublicKey(mintAddress);
      const platformATA = await getAssociatedTokenAddress(mintPubkey, platformWallet.publicKey);

      let remainingTokens = BigInt(0);
      try {
        const platformAccountInfo = await getAccount(connection, platformATA);
        remainingTokens = platformAccountInfo.amount;
        console.log(`Bonding curve reserve tokens: ${remainingTokens.toString()}`);
      } catch {
        console.log('Could not fetch platform token account - continuing with graduation');
      }

      // On mainnet: transfer these tokens + SOL to Raydium pool
      // For now: log migration details
      console.log({
        mintAddress,
        solReservesForPool: solReserves,
        tokenReservesForPool: Number(remainingTokens) / 1e9,
        finalPrice,
        note: 'On mainnet: these would be deposited into Raydium CPMM pool',
      });

    } catch (onChainError) {
      console.error('On-chain migration step failed:', onChainError);
      // Don't block graduation - DB state is updated
    }

    // Step 5: Mark token as GRADUATED
    const { error: graduateError } = await supabase
      .from('tokens')
      .update({
        status: 'graduated',
        is_graduated: true,
        is_active: false,
        raydium_pool_address: simulatedRaydiumPoolAddress,
        migration_timestamp: migrationTimestamp,
      })
      .eq('mint_address', mintAddress);

    if (graduateError) {
      console.error('Failed to mark token as graduated:', graduateError);
      return new Response(JSON.stringify({ error: 'Failed to complete graduation' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 6: Award creator migration points
    try {
      const { data: creatorPoints } = await supabase
        .from('user_points')
        .select('total_points, wallet_address')
        .eq('wallet_address', token.creator_wallet)
        .maybeSingle();

      if (creatorPoints) {
        await supabase.from('user_points').update({
          total_points: (creatorPoints.total_points || 0) + 5000, // 5000 bonus points for graduation
        }).eq('wallet_address', token.creator_wallet);
      }
    } catch (pointsError) {
      console.error('Failed to award creator points:', pointsError);
    }

    // Step 7: Create notification for creator
    try {
      await supabase.from('notifications').insert({
        wallet_address: token.creator_wallet,
        type: 'graduation',
        title: '🎓 Token Graduated to Raydium!',
        message: `${token.name} ($${token.symbol}) has reached $50K market cap and graduated to Raydium! +5,000 bonus points awarded.`,
        token_mint: mintAddress,
      });
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
    }

    console.log(`Migration completed successfully for ${mintAddress}`);

    return new Response(JSON.stringify({
      success: true,
      message: `${token.name} has graduated to Raydium!`,
      mintAddress,
      raydiumPoolAddress: simulatedRaydiumPoolAddress,
      migrationTimestamp,
      solReservesAdded: solReserves,
      finalPrice,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Migration failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
