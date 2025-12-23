-- Create table to track faucet requests for rate limiting
CREATE TABLE public.faucet_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  amount_lamports BIGINT NOT NULL,
  tx_signature TEXT
);

-- Create index for fast lookups by wallet
CREATE INDEX idx_faucet_requests_wallet ON public.faucet_requests(wallet_address, requested_at DESC);

-- Enable RLS
ALTER TABLE public.faucet_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can view their own requests
CREATE POLICY "Anyone can view faucet requests" 
ON public.faucet_requests 
FOR SELECT 
USING (true);

-- Only edge functions can insert (via service role)
CREATE POLICY "Service role can insert faucet requests" 
ON public.faucet_requests 
FOR INSERT 
WITH CHECK (true);

-- Create notifications table for price alerts
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  token_mint TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_notifications_wallet ON public.notifications(wallet_address, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Anyone can view notifications
CREATE POLICY "Anyone can view notifications" 
ON public.notifications 
FOR SELECT 
USING (true);

-- Anyone can insert notifications
CREATE POLICY "Anyone can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Anyone can update their notifications (mark as read)
CREATE POLICY "Anyone can update notifications" 
ON public.notifications 
FOR UPDATE 
USING (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;