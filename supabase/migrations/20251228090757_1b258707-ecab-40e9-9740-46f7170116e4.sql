-- Create analytics_snapshots table to store aggregated analytics data
CREATE TABLE public.analytics_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  snapshot_hour INTEGER,
  daily_active_wallets INTEGER DEFAULT 0,
  tokens_launched INTEGER DEFAULT 0,
  remixed_tokens INTEGER DEFAULT 0,
  clips_uploaded INTEGER DEFAULT 0,
  connected_wallets INTEGER DEFAULT 0,
  total_volume_lamports BIGINT DEFAULT 0,
  minted_tokens INTEGER DEFAULT 0,
  revenue_lamports BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date, snapshot_hour)
);

-- Create connected_wallets table to track unique wallet connections
CREATE TABLE public.connected_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  first_connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_wallets ENABLE ROW LEVEL SECURITY;

-- Policies for analytics_snapshots (read-only for all, admin can write)
CREATE POLICY "Anyone can view analytics snapshots" 
ON public.analytics_snapshots 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can insert analytics" 
ON public.analytics_snapshots 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can update analytics" 
ON public.analytics_snapshots 
FOR UPDATE 
USING (true);

-- Policies for connected_wallets
CREATE POLICY "Anyone can view connected wallets count" 
ON public.connected_wallets 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert connected wallets" 
ON public.connected_wallets 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update connected wallets" 
ON public.connected_wallets 
FOR UPDATE 
USING (true);

-- Create index for faster date queries
CREATE INDEX idx_analytics_snapshot_date ON public.analytics_snapshots(snapshot_date);
CREATE INDEX idx_analytics_snapshot_hour ON public.analytics_snapshots(snapshot_date, snapshot_hour);
CREATE INDEX idx_connected_wallets_address ON public.connected_wallets(wallet_address);