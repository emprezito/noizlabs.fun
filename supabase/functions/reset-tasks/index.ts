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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = now.getDay();
    const isMonday = dayOfWeek === 1;
    
    // Calculate week start for weekly reset (stored separately to avoid TS narrowing issues)
    const weekStart = new Date(todayStart);
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysToSubtract);

    console.log(`Running task reset at ${now.toISOString()}`);
    console.log(`Is Monday: ${isMonday}`);

    // Reset daily tasks where last_reset is before today
    const { data: dailyTasks, error: dailyError } = await supabase
      .from('user_tasks')
      .update({ 
        progress: 0, 
        completed: false, 
        last_reset: now.toISOString() 
      })
      .eq('reset_period', 'daily')
      .lt('last_reset', todayStart.toISOString())
      .select();

    if (dailyError) {
      console.error('Error resetting daily tasks:', dailyError);
    } else {
      console.log(`Reset ${dailyTasks?.length || 0} daily tasks`);
    }

    // Reset weekly tasks on Monday
    if (isMonday) {

      const { data: weeklyTasks, error: weeklyError } = await supabase
        .from('user_tasks')
        .update({ 
          progress: 0, 
          completed: false, 
          last_reset: now.toISOString() 
        })
        .eq('reset_period', 'weekly')
        .lt('last_reset', weekStart.toISOString())
        .select();

      if (weeklyError) {
        console.error('Error resetting weekly tasks:', weeklyError);
      } else {
        console.log(`Reset ${weeklyTasks?.length || 0} weekly tasks`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Tasks reset successfully',
        dailyReset: dailyTasks?.length || 0,
        weeklyReset: isMonday ? 'checked' : 'skipped (not Monday)'
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
