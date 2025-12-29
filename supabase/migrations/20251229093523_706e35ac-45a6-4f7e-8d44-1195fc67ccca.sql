-- First, delete duplicate user_tasks keeping only the oldest one per wallet/task_type
DELETE FROM user_tasks a USING user_tasks b
WHERE a.id > b.id 
AND a.wallet_address = b.wallet_address 
AND a.task_type = b.task_type;

-- Add unique constraint to prevent future duplicates
ALTER TABLE user_tasks 
ADD CONSTRAINT user_tasks_wallet_task_unique UNIQUE (wallet_address, task_type);

-- Create feature_flags table for toggleable features
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Everyone can view feature flags
CREATE POLICY "Anyone can view feature flags" 
ON public.feature_flags 
FOR SELECT 
USING (true);

-- Insert default feature flags (disabled by default)
INSERT INTO public.feature_flags (feature_key, display_name, description, is_enabled) 
VALUES 
  ('user_analytics', 'User Analytics', 'Show personal analytics tab for users', false),
  ('referral_program', 'Referral Program', 'Enable referral program for users', true),
  ('push_notifications', 'Push Notifications', 'Enable push notification features', true);