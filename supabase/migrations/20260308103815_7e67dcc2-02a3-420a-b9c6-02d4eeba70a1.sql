
-- Restrict push_subscriptions SELECT to service role only
DROP POLICY IF EXISTS "Anyone can select push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Only service role can select push subscriptions" ON public.push_subscriptions FOR SELECT USING (false);

-- Restrict admin_wallets SELECT to service role only
DROP POLICY IF EXISTS "Anyone can view admin wallets" ON public.admin_wallets;
CREATE POLICY "Only service role can select admin wallets" ON public.admin_wallets FOR SELECT USING (false);
