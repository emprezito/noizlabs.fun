
-- Fix 1: Remove overly permissive DELETE policy on clip_likes
-- Deletes are now handled by update-engagement edge function via service role
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.clip_likes;

-- Fix 2: Remove overly permissive INSERT policy on clip_likes
-- Inserts are now handled by update-engagement edge function via service role
DROP POLICY IF EXISTS "Anyone can insert clip likes" ON public.clip_likes;
CREATE POLICY "Only service role can insert clip likes" ON public.clip_likes FOR INSERT WITH CHECK (false);

-- Fix 3: Remove overly permissive INSERT policy on user_interactions  
-- Inserts are now handled by update-engagement edge function via service role
DROP POLICY IF EXISTS "Anyone can insert interactions" ON public.user_interactions;
CREATE POLICY "Only service role can insert interactions" ON public.user_interactions FOR INSERT WITH CHECK (false);

-- Fix 4: Remove overly permissive INSERT/UPDATE policies on notification_preferences
DROP POLICY IF EXISTS "Anyone can insert preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Anyone can update preferences" ON public.notification_preferences;
CREATE POLICY "Only service role can insert preferences" ON public.notification_preferences FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update preferences" ON public.notification_preferences FOR UPDATE USING (false);

-- Fix 5: Remove overly permissive INSERT/UPDATE policies on connected_wallets
DROP POLICY IF EXISTS "Anyone can insert connected wallets" ON public.connected_wallets;
DROP POLICY IF EXISTS "Anyone can update connected wallets" ON public.connected_wallets;
CREATE POLICY "Only service role can insert connected wallets" ON public.connected_wallets FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update connected wallets" ON public.connected_wallets FOR UPDATE USING (false);

-- Fix 6: Remove overly permissive INSERT/UPDATE policies on notifications
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can update notifications" ON public.notifications;
CREATE POLICY "Only service role can insert notifications" ON public.notifications FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update notifications" ON public.notifications FOR UPDATE USING (false);

-- Fix 7: Remove overly permissive INSERT/UPDATE on push_subscriptions
DROP POLICY IF EXISTS "Anyone can insert push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anyone can update push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anyone can delete push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Only service role can insert push subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update push subscriptions" ON public.push_subscriptions FOR UPDATE USING (false);
CREATE POLICY "Only service role can delete push subscriptions" ON public.push_subscriptions FOR DELETE USING (false);

-- Fix 8: Remove overly permissive policies on token_vesting
DROP POLICY IF EXISTS "Anyone can insert vesting records" ON public.token_vesting;
DROP POLICY IF EXISTS "Anyone can update their vesting claims" ON public.token_vesting;
CREATE POLICY "Only service role can insert vesting records" ON public.token_vesting FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update vesting claims" ON public.token_vesting FOR UPDATE USING (false);

-- Fix 9: Remove overly permissive INSERT on user_badges
DROP POLICY IF EXISTS "Anyone can insert badges" ON public.user_badges;
DROP POLICY IF EXISTS "Anyone can update their badges" ON public.user_badges;
CREATE POLICY "Only service role can insert badges" ON public.user_badges FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update badges" ON public.user_badges FOR UPDATE USING (false);

-- Fix 10: Remove overly permissive INSERT on token_remixes (handled by remix-audio edge function)
DROP POLICY IF EXISTS "Anyone can insert token remixes" ON public.token_remixes;
CREATE POLICY "Only service role can insert token remixes" ON public.token_remixes FOR INSERT WITH CHECK (false);

-- Fix 11: Remove overly permissive UPDATE on feature_flags
DROP POLICY IF EXISTS "Admins can update feature flags" ON public.feature_flags;
CREATE POLICY "Only service role can update feature flags" ON public.feature_flags FOR UPDATE USING (false);

-- Fix 12: Remove overly permissive INSERT on analytics_snapshots and UPDATE
DROP POLICY IF EXISTS "Service role can insert analytics" ON public.analytics_snapshots;
DROP POLICY IF EXISTS "Service role can update analytics" ON public.analytics_snapshots;
CREATE POLICY "Only service role can insert analytics" ON public.analytics_snapshots FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update analytics" ON public.analytics_snapshots FOR UPDATE USING (false);

-- Fix 13: Remove overly permissive INSERT on faucet_requests
DROP POLICY IF EXISTS "Service role can insert faucet requests" ON public.faucet_requests;
CREATE POLICY "Only service role can insert faucet_requests" ON public.faucet_requests FOR INSERT WITH CHECK (false);
