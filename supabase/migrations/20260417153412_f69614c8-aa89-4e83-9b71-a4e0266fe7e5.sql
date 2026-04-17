-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- TOKENS
CREATE INDEX IF NOT EXISTS idx_tokens_mint_address ON public.tokens(mint_address);
CREATE INDEX IF NOT EXISTS idx_tokens_creator_wallet ON public.tokens(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON public.tokens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_is_graduated ON public.tokens(is_graduated) WHERE is_graduated = true;
CREATE INDEX IF NOT EXISTS idx_tokens_status ON public.tokens(status);

-- TRADE HISTORY
CREATE INDEX IF NOT EXISTS idx_trade_history_mint_address ON public.trade_history(mint_address);
CREATE INDEX IF NOT EXISTS idx_trade_history_wallet_address ON public.trade_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trade_history_token_id ON public.trade_history(token_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_created_at ON public.trade_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_history_mint_created ON public.trade_history(mint_address, created_at DESC);

-- AUDIO CLIPS
CREATE INDEX IF NOT EXISTS idx_audio_clips_wallet_address ON public.audio_clips(wallet_address);
CREATE INDEX IF NOT EXISTS idx_audio_clips_created_at ON public.audio_clips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_clips_category ON public.audio_clips(category);

-- CLIP LIKES
CREATE INDEX IF NOT EXISTS idx_clip_likes_audio_clip_id ON public.clip_likes(audio_clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_likes_wallet_address ON public.clip_likes(wallet_address);

-- USER INTERACTIONS
CREATE INDEX IF NOT EXISTS idx_user_interactions_wallet_address ON public.user_interactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_interactions_audio_clip_id ON public.user_interactions(audio_clip_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON public.user_interactions(created_at DESC);

-- NOTIFICATIONS
CREATE INDEX IF NOT EXISTS idx_notifications_wallet_address ON public.notifications(wallet_address);
CREATE INDEX IF NOT EXISTS idx_notifications_wallet_read ON public.notifications(wallet_address, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- NOTIFICATION PREFERENCES
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_prefs_wallet ON public.notification_preferences(wallet_address);

-- PUSH SUBSCRIPTIONS
CREATE INDEX IF NOT EXISTS idx_push_subs_wallet_address ON public.push_subscriptions(wallet_address);

-- USER POINTS
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_points_wallet_address ON public.user_points(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_points_total_points ON public.user_points(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_user_points_referral_code ON public.user_points(referral_code);

-- USER TASKS
CREATE INDEX IF NOT EXISTS idx_user_tasks_wallet_address ON public.user_tasks(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_tasks_wallet_type ON public.user_tasks(wallet_address, task_type);

-- USER BADGES
CREATE INDEX IF NOT EXISTS idx_user_badges_wallet_address ON public.user_badges(wallet_address);

-- TOKEN VESTING
CREATE INDEX IF NOT EXISTS idx_token_vesting_wallet_address ON public.token_vesting(wallet_address);
CREATE INDEX IF NOT EXISTS idx_token_vesting_mint_address ON public.token_vesting(mint_address);
CREATE INDEX IF NOT EXISTS idx_token_vesting_cliff_end ON public.token_vesting(cliff_end);

-- CREATOR EARNINGS
CREATE INDEX IF NOT EXISTS idx_creator_earnings_wallet_address ON public.creator_earnings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_mint_address ON public.creator_earnings(mint_address);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_created_at ON public.creator_earnings(created_at DESC);

-- TOKEN REMIXES
CREATE INDEX IF NOT EXISTS idx_token_remixes_token_id ON public.token_remixes(token_id);
CREATE INDEX IF NOT EXISTS idx_token_remixes_created_by ON public.token_remixes(created_by);

-- CONNECTED WALLETS
CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_wallets_wallet ON public.connected_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_connected_wallets_last_connected ON public.connected_wallets(last_connected_at DESC);

-- SOUNDS REGISTRY
CREATE INDEX IF NOT EXISTS idx_sounds_registry_sound_id ON public.sounds_registry(sound_id);
CREATE INDEX IF NOT EXISTS idx_sounds_registry_status ON public.sounds_registry(status);
CREATE INDEX IF NOT EXISTS idx_sounds_registry_reserved_by ON public.sounds_registry(reserved_by);

-- ADMIN WALLETS
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_wallets_wallet ON public.admin_wallets(wallet_address);

-- FAUCET REQUESTS
CREATE INDEX IF NOT EXISTS idx_faucet_requests_wallet ON public.faucet_requests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_faucet_requests_requested_at ON public.faucet_requests(requested_at DESC);

-- ANALYTICS SNAPSHOTS
CREATE INDEX IF NOT EXISTS idx_analytics_snapshot_date ON public.analytics_snapshots(snapshot_date DESC);

-- TWEET VERIFICATIONS
CREATE INDEX IF NOT EXISTS idx_tweet_verifications_wallet ON public.tweet_verifications(wallet_address);