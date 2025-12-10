-- Add image_url column to store the badge image URL from IPFS
ALTER TABLE public.user_badges ADD COLUMN IF NOT EXISTS image_url text;