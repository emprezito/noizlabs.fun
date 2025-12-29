-- Create table to track tweet verifications
CREATE TABLE IF NOT EXISTS public.tweet_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  tweet_id TEXT NOT NULL UNIQUE,
  tweet_url TEXT NOT NULL,
  verified BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tweet_verifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view tweet verifications"
ON public.tweet_verifications
FOR SELECT
USING (true);

CREATE POLICY "Service role can insert verifications"
ON public.tweet_verifications
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_tweet_verifications_tweet_id ON public.tweet_verifications(tweet_id);
CREATE INDEX idx_tweet_verifications_wallet ON public.tweet_verifications(wallet_address);