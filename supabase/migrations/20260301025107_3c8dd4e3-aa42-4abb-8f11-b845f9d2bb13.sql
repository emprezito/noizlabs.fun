
-- 1. Block all client updates on user_points (only server-side/service role can update)
DROP POLICY IF EXISTS "Anyone can update points" ON public.user_points;
CREATE POLICY "Only service role can update points" ON public.user_points
FOR UPDATE USING (false);

-- 2. Block all client updates on audio_clips (only server-side can update engagement metrics)
DROP POLICY IF EXISTS "Anyone can update engagement metrics" ON public.audio_clips;
CREATE POLICY "Only service role can update clips" ON public.audio_clips
FOR UPDATE USING (false);

-- 3. Block client inserts on user_points (server-side only for initialization)
DROP POLICY IF EXISTS "Anyone can insert points" ON public.user_points;
CREATE POLICY "Only service role can insert points" ON public.user_points
FOR INSERT WITH CHECK (false);

-- 4. Block client inserts on user_tasks (server-side only)
DROP POLICY IF EXISTS "Anyone can insert tasks" ON public.user_tasks;
CREATE POLICY "Only service role can insert tasks" ON public.user_tasks
FOR INSERT WITH CHECK (false);

-- 5. Block client updates on user_tasks (server-side only)
DROP POLICY IF EXISTS "Anyone can update tasks" ON public.user_tasks;
CREATE POLICY "Only service role can update tasks" ON public.user_tasks
FOR UPDATE USING (false);
