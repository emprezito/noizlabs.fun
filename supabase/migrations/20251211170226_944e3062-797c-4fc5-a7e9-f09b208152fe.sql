-- Drop and recreate the referral bonus trigger with recursion protection
DROP TRIGGER IF EXISTS award_referrer_points_trigger ON public.user_points;

-- Recreate the function with recursion guard
CREATE OR REPLACE FUNCTION public.award_referrer_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  referrer_code TEXT;
  points_diff INTEGER;
BEGIN
  -- Prevent infinite recursion by checking if this is a referral earnings update
  IF NEW.referral_earnings IS DISTINCT FROM OLD.referral_earnings THEN
    RETURN NEW;
  END IF;

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
$function$;

-- Recreate the trigger
CREATE TRIGGER award_referrer_points_trigger
AFTER UPDATE ON public.user_points
FOR EACH ROW
EXECUTE FUNCTION public.award_referrer_bonus();