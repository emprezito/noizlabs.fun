-- Update token_vesting table to support linear vesting with partial claims
-- Add columns to track claimed amounts and vesting duration
ALTER TABLE public.token_vesting 
ADD COLUMN IF NOT EXISTS total_claimed bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS vesting_duration_days integer DEFAULT 21,
ADD COLUMN IF NOT EXISTS claim_interval_days integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS last_claim_at timestamp with time zone;

-- Update existing records to have proper values
UPDATE public.token_vesting 
SET total_claimed = CASE WHEN claimed = true THEN token_amount ELSE 0 END,
    vesting_duration_days = 21,
    claim_interval_days = 2
WHERE total_claimed IS NULL;