-- Create table to track creator royalty earnings from trades
CREATE TABLE public.creator_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  token_id UUID REFERENCES public.tokens(id),
  mint_address TEXT NOT NULL,
  amount_lamports BIGINT NOT NULL,
  trade_id UUID REFERENCES public.trade_history(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view creator earnings"
ON public.creator_earnings
FOR SELECT
USING (true);

CREATE POLICY "Service role can insert earnings"
ON public.creator_earnings
FOR INSERT
WITH CHECK (true);

-- Create index for quick lookups
CREATE INDEX idx_creator_earnings_wallet ON public.creator_earnings(wallet_address);
CREATE INDEX idx_creator_earnings_token ON public.creator_earnings(mint_address);