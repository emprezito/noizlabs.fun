
-- Performance indexes for production scale

-- Leaderboard performance
CREATE INDEX IF NOT EXISTS idx_user_points_total 
ON public.user_points(total_points DESC);

-- Trade history per user
CREATE INDEX IF NOT EXISTS idx_trade_history_wallet_date 
ON public.trade_history(wallet_address, created_at DESC);

-- Token sorting by volume (active only)
CREATE INDEX IF NOT EXISTS idx_tokens_volume 
ON public.tokens(total_volume DESC) WHERE is_active = true;

-- Token sorting by market cap (active only)
CREATE INDEX IF NOT EXISTS idx_tokens_sol_reserves
ON public.tokens(sol_reserves DESC) WHERE is_active = true;

-- Sounds registry lookups
CREATE INDEX IF NOT EXISTS idx_sounds_registry_status
ON public.sounds_registry(status, sound_id);

-- Quest lookups per wallet
CREATE INDEX IF NOT EXISTS idx_user_tasks_wallet_period
ON public.user_tasks(wallet_address, reset_period, last_reset);

-- Creator earnings lookups
CREATE INDEX IF NOT EXISTS idx_creator_earnings_wallet
ON public.creator_earnings(wallet_address, created_at DESC);

-- Trade history by mint (for token detail pages)
CREATE INDEX IF NOT EXISTS idx_trade_history_mint
ON public.trade_history(mint_address, created_at DESC);
