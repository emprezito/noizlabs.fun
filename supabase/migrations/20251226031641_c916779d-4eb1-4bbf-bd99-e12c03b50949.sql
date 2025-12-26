-- Create table to store push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wallet_address, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies - anyone can insert (for subscription)
CREATE POLICY "Anyone can insert push subscriptions" 
ON public.push_subscriptions 
FOR INSERT 
WITH CHECK (true);

-- Anyone can update their own subscriptions
CREATE POLICY "Anyone can update push subscriptions" 
ON public.push_subscriptions 
FOR UPDATE 
USING (true);

-- Anyone can delete push subscriptions
CREATE POLICY "Anyone can delete push subscriptions" 
ON public.push_subscriptions 
FOR DELETE 
USING (true);

-- Service can select subscriptions for sending notifications
CREATE POLICY "Anyone can select push subscriptions" 
ON public.push_subscriptions 
FOR SELECT 
USING (true);