
-- 1. Lock down tokens UPDATE to service-role only (prevent reserve manipulation)
DROP POLICY IF EXISTS "Anyone can update token reserves" ON public.tokens;
CREATE POLICY "Only service role can update tokens" 
ON public.tokens FOR UPDATE USING (false);

-- 2. Lock down trade_history INSERT to service-role only (prevent duplicate trade injection)
DROP POLICY IF EXISTS "Anyone can insert trade history" ON public.trade_history;
CREATE POLICY "Only service role can insert trades" 
ON public.trade_history FOR INSERT WITH CHECK (false);

-- 3. Add unique constraint on trade signature to prevent duplicate entries
ALTER TABLE public.trade_history 
ADD CONSTRAINT unique_trade_signature UNIQUE (signature);
