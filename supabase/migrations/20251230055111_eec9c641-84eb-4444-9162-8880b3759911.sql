-- Create table to track remix variations for each token
CREATE TABLE public.token_remixes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  mint_address TEXT NOT NULL,
  variation_type TEXT NOT NULL, -- 'slow', 'reverb', 'distorted', 'lofi', 'vaporwave', 'nightcore'
  remix_audio_url TEXT, -- Will store generated audio URL when available
  remix_concept TEXT, -- AI-generated remix concept/description
  created_by TEXT NOT NULL, -- wallet address of creator
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_paid BOOLEAN NOT NULL DEFAULT false, -- Whether this variation required payment
  payment_tx_signature TEXT, -- Transaction signature for paid remixes
  UNIQUE(token_id, variation_type)
);

-- Enable RLS
ALTER TABLE public.token_remixes ENABLE ROW LEVEL SECURITY;

-- Anyone can view remixes
CREATE POLICY "Anyone can view token remixes"
ON public.token_remixes
FOR SELECT
USING (true);

-- Anyone can insert remixes
CREATE POLICY "Anyone can insert token remixes"
ON public.token_remixes
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_token_remixes_token_id ON public.token_remixes(token_id);
CREATE INDEX idx_token_remixes_mint_address ON public.token_remixes(mint_address);