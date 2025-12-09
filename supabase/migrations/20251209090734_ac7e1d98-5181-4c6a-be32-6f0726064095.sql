-- Drop the restrictive update policy
DROP POLICY IF EXISTS "Creators can update their own clips" ON public.audio_clips;

-- Create a permissive update policy for engagement fields (likes, plays, shares)
-- Anyone can update engagement metrics
CREATE POLICY "Anyone can update engagement metrics" 
ON public.audio_clips 
FOR UPDATE 
USING (true)
WITH CHECK (true);