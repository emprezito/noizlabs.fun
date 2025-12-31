-- Create token vesting table to track creator allocations
CREATE TABLE public.token_vesting (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mint_address TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  token_amount BIGINT NOT NULL,
  vesting_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cliff_end TIMESTAMP WITH TIME ZONE NOT NULL,
  claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMP WITH TIME ZONE,
  claim_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.token_vesting ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view vesting schedules"
ON public.token_vesting
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert vesting records"
ON public.token_vesting
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update their vesting claims"
ON public.token_vesting
FOR UPDATE
USING (true);

-- Index for fast lookups
CREATE INDEX idx_token_vesting_wallet ON public.token_vesting(wallet_address);
CREATE INDEX idx_token_vesting_mint ON public.token_vesting(mint_address);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_vesting;