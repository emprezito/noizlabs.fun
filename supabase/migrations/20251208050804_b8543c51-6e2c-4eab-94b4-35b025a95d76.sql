
-- Create audio_clips table for uploaded clips
CREATE TABLE public.audio_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  creator TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  plays INTEGER DEFAULT 0,
  wallet_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tokens table for minted tokens
CREATE TABLE public.tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  mint_address TEXT NOT NULL UNIQUE,
  metadata_uri TEXT,
  audio_url TEXT,
  creator_wallet TEXT NOT NULL,
  total_supply BIGINT NOT NULL,
  initial_price BIGINT NOT NULL,
  audio_clip_id UUID REFERENCES public.audio_clips(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trade_history table
CREATE TABLE public.trade_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID REFERENCES public.tokens(id),
  mint_address TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  amount BIGINT NOT NULL,
  price_lamports BIGINT NOT NULL,
  signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_points table
CREATE TABLE public.user_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_tasks table for tracking daily/weekly tasks
CREATE TABLE public.user_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  task_type TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  target INTEGER NOT NULL,
  points_reward INTEGER NOT NULL,
  completed BOOLEAN DEFAULT false,
  reset_period TEXT NOT NULL CHECK (reset_period IN ('daily', 'weekly')),
  last_reset TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_interactions table for tracking clip interactions
CREATE TABLE public.user_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  audio_clip_id UUID REFERENCES public.audio_clips(id),
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('like', 'share', 'play')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.audio_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;

-- Public read access for audio_clips
CREATE POLICY "Anyone can view audio clips" ON public.audio_clips FOR SELECT USING (true);
CREATE POLICY "Anyone can insert audio clips" ON public.audio_clips FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update audio clips" ON public.audio_clips FOR UPDATE USING (true);

-- Public read access for tokens
CREATE POLICY "Anyone can view tokens" ON public.tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tokens" ON public.tokens FOR INSERT WITH CHECK (true);

-- Public read access for trade_history
CREATE POLICY "Anyone can view trade history" ON public.trade_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert trade history" ON public.trade_history FOR INSERT WITH CHECK (true);

-- User points - users can view all, manage their own
CREATE POLICY "Anyone can view points" ON public.user_points FOR SELECT USING (true);
CREATE POLICY "Anyone can insert points" ON public.user_points FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update points" ON public.user_points FOR UPDATE USING (true);

-- User tasks - users can view and manage their own
CREATE POLICY "Anyone can view tasks" ON public.user_tasks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tasks" ON public.user_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tasks" ON public.user_tasks FOR UPDATE USING (true);

-- User interactions
CREATE POLICY "Anyone can view interactions" ON public.user_interactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert interactions" ON public.user_interactions FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_audio_clips_likes ON public.audio_clips(likes DESC);
CREATE INDEX idx_audio_clips_plays ON public.audio_clips(plays DESC);
CREATE INDEX idx_tokens_mint ON public.tokens(mint_address);
CREATE INDEX idx_trade_history_wallet ON public.trade_history(wallet_address);
CREATE INDEX idx_user_points_wallet ON public.user_points(wallet_address);
CREATE INDEX idx_user_tasks_wallet ON public.user_tasks(wallet_address);
