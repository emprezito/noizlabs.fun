-- Add social_link column for social quests (follow on X, join TG, etc.)
ALTER TABLE public.quest_definitions 
ADD COLUMN social_link text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.quest_definitions.social_link IS 'URL for social quests where users click to complete (e.g., Twitter/X follow link, Telegram join link)';