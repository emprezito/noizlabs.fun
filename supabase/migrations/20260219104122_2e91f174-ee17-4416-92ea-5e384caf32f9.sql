
-- Add graduation fields to tokens table
ALTER TABLE public.tokens 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_graduated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS raydium_pool_address text,
  ADD COLUMN IF NOT EXISTS migration_timestamp timestamp with time zone,
  ADD COLUMN IF NOT EXISTS migration_executed boolean NOT NULL DEFAULT false;

-- Create index for efficient market cap queries
CREATE INDEX IF NOT EXISTS idx_tokens_status ON public.tokens(status);
CREATE INDEX IF NOT EXISTS idx_tokens_migration ON public.tokens(is_graduated, is_active);

-- Add comment explaining status values
COMMENT ON COLUMN public.tokens.status IS 'Token lifecycle status: active, migrating, graduated';
