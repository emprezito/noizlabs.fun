use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{self, Mint, MintTo, Token, TokenAccount, Transfer},
};

declare_id!("9m8ApaLxscUk6VhsuN12imf6ZvuCqPt42uDJMA1eRe7Y");

// Constants
pub const TOKEN_CONFIG_SEED: &[u8] = b"token_config";
pub const LP_ACCOUNT_SEED: &[u8] = b"lp_account";
pub const PLATFORM_FEE_BPS: u64 = 25; // 0.25%
pub const BASIS_POINTS_DIVISOR: u64 = 10000;
pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_METADATA_URI_LEN: usize = 200;

// Initial liquidity constants
pub const INITIAL_SOL_RESERVE: u64 = 10_000_000; // 0.01 SOL in lamports
pub const INITIAL_TOKEN_RESERVE_PERCENT: u64 = 10; // 10% of total supply

#[program]
pub mod audio_token_platform {
    use super::*;

    /// Creates a new audio token with a bonding curve for trading
    /// 
    /// # Arguments
    /// * `name` - Token name (max 32 chars)
    /// * `symbol` - Token symbol (max 10 chars) 
    /// * `metadata_uri` - IPFS URI for token metadata (max 200 chars)
    /// * `total_supply` - Total token supply in smallest units (with 9 decimals)
    pub fn create_audio_token(
        ctx: Context<CreateAudioToken>,
        name: String,
        symbol: String,
        metadata_uri: String,
        total_supply: u64,
    ) -> Result<()> {
        // Validate inputs
        require!(name.len() <= MAX_NAME_LEN, ErrorCode::InvalidInput);
        require!(symbol.len() <= MAX_SYMBOL_LEN, ErrorCode::InvalidInput);
        require!(metadata_uri.len() <= MAX_METADATA_URI_LEN, ErrorCode::InvalidInput);
        require!(total_supply > 0, ErrorCode::InvalidAmount);

        let mint = ctx.accounts.mint.key();
        let creator = ctx.accounts.creator.key();
        
        // Get bumps for PDAs
        let token_config_bump = ctx.bumps.token_config;
        let lp_account_bump = ctx.bumps.lp_account;

        // Calculate initial token reserve (10% of total supply goes to bonding curve)
        let initial_token_reserve = total_supply
            .checked_mul(INITIAL_TOKEN_RESERVE_PERCENT)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(100)
            .ok_or(ErrorCode::MathOverflow)?;

        // Initialize TokenConfig account
        let token_config = &mut ctx.accounts.token_config;
        token_config.mint = mint;
        token_config.creator = creator;
        token_config.name = name.clone();
        token_config.symbol = symbol.clone();
        token_config.metadata_uri = metadata_uri.clone();
        token_config.total_supply = total_supply;
        token_config.initial_supply = initial_token_reserve;
        token_config.sol_reserves = INITIAL_SOL_RESERVE;
        token_config.token_reserves = initial_token_reserve;
        token_config.tokens_sold = 0;
        token_config.total_volume = 0;
        token_config.created_at = Clock::get()?.unix_timestamp;
        token_config.bump = token_config_bump;

        // Initialize LP Account
        let lp_account = &mut ctx.accounts.lp_account;
        lp_account.mint = mint;
        lp_account.liquidity = INITIAL_SOL_RESERVE;
        lp_account.timestamp = Clock::get()?.unix_timestamp;
        lp_account.bump = lp_account_bump;

        // Collect platform fee (0.02 SOL = 20_000_000 lamports)
        let platform_fee: u64 = 20_000_000;
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.creator.key(),
            &ctx.accounts.platform_fee_account.key(),
            platform_fee,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.creator.to_account_info(),
                ctx.accounts.platform_fee_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Mint initial token supply to the reserve account
        let seeds = &[
            TOKEN_CONFIG_SEED,
            mint.as_ref(),
            &[token_config_bump],
        ];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.reserve_token_account.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
                signer,
            ),
            initial_token_reserve,
        )?;

        // Create token metadata using Metaplex
        let metadata_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            mint_authority: ctx.accounts.creator.to_account_info(),
            payer: ctx.accounts.creator.to_account_info(),
            update_authority: ctx.accounts.creator.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };

        let data_v2 = DataV2 {
            name: name,
            symbol: symbol,
            uri: metadata_uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                metadata_accounts,
            ),
            data_v2,
            true,  // is_mutable
            true,  // update_authority_is_signer
            None,  // collection_details
        )?;

        msg!("Audio token created: {}", mint);
        msg!("Initial SOL reserves: {} lamports", INITIAL_SOL_RESERVE);
        msg!("Initial token reserves: {}", initial_token_reserve);

        Ok(())
    }

    /// Buy tokens from the bonding curve
    /// 
    /// # Arguments
    /// * `sol_amount` - Amount of SOL to spend (in lamports)
    /// * `min_tokens_out` - Minimum tokens to receive (slippage protection)
    pub fn buy_tokens(
        ctx: Context<BuyTokens>,
        sol_amount: u64,
        min_tokens_out: u64,
    ) -> Result<()> {
        require!(sol_amount > 0, ErrorCode::InvalidAmount);

        // Read values before mutable borrow
        let sol_reserves = ctx.accounts.token_config.sol_reserves;
        let token_reserves = ctx.accounts.token_config.token_reserves;
        let bump = ctx.accounts.token_config.bump;
        let mint_key = ctx.accounts.mint.key();
        let token_config_key = ctx.accounts.token_config.key();
        
        // Calculate tokens out using constant product formula: x * y = k
        let k = sol_reserves
            .checked_mul(token_reserves)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let new_sol_reserves = sol_reserves
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let new_token_reserves = k
            .checked_div(new_sol_reserves)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let tokens_out = token_reserves
            .checked_sub(new_token_reserves)
            .ok_or(ErrorCode::InsufficientLiquidity)?;

        require!(tokens_out > 0, ErrorCode::InvalidAmount);
        require!(tokens_out >= min_tokens_out, ErrorCode::SlippageExceeded);
        require!(tokens_out <= token_reserves, ErrorCode::InsufficientLiquidity);

        // Calculate platform fee (0.25% of SOL amount)
        let platform_fee = sol_amount
            .checked_mul(PLATFORM_FEE_BPS)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(ErrorCode::MathOverflow)?;

        let sol_to_curve = sol_amount
            .checked_sub(platform_fee)
            .ok_or(ErrorCode::MathOverflow)?;

        // Transfer SOL to token_config PDA (bonding curve reserves)
        let transfer_to_curve_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &token_config_key,
            sol_to_curve,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_to_curve_ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.token_config.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Transfer platform fee
        if platform_fee > 0 {
            let transfer_fee_ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.platform_fee_account.key(),
                platform_fee,
            );
            anchor_lang::solana_program::program::invoke(
                &transfer_fee_ix,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.platform_fee_account.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        // Transfer tokens from reserve to buyer
        let seeds = &[
            TOKEN_CONFIG_SEED,
            mint_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.reserve_token_account.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.token_config.to_account_info(),
                },
                signer,
            ),
            tokens_out,
        )?;

        // Update token config state (mutable borrow at the end)
        let token_config = &mut ctx.accounts.token_config;
        token_config.sol_reserves = new_sol_reserves;
        token_config.token_reserves = new_token_reserves;
        token_config.tokens_sold = token_config.tokens_sold
            .checked_add(tokens_out)
            .ok_or(ErrorCode::MathOverflow)?;
        token_config.total_volume = token_config.total_volume
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!("Bought {} tokens for {} lamports", tokens_out, sol_amount);

        Ok(())
    }

    /// Sell tokens back to the bonding curve
    /// 
    /// # Arguments
    /// * `token_amount` - Amount of tokens to sell
    /// * `min_sol_out` - Minimum SOL to receive (slippage protection)
    pub fn sell_tokens(
        ctx: Context<SellTokens>,
        token_amount: u64,
        min_sol_out: u64,
    ) -> Result<()> {
        require!(token_amount > 0, ErrorCode::InvalidAmount);

        // Read values before mutable borrow
        let sol_reserves = ctx.accounts.token_config.sol_reserves;
        let token_reserves = ctx.accounts.token_config.token_reserves;
        
        // Calculate SOL out using constant product formula: x * y = k
        let k = sol_reserves
            .checked_mul(token_reserves)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let new_token_reserves = token_reserves
            .checked_add(token_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let new_sol_reserves = k
            .checked_div(new_token_reserves)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let sol_out = sol_reserves
            .checked_sub(new_sol_reserves)
            .ok_or(ErrorCode::InsufficientLiquidity)?;

        require!(sol_out > 0, ErrorCode::InvalidAmount);
        require!(sol_out <= sol_reserves, ErrorCode::InsufficientLiquidity);

        // Calculate platform fee (0.25% of SOL out)
        let platform_fee = sol_out
            .checked_mul(PLATFORM_FEE_BPS)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(ErrorCode::MathOverflow)?;

        let sol_to_seller = sol_out
            .checked_sub(platform_fee)
            .ok_or(ErrorCode::MathOverflow)?;

        require!(sol_to_seller >= min_sol_out, ErrorCode::SlippageExceeded);

        // Transfer tokens from seller to reserve
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.reserve_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            token_amount,
        )?;

        // Transfer SOL from token_config PDA to seller
        let token_config_info = ctx.accounts.token_config.to_account_info();
        **token_config_info.try_borrow_mut_lamports()? -= sol_to_seller;
        **ctx.accounts.seller.try_borrow_mut_lamports()? += sol_to_seller;

        // Transfer platform fee
        if platform_fee > 0 {
            **token_config_info.try_borrow_mut_lamports()? -= platform_fee;
            **ctx.accounts.platform_fee_account.try_borrow_mut_lamports()? += platform_fee;
        }

        // Update token config state (mutable borrow at the end)
        let token_config = &mut ctx.accounts.token_config;
        token_config.sol_reserves = new_sol_reserves;
        token_config.token_reserves = new_token_reserves;
        token_config.tokens_sold = token_config.tokens_sold
            .checked_sub(token_amount)
            .unwrap_or(0);
        token_config.total_volume = token_config.total_volume
            .checked_add(sol_out)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!("Sold {} tokens for {} lamports", token_amount, sol_to_seller);

        Ok(())
    }

    /// Add liquidity to the bonding curve (for LPs)
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        sol_amount: u64,
        token_amount: u64,
    ) -> Result<()> {
        require!(sol_amount > 0 && token_amount > 0, ErrorCode::InvalidAmount);

        // Get key before mutable borrow
        let token_config_key = ctx.accounts.token_config.key();

        // Transfer SOL to curve
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.lp_provider.key(),
            &token_config_key,
            sol_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.lp_provider.to_account_info(),
                ctx.accounts.token_config.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Transfer tokens to reserve
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.provider_token_account.to_account_info(),
                    to: ctx.accounts.reserve_token_account.to_account_info(),
                    authority: ctx.accounts.lp_provider.to_account_info(),
                },
            ),
            token_amount,
        )?;

        // Update reserves (mutable borrow at the end)
        let token_config = &mut ctx.accounts.token_config;
        let lp_account = &mut ctx.accounts.lp_account;

        token_config.sol_reserves = token_config.sol_reserves
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        token_config.token_reserves = token_config.token_reserves
            .checked_add(token_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        // Update LP account
        lp_account.liquidity = lp_account.liquidity
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        lp_account.timestamp = Clock::get()?.unix_timestamp;

        msg!("Added liquidity: {} SOL + {} tokens", sol_amount, token_amount);

        Ok(())
    }

    /// Remove liquidity from the bonding curve
    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_share: u64,
    ) -> Result<()> {
        require!(lp_share > 0, ErrorCode::InvalidAmount);

        // Read values before mutable borrow
        let liquidity = ctx.accounts.lp_account.liquidity;
        let sol_reserves = ctx.accounts.token_config.sol_reserves;
        let token_reserves = ctx.accounts.token_config.token_reserves;
        let bump = ctx.accounts.token_config.bump;
        let mint_key = ctx.accounts.mint.key();

        require!(lp_share <= liquidity, ErrorCode::InsufficientLiquidity);

        // Calculate proportional share of reserves
        let sol_share = sol_reserves
            .checked_mul(lp_share)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(liquidity)
            .ok_or(ErrorCode::MathOverflow)?;
        let token_share = token_reserves
            .checked_mul(lp_share)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(liquidity)
            .ok_or(ErrorCode::MathOverflow)?;

        // Transfer SOL to provider
        let token_config_info = ctx.accounts.token_config.to_account_info();
        **token_config_info.try_borrow_mut_lamports()? -= sol_share;
        **ctx.accounts.lp_provider.try_borrow_mut_lamports()? += sol_share;

        // Transfer tokens to provider
        let seeds = &[
            TOKEN_CONFIG_SEED,
            mint_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.reserve_token_account.to_account_info(),
                    to: ctx.accounts.provider_token_account.to_account_info(),
                    authority: ctx.accounts.token_config.to_account_info(),
                },
                signer,
            ),
            token_share,
        )?;

        // Update reserves (mutable borrow at the end)
        let token_config = &mut ctx.accounts.token_config;
        let lp_account = &mut ctx.accounts.lp_account;

        token_config.sol_reserves = token_config.sol_reserves
            .checked_sub(sol_share)
            .ok_or(ErrorCode::MathOverflow)?;
        token_config.token_reserves = token_config.token_reserves
            .checked_sub(token_share)
            .ok_or(ErrorCode::MathOverflow)?;

        // Update LP account
        lp_account.liquidity = lp_account.liquidity
            .checked_sub(lp_share)
            .ok_or(ErrorCode::MathOverflow)?;
        lp_account.timestamp = Clock::get()?.unix_timestamp;

        msg!("Removed liquidity: {} SOL + {} tokens", sol_share, token_share);

        Ok(())
    }
}

// ============================================================================
// ACCOUNT CONTEXTS
// ============================================================================

#[derive(Accounts)]
#[instruction(name: String, symbol: String, metadata_uri: String, total_supply: u64)]
pub struct CreateAudioToken<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + TokenConfig::INIT_SPACE,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = creator,
        space = 8 + LpAccount::INIT_SPACE,
        seeds = [LP_ACCOUNT_SEED, mint.key().as_ref()],
        bump
    )]
    pub lp_account: Account<'info, LpAccount>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = creator,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = token_config,
    )]
    pub reserve_token_account: Account<'info, TokenAccount>,

    /// CHECK: Metadata account created via CPI to Metaplex
    #[account(mut)]
    pub metadata_account: UncheckedAccount<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: Metaplex Token Metadata Program
    pub token_metadata_program: Program<'info, Metaplex>,

    /// CHECK: Platform fee recipient
    #[account(mut)]
    pub platform_fee_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = token_config,
    )]
    pub reserve_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Platform fee recipient
    #[account(mut)]
    pub platform_fee_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        seeds = [LP_ACCOUNT_SEED, mint.key().as_ref()],
        bump = lp_account.bump
    )]
    pub lp_account: Account<'info, LpAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = token_config,
    )]
    pub reserve_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,

    /// CHECK: Platform fee recipient
    #[account(mut)]
    pub platform_fee_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [LP_ACCOUNT_SEED, mint.key().as_ref()],
        bump = lp_account.bump
    )]
    pub lp_account: Account<'info, LpAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = token_config,
    )]
    pub reserve_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = lp_provider,
    )]
    pub provider_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lp_provider: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(
        mut,
        seeds = [TOKEN_CONFIG_SEED, mint.key().as_ref()],
        bump = token_config.bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [LP_ACCOUNT_SEED, mint.key().as_ref()],
        bump = lp_account.bump
    )]
    pub lp_account: Account<'info, LpAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = token_config,
    )]
    pub reserve_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = lp_provider,
        associated_token::mint = mint,
        associated_token::authority = lp_provider,
    )]
    pub provider_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lp_provider: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ============================================================================
// ACCOUNT STRUCTURES
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct TokenConfig {
    pub mint: Pubkey,              // 32 bytes
    pub creator: Pubkey,           // 32 bytes
    #[max_len(32)]
    pub name: String,              // 4 + 32 = 36 bytes
    #[max_len(10)]
    pub symbol: String,            // 4 + 10 = 14 bytes
    #[max_len(200)]
    pub metadata_uri: String,      // 4 + 200 = 204 bytes
    pub total_supply: u64,         // 8 bytes
    pub initial_supply: u64,       // 8 bytes
    pub sol_reserves: u64,         // 8 bytes
    pub token_reserves: u64,       // 8 bytes
    pub tokens_sold: u64,          // 8 bytes
    pub total_volume: u64,         // 8 bytes
    pub created_at: i64,           // 8 bytes
    pub bump: u8,                  // 1 byte
}

#[account]
#[derive(InitSpace)]
pub struct LpAccount {
    pub mint: Pubkey,              // 32 bytes
    pub liquidity: u64,            // 8 bytes
    pub timestamp: i64,            // 8 bytes
    pub bump: u8,                  // 1 byte
}

// ============================================================================
// ERROR CODES
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid input")]
    InvalidInput,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Invalid price ratio")]
    InvalidPriceRatio,
}
