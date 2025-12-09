import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    console.log(`Running task reset at ${now.toISOString()}`);
    console.log(`Today start (UTC): ${todayStart.toISOString()}`);

    // First, convert any remaining weekly tasks to daily
    const { data: convertedTasks, error: convertError } = await supabase
      .from('user_tasks')
      .update({ reset_period: 'daily' })
      .eq('reset_period', 'weekly')
      .select();

    if (convertError) {
      console.error('Error converting weekly tasks:', convertError);
    } else if (convertedTasks && convertedTasks.length > 0) {
      console.log(`Converted ${convertedTasks.length} weekly tasks to daily`);
    }

    // Reset ALL daily tasks where last_reset is before today (UTC midnight)
    const { data: resetTasks, error: resetError } = await supabase
      .from('user_tasks')
      .update({ 
        progress: 0, 
        completed: false, 
        last_reset: now.toISOString() 
      })
      .eq('reset_period', 'daily')
      .lt('last_reset', todayStart.toISOString())
      .select();

    if (resetError) {
      console.error('Error resetting daily tasks:', resetError);
    } else {
      console.log(`Reset ${resetTasks?.length || 0} daily tasks`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All daily quests reset successfully',
        tasksReset: resetTasks?.length || 0,
        tasksConverted: convertedTasks?.length || 0,
        resetTime: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in reset-tasks function:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
