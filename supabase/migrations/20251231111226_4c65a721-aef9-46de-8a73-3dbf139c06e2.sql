-- Create table to track clip likes per wallet (ensures single like per wallet)
CREATE TABLE IF NOT EXISTS public.clip_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audio_clip_id UUID NOT NULL REFERENCES public.audio_clips(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(audio_clip_id, wallet_address)
);

-- Enable RLS
ALTER TABLE public.clip_likes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view clip likes" 
ON public.clip_likes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert clip likes" 
ON public.clip_likes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can delete their own likes" 
ON public.clip_likes 
FOR DELETE 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_clip_likes_clip_wallet ON public.clip_likes(audio_clip_id, wallet_address);
CREATE INDEX idx_clip_likes_wallet ON public.clip_likes(wallet_address);