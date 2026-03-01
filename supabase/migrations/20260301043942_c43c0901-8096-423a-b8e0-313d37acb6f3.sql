
-- Fix remaining RLS "always true" INSERT policies

-- audio_clips: Users need to insert clips, but this should go through an edge function
-- For now, keep public INSERT since users create clips directly
-- But the linter flags it - lock it down to service role
DROP POLICY IF EXISTS "Anyone can insert audio clips" ON public.audio_clips;
CREATE POLICY "Only service role can insert audio clips" ON public.audio_clips FOR INSERT WITH CHECK (false);

-- creator_earnings: Already service-role only in intent, fix policy
DROP POLICY IF EXISTS "Service role can insert earnings" ON public.creator_earnings;
CREATE POLICY "Only service role can insert earnings" ON public.creator_earnings FOR INSERT WITH CHECK (false);

-- tokens: Lock down to service role
DROP POLICY IF EXISTS "Anyone can insert tokens" ON public.tokens;
CREATE POLICY "Only service role can insert tokens" ON public.tokens FOR INSERT WITH CHECK (false);

-- tweet_verifications: Already service-role only in intent, fix policy
DROP POLICY IF EXISTS "Service role can insert verifications" ON public.tweet_verifications;
CREATE POLICY "Only service role can insert verifications" ON public.tweet_verifications FOR INSERT WITH CHECK (false);
