-- Create triggers for referral bonuses

-- Trigger for awarding referrer bonus when user earns points
CREATE TRIGGER award_referrer_points_trigger
AFTER UPDATE ON public.user_points
FOR EACH ROW
EXECUTE FUNCTION public.award_referrer_bonus();

-- Trigger for awarding referrer bonus when a trade is recorded
CREATE TRIGGER award_trade_referrer_bonus_trigger
AFTER INSERT ON public.trade_history
FOR EACH ROW
EXECUTE FUNCTION public.award_trade_referrer_bonus();