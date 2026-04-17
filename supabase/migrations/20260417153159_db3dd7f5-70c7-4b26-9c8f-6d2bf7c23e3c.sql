-- ============================================================
-- RLS SECURITY HARDENING
-- ============================================================

-- 1. TOKENS TABLE
DROP POLICY IF EXISTS "Anyone can update token reserves" ON public.tokens;
DROP POLICY IF EXISTS "Anyone can insert tokens" ON public.tokens;
DROP POLICY IF EXISTS "Only service role can insert tokens" ON public.tokens;
DROP POLICY IF EXISTS "Only service role can update tokens" ON public.tokens;

CREATE POLICY "Only service role can insert tokens"
  ON public.tokens FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update tokens"
  ON public.tokens FOR UPDATE USING (false);

-- 2. TRADE HISTORY TABLE
DROP POLICY IF EXISTS "Anyone can insert trade history" ON public.trade_history;
DROP POLICY IF EXISTS "Only service role can insert trades" ON public.trade_history;
DROP POLICY IF EXISTS "Only service role can insert trade history" ON public.trade_history;

CREATE POLICY "Only service role can insert trade history"
  ON public.trade_history FOR INSERT WITH CHECK (false);

-- 3. AUDIO CLIPS TABLE
DROP POLICY IF EXISTS "Anyone can insert audio clips" ON public.audio_clips;
DROP POLICY IF EXISTS "Anyone can update audio clips" ON public.audio_clips;
DROP POLICY IF EXISTS "Only service role can insert audio clips" ON public.audio_clips;
DROP POLICY IF EXISTS "Only service role can update clips" ON public.audio_clips;
DROP POLICY IF EXISTS "Creators can update their own clips" ON public.audio_clips;

CREATE POLICY "Only service role can insert audio clips"
  ON public.audio_clips FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update audio clips"
  ON public.audio_clips FOR UPDATE USING (false);

-- 4. TOKEN VESTING TABLE
DROP POLICY IF EXISTS "Anyone can insert vesting records" ON public.token_vesting;
DROP POLICY IF EXISTS "Only service role can insert vesting records" ON public.token_vesting;

CREATE POLICY "Only service role can insert vesting records"
  ON public.token_vesting FOR INSERT WITH CHECK (false);

-- 5. ADMIN WALLETS TABLE
DROP POLICY IF EXISTS "Anyone can view admin wallets" ON public.admin_wallets;
DROP POLICY IF EXISTS "Only service role can select admin wallets" ON public.admin_wallets;
DROP POLICY IF EXISTS "Only service role can view admin wallets" ON public.admin_wallets;

CREATE POLICY "Only service role can view admin wallets"
  ON public.admin_wallets FOR SELECT USING (false);

-- 6. USER POINTS TABLE
DROP POLICY IF EXISTS "Anyone can insert points" ON public.user_points;
DROP POLICY IF EXISTS "Anyone can update points" ON public.user_points;
DROP POLICY IF EXISTS "Only service role can insert points" ON public.user_points;
DROP POLICY IF EXISTS "Only service role can update points" ON public.user_points;

CREATE POLICY "Only service role can insert points"
  ON public.user_points FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update points"
  ON public.user_points FOR UPDATE USING (false);

-- 7. USER TASKS TABLE
DROP POLICY IF EXISTS "Anyone can insert tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "Anyone can update tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "Only service role can insert tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "Only service role can update tasks" ON public.user_tasks;

CREATE POLICY "Only service role can insert tasks"
  ON public.user_tasks FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update tasks"
  ON public.user_tasks FOR UPDATE USING (false);