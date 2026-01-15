-- Enable realtime for tokens table for live price updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.tokens;

-- Enable realtime for trade_history table for live trade updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_history;