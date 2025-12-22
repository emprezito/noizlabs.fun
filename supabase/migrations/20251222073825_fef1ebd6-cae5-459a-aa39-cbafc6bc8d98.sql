-- Add cover_image_url column to tokens table for tokens created directly via Create page
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS cover_image_url text;