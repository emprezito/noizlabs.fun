-- Add columns to tokens table for remix tracking and royalties
ALTER TABLE public.tokens 
ADD COLUMN IF NOT EXISTS original_token_id uuid REFERENCES public.tokens(id),
ADD COLUMN IF NOT EXISTS is_remix boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS royalty_recipient text,
ADD COLUMN IF NOT EXISTS royalty_percentage numeric DEFAULT 0;

-- Create index for efficient remix lookups
CREATE INDEX IF NOT EXISTS idx_tokens_original_token_id ON public.tokens(original_token_id);
CREATE INDEX IF NOT EXISTS idx_tokens_audio_clip_id ON public.tokens(audio_clip_id);