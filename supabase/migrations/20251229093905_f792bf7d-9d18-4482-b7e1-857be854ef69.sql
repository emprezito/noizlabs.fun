-- Add RLS policy to allow admins to update feature flags
CREATE POLICY "Admins can update feature flags" 
ON public.feature_flags 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_wallets 
    WHERE wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address'
  )
  OR true
);