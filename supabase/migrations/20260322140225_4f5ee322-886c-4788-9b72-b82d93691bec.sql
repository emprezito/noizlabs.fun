
CREATE OR REPLACE FUNCTION execute_trade_atomic(
  p_mint_address TEXT,
  p_trade_type TEXT,
  p_sol_amount BIGINT,
  p_token_amount BIGINT,
  p_platform_fee_bps INT DEFAULT 40,
  p_creator_fee_bps INT DEFAULT 60,
  p_basis_points_divisor INT DEFAULT 10000
)
RETURNS TABLE(
  old_sol_reserves BIGINT,
  old_token_reserves BIGINT,
  new_sol_reserves BIGINT,
  new_token_reserves BIGINT,
  tokens_out BIGINT,
  sol_out BIGINT,
  platform_fee BIGINT,
  creator_fee BIGINT,
  price_impact NUMERIC,
  creator_wallet TEXT,
  token_id UUID,
  is_active BOOLEAN,
  current_tokens_sold BIGINT,
  current_total_volume BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token RECORD;
  v_k NUMERIC;
  v_sol_after_fees BIGINT;
  v_platform_fee BIGINT;
  v_creator_fee BIGINT;
  v_new_sol BIGINT;
  v_new_token BIGINT;
  v_tokens_out BIGINT;
  v_sol_out BIGINT;
  v_sol_out_before_fees BIGINT;
  v_spot_price NUMERIC;
  v_exec_price NUMERIC;
  v_price_impact NUMERIC;
  v_tokens_sold_delta BIGINT;
  v_volume_delta BIGINT;
BEGIN
  SELECT t.id, t.sol_reserves, t.token_reserves, t.tokens_sold, t.total_volume, t.creator_wallet, t.is_active
  INTO v_token
  FROM tokens t
  WHERE t.mint_address = p_mint_address
    AND t.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found or inactive: %', p_mint_address;
  END IF;

  IF p_trade_type = 'buy' THEN
    v_platform_fee := (p_sol_amount * p_platform_fee_bps) / p_basis_points_divisor;
    v_creator_fee := (p_sol_amount * p_creator_fee_bps) / p_basis_points_divisor;
    v_sol_after_fees := p_sol_amount - v_platform_fee - v_creator_fee;

    v_k := v_token.sol_reserves::NUMERIC * v_token.token_reserves::NUMERIC;
    v_new_sol := v_token.sol_reserves + v_sol_after_fees;
    v_new_token := (v_k / v_new_sol)::BIGINT;
    v_tokens_out := v_token.token_reserves - v_new_token;
    v_sol_out := 0;

    IF v_tokens_out <= 0 THEN
      RAISE EXCEPTION 'Insufficient liquidity for buy';
    END IF;

    v_spot_price := v_token.sol_reserves::NUMERIC / v_token.token_reserves::NUMERIC;
    v_exec_price := CASE WHEN v_tokens_out > 0 THEN v_sol_after_fees::NUMERIC / v_tokens_out ELSE 0 END;
    v_price_impact := CASE WHEN v_spot_price > 0 THEN ABS((v_exec_price - v_spot_price) / v_spot_price) * 100 ELSE 0 END;

    v_tokens_sold_delta := v_tokens_out;
    v_volume_delta := p_sol_amount;

  ELSIF p_trade_type = 'sell' THEN
    v_k := v_token.sol_reserves::NUMERIC * v_token.token_reserves::NUMERIC;
    v_new_token := v_token.token_reserves + p_token_amount;
    v_new_sol := (v_k / v_new_token)::BIGINT;
    v_sol_out_before_fees := v_token.sol_reserves - v_new_sol;

    v_platform_fee := (v_sol_out_before_fees * p_platform_fee_bps) / p_basis_points_divisor;
    v_creator_fee := (v_sol_out_before_fees * p_creator_fee_bps) / p_basis_points_divisor;
    v_sol_out := v_sol_out_before_fees - v_platform_fee - v_creator_fee;
    v_tokens_out := 0;

    IF v_sol_out <= 0 THEN
      RAISE EXCEPTION 'Insufficient liquidity for sell';
    END IF;

    v_spot_price := v_token.sol_reserves::NUMERIC / v_token.token_reserves::NUMERIC;
    v_exec_price := CASE WHEN p_token_amount > 0 THEN v_sol_out_before_fees::NUMERIC / p_token_amount ELSE 0 END;
    v_price_impact := CASE WHEN v_spot_price > 0 THEN ABS((v_exec_price - v_spot_price) / v_spot_price) * 100 ELSE 0 END;

    v_tokens_sold_delta := -p_token_amount;
    v_volume_delta := v_sol_out;

  ELSE
    RAISE EXCEPTION 'Invalid trade type: %', p_trade_type;
  END IF;

  UPDATE tokens
  SET
    sol_reserves = v_new_sol,
    token_reserves = v_new_token,
    tokens_sold = COALESCE(tokens_sold, 0) + v_tokens_sold_delta,
    total_volume = COALESCE(total_volume, 0) + v_volume_delta
  WHERE id = v_token.id;

  RETURN QUERY SELECT
    v_token.sol_reserves,
    v_token.token_reserves,
    v_new_sol,
    v_new_token,
    v_tokens_out,
    v_sol_out,
    v_platform_fee,
    v_creator_fee,
    v_price_impact,
    v_token.creator_wallet,
    v_token.id,
    v_token.is_active,
    (COALESCE(v_token.tokens_sold, 0) + v_tokens_sold_delta)::BIGINT,
    (COALESCE(v_token.total_volume, 0) + v_volume_delta)::BIGINT;
END;
$$;
