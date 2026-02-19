import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIGRATION_MARKET_CAP_USD = 50_000;

// Fetch SOL price in USD
async function getSolPriceUsd(): Promise<number> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await res.json();
    return data.solana?.usd || 150;
  } catch {
    return 150; // Fallback
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional specific mint to check
    let specificMint: string | null = null;
    try {
      const body = await req.json();
      specificMint = body?.mintAddress || null;
    } catch {}

    // Fetch current SOL price
    const solPriceUsd = await getSolPriceUsd();
    console.log(`SOL price: $${solPriceUsd}`);

    // Fetch all active (non-graduated) tokens
    let query = supabase
      .from('tokens')
      .select('id, mint_address, name, symbol, sol_reserves, token_reserves, total_supply, status, is_graduated, migration_executed')
      .eq('is_active', true)
      .eq('is_graduated', false)
      .eq('migration_executed', false);

    if (specificMint) {
      query = query.eq('mint_address', specificMint);
    }

    const { data: tokens, error } = await query;

    if (error) {
      throw error;
    }

    const results = [];
    const tokensToMigrate = [];

    for (const token of tokens || []) {
      const solReserves = Number(token.sol_reserves) / 1e9;
      const tokenReserves = Number(token.token_reserves) / 1e9;
      const totalSupply = Number(token.total_supply) / 1e9;

      // Current price in SOL per token
      const priceInSol = tokenReserves > 0 ? solReserves / tokenReserves : 0;

      // Circulating supply = total supply - tokens still in bonding curve reserve
      const circulatingSupply = Math.max(0, totalSupply - tokenReserves);

      // Market cap = price in SOL × circulating supply × SOL/USD
      const marketCapUsd = priceInSol * circulatingSupply * solPriceUsd;
      const marketCapSol = priceInSol * circulatingSupply;

      const progressPercent = Math.min(100, (marketCapUsd / MIGRATION_MARKET_CAP_USD) * 100);

      const tokenResult = {
        mintAddress: token.mint_address,
        name: token.name,
        symbol: token.symbol,
        priceInSol,
        circulatingSupply,
        marketCapUsd,
        marketCapSol,
        progressPercent,
        thresholdUsd: MIGRATION_MARKET_CAP_USD,
        readyToGraduate: marketCapUsd >= MIGRATION_MARKET_CAP_USD,
      };

      results.push(tokenResult);

      if (marketCapUsd >= MIGRATION_MARKET_CAP_USD) {
        tokensToMigrate.push(token.mint_address);
        console.log(`🎓 Token ${token.name} ready for graduation! Market cap: $${marketCapUsd.toFixed(0)}`);
      }
    }

    // Trigger migration for eligible tokens
    const migrationResults = [];
    for (const mint of tokensToMigrate) {
      try {
        const projectId = Deno.env.get('SUPABASE_URL')?.replace('https://', '').replace('.supabase.co', '') || '';
        const migrationUrl = `https://${projectId}.supabase.co/functions/v1/execute-migration`;
        
        const migrationRes = await fetch(migrationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ mintAddress: mint }),
        });

        const migrationData = await migrationRes.json();
        migrationResults.push({ mint, result: migrationData });
        
        if (migrationData.success) {
          console.log(`✅ Migration triggered successfully for ${mint}`);
        }
      } catch (migrationError) {
        console.error(`Failed to trigger migration for ${mint}:`, migrationError);
        migrationResults.push({ mint, error: String(migrationError) });
      }
    }

    return new Response(JSON.stringify({
      solPriceUsd,
      thresholdUsd: MIGRATION_MARKET_CAP_USD,
      tokensChecked: results.length,
      tokensReadyToGraduate: tokensToMigrate.length,
      tokens: results,
      migrationResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Check migration threshold error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
