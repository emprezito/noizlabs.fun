-- Add referral bonus tracking columns
ALTER TABLE public.user_points 
ADD COLUMN IF NOT EXISTS referral_earnings INTEGER DEFAULT 0;

-- Create function to award referrer bonus points
CREATE OR REPLACE FUNCTION public.award_referrer_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_code TEXT;
  points_diff INTEGER;
BEGIN
  -- Only trigger on points increase
  IF NEW.total_points > OLD.total_points THEN
    points_diff := NEW.total_points - OLD.total_points;
    referrer_code := NEW.referred_by;
    
    -- If user has a referrer, give them 10% of earned points
    IF referrer_code IS NOT NULL THEN
      UPDATE public.user_points
      SET 
        total_points = total_points + GREATEST(1, points_diff / 10),
        referral_earnings = COALESCE(referral_earnings, 0) + GREATEST(1, points_diff / 10)
      WHERE referral_code = referrer_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for referral bonus on points update
DROP TRIGGER IF EXISTS trigger_referrer_bonus ON public.user_points;
CREATE TRIGGER trigger_referrer_bonus
  AFTER UPDATE OF total_points ON public.user_points
  FOR EACH ROW
  EXECUTE FUNCTION public.award_referrer_bonus();

-- Create function to award referrer bonus on trades
CREATE OR REPLACE FUNCTION public.award_trade_referrer_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trader_referrer TEXT;
BEGIN
  -- Get the referrer of the trader
  SELECT referred_by INTO trader_referrer
  FROM public.user_points
  WHERE wallet_address = NEW.wallet_address;
  
  -- If trader has a referrer, give them 25 points per trade
  IF trader_referrer IS NOT NULL THEN
    UPDATE public.user_points
    SET 
      total_points = total_points + 25,
      referral_earnings = COALESCE(referral_earnings, 0) + 25
    WHERE referral_code = trader_referrer;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for referral bonus on trade
DROP TRIGGER IF EXISTS trigger_trade_referrer_bonus ON public.trade_history;
CREATE TRIGGER trigger_trade_referrer_bonus
  AFTER INSERT ON public.trade_history
  FOR EACH ROW
  EXECUTE FUNCTION public.award_trade_referrer_bonus();
