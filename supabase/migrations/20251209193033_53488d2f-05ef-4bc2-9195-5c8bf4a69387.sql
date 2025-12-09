-- Add cover_image_url column to audio_clips table
ALTER TABLE public.audio_clips
ADD COLUMN cover_image_url text;