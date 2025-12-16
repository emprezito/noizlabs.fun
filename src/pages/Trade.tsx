import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { 
  getAssociatedTokenAddress, 
  getAccount, 
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Loader2, Play, Pause, ArrowLeft, AlertCircle, Wifi, WifiOff, ExternalLink } from "lucide-react";
import { useSolPrice } from "@/hooks/useSolPrice";
import { updateTradingVolume } from "@/lib/taskUtils";
import { supabase } from "@/integrations/supabase/client";
import { TradeConfirmDialog } from "@/components/TradeConfirmDialog";
import { TradingViewChart } from "@/components/TradingViewChart";
import { fetchTradeHistoryCandles, fetchDexScreenerData, fetchTradeHistory, CandleData, TradeHistoryItem } from "@/lib/chartData";

// Bonding curve constants for price impact calculation (pump.fun style - 1% fee)
const PLATFORM_FEE_BPS = 100;
const BASIS_POINTS_DIVISOR = 10000;

// Bonding curve wallet - holds tokens for buy/sell trades
const BONDING_CURVE_WALLET = new PublicKey("FL2wxMs6q8sR2pfypRSWUpYN7qcpA52rnLYH9WLQufUc");

// Platform fee wallet - receives SOL fees from trades
const PLATFORM_FEE_WALLET = new PublicKey("5NC3whTedkRHALefgSPjRmV2WEfFMczBNQ2sYT4EdoD7");

interface TokenInfo {
  name: string;
  symbol: string;
  audioUri: string;
  imageUri?: string;
  totalSupply: number;
  price: number;
  solReserves: number;
  tokenReserves: number;
  mint: string;
  creatorWallet: string;
  priceChange24h?: number;
  volume24h?: number;
  liquidity?: number;
}


const TradePage = () => {
  const [searchParams] = useSearchParams();
  const initialMint = searchParams.get("mint") || "";
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { price: solUsdPrice, formatUsd } = useSolPrice();

  const [mintInput, setMintInput] = useState(initialMint.trim());
  const [activeMint, setActiveMint] = useState("");

  // Validate if a string is a valid Solana public key
  const isValidMintAddress = (address: string): boolean => {
    if (!address || address.length < 32 || address.length > 44) return false;
    try {
      new PublicKey(address.trim());
      return true;
    } catch {
      return false;
    }
  };

  // Auto-load token when arriving with mint in URL
  useEffect(() => {
    const trimmedMint = initialMint.trim();
    if (trimmedMint && !activeMint && isValidMintAddress(trimmedMint)) {
      setActiveMint(trimmedMint);
    }
  }, [initialMint]);
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [trading, setTrading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [userPnL, setUserPnL] = useState<{ costBasis: number; currentValue: number; pnl: number; pnlPercent: number } | null>(null);
  
  // Confirmation dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<{
    type: "buy" | "sell";
    inputAmount: number;
    outputAmount: number;
    priceImpact: number;
    platformFee: number;
  } | null>(null);

  // Calculate trade preview
  const calculateTradePreview = useCallback((type: "buy" | "sell", amount: number) => {
    if (!tokenInfo || amount <= 0) return null;
    
    const solReserves = tokenInfo.solReserves * 1e9; // Convert to lamports
    const tokenReserves = tokenInfo.tokenReserves * 1e9; // Convert to smallest units
    
    if (type === "buy") {
      const solAmount = amount * 1e9; // lamports
      const platformFee = Math.floor(solAmount * PLATFORM_FEE_BPS / BASIS_POINTS_DIVISOR);
      const solAfterFee = solAmount - platformFee;
      const k = solReserves * tokenReserves;
      const newSolReserves = solReserves + solAfterFee;
      const newTokenReserves = Math.floor(k / newSolReserves);
      const tokensOut = (tokenReserves - newTokenReserves) / 1e9;
      
      const spotPrice = solReserves / tokenReserves;
      const executionPrice = tokensOut > 0 ? solAfterFee / (tokensOut * 1e9) : 0;
      const priceImpact = spotPrice > 0 ? Math.abs((executionPrice - spotPrice) / spotPrice) * 100 : 0;
      
      return {
        outputAmount: tokensOut,
        priceImpact,
        platformFee: platformFee / 1e9,
      };
    } else {
      const tokenAmount = amount * 1e9; // smallest units
      const k = solReserves * tokenReserves;
      const newTokenReserves = tokenReserves + tokenAmount;
      const newSolReserves = Math.floor(k / newTokenReserves);
      const solOutBeforeFee = solReserves - newSolReserves;
      const platformFee = Math.floor(solOutBeforeFee * PLATFORM_FEE_BPS / BASIS_POINTS_DIVISOR);
      const solOut = (solOutBeforeFee - platformFee) / 1e9;
      
      const spotPrice = solReserves / tokenReserves;
      const executionPrice = tokenAmount > 0 ? solOutBeforeFee / tokenAmount : 0;
      const priceImpact = spotPrice > 0 ? Math.abs((executionPrice - spotPrice) / spotPrice) * 100 : 0;
      
      return {
        outputAmount: solOut,
        priceImpact,
        platformFee: platformFee / 1e9,
      };
    }
  }, [tokenInfo]);

  // Fetch user's token balance
  const fetchUserBalance = useCallback(async () => {
    if (!publicKey || !activeMint) {
      setUserBalance(0);
      return;
    }

    try {
      setBalanceLoading(true);
      const mintPubkey = new PublicKey(activeMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      
      try {
        const accountInfo = await getAccount(connection, ata);
        // Convert from smallest unit (9 decimals) to display format
        const balance = Number(accountInfo.amount) / 1e9;
        setUserBalance(balance);
      } catch {
        // Account doesn't exist = 0 balance
        setUserBalance(0);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setUserBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  }, [publicKey, activeMint, connection]);

  // Fetch balance when mint or wallet changes
  useEffect(() => {
    fetchUserBalance();
  }, [fetchUserBalance]);

  // Set up real-time subscription for token data and trade history from Supabase
  useEffect(() => {
    if (!activeMint || !tokenInfo) return;

    const channel = supabase
      .channel(`token-${activeMint}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tokens',
          filter: `mint_address=eq.${activeMint}`,
        },
        (payload) => {
          const data = payload.new as any;
          const solReserves = Number(data.sol_reserves) / 1e9;
          const tokenReserves = Number(data.token_reserves) / 1e9;
          const newPrice = tokenReserves > 0 ? solReserves / tokenReserves : 0;
          
          setTokenInfo(prev => prev ? {
            ...prev,
            price: newPrice,
            solReserves,
            tokenReserves,
          } : null);

          // Update candle data with new price point
          fetchTradeHistoryCandles(activeMint).then(setCandleData);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_history',
          filter: `mint_address=eq.${activeMint}`,
        },
        () => {
          // Refresh trade history when new trades come in
          fetchTradeHistory(activeMint).then(setTradeHistory);
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, [activeMint, tokenInfo?.mint]);

  useEffect(() => {
    if (activeMint) {
      loadTokenInfo();
      // Load candle data and trade history
      fetchTradeHistoryCandles(activeMint).then(setCandleData);
      fetchTradeHistory(activeMint).then(setTradeHistory);
    }
  }, [activeMint]);

  // Auto-refresh chart data and trade history every second
  useEffect(() => {
    if (!activeMint) return;

    const refreshInterval = setInterval(() => {
      fetchTradeHistoryCandles(activeMint).then(setCandleData);
      fetchTradeHistory(activeMint).then(setTradeHistory);
    }, 1000);

    return () => clearInterval(refreshInterval);
  }, [activeMint]);

  // Calculate user's P&L based on trade history
  const calculateUserPnL = useCallback(async () => {
    if (!publicKey || !activeMint || !tokenInfo || userBalance <= 0) {
      setUserPnL(null);
      return;
    }

    try {
      const walletAddress = publicKey.toString();
      
      // Fetch user's trade history for this token
      const { data: trades, error } = await supabase
        .from('trade_history')
        .select('*')
        .eq('mint_address', activeMint)
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: true });

      if (error || !trades || trades.length === 0) {
        setUserPnL(null);
        return;
      }

      // Calculate average cost basis
      let totalTokensBought = 0;
      let totalSolSpent = 0;
      let totalTokensSold = 0;
      let totalSolReceived = 0;

      for (const trade of trades) {
        const tokenAmount = Number(trade.amount) / 1e9;
        const solAmount = (Number(trade.price_lamports) * Number(trade.amount)) / 1e18;
        
        if (trade.trade_type === 'buy') {
          totalTokensBought += tokenAmount;
          totalSolSpent += solAmount;
        } else {
          totalTokensSold += tokenAmount;
          totalSolReceived += solAmount;
        }
      }

      const netTokens = totalTokensBought - totalTokensSold;
      const netSolSpent = totalSolSpent - totalSolReceived;
      
      if (netTokens <= 0 || userBalance <= 0) {
        setUserPnL(null);
        return;
      }

      const costBasis = netSolSpent;
      const currentValue = userBalance * tokenInfo.price;
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      setUserPnL({ costBasis, currentValue, pnl, pnlPercent });
    } catch (error) {
      console.error('Error calculating P&L:', error);
      setUserPnL(null);
    }
  }, [publicKey, activeMint, tokenInfo, userBalance]);

  // Recalculate P&L when relevant data changes
  useEffect(() => {
    calculateUserPnL();
  }, [calculateUserPnL]);

  const loadTokenInfo = async () => {
    if (!activeMint) return;
    
    // Validate mint address
    try {
      new PublicKey(activeMint);
    } catch {
      toast.error("Invalid mint address format");
      return;
    }

    setLoading(true);
    try {
      // Fetch token from Supabase database
      const { data: token, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("mint_address", activeMint)
        .maybeSingle();

      if (error) throw error;

      if (token) {
        const solReserves = Number(token.sol_reserves) / 1e9;
        const tokenReserves = Number(token.token_reserves) / 1e9;
        // Price per token = SOL reserves / token reserves (in display units)
        // This gives price in SOL per 1 token
        const price = tokenReserves > 0 ? solReserves / tokenReserves : 0;
        
        // Fetch associated audio clip for cover image and audio
        let imageUri = undefined;
        let audioUrl = token.audio_url || "";
        if (token.audio_clip_id) {
          const { data: clip } = await supabase
            .from("audio_clips")
            .select("cover_image_url, audio_url")
            .eq("id", token.audio_clip_id)
            .maybeSingle();
          imageUri = clip?.cover_image_url || undefined;
          audioUrl = clip?.audio_url || audioUrl;
        }

        // Try to get DexScreener data for additional info
        let priceChange24h = undefined;
        let volume24h = undefined;
        let liquidity = undefined;
        try {
          const dexData = await fetchDexScreenerData(activeMint);
          if (dexData) {
            priceChange24h = dexData.priceChange?.h24;
            volume24h = dexData.volume?.h24;
            liquidity = dexData.liquidity?.usd;
          }
        } catch (e) {
          console.log("DexScreener data not available");
        }
        
        setTokenInfo({
          name: token.name,
          symbol: token.symbol,
          audioUri: audioUrl,
          imageUri,
          totalSupply: Number(token.total_supply),
          price,
          solReserves,
          tokenReserves,
          mint: activeMint,
          creatorWallet: token.creator_wallet,
          priceChange24h,
          volume24h,
          liquidity,
        });
      } else {
        toast.error("Token not found in database");
        setTokenInfo(null);
      }
      // Balance will be fetched by the fetchUserBalance effect
    } catch (error) {
      console.error("Error loading token:", error);
      toast.error("Failed to load token data");
      setTokenInfo(null);
    }
    setLoading(false);
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  // Audio playback toggle
  const toggleAudio = () => {
    if (!tokenInfo?.audioUri) {
      toast.error("No audio available for this token");
      return;
    }

    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      // Stop any other playing audio
      document.querySelectorAll('audio').forEach(audio => audio.pause());
      
      if (!audioRef.current) {
        audioRef.current = new Audio(tokenInfo.audioUri);
        audioRef.current.onended = () => setPlaying(false);
        audioRef.current.onerror = () => {
          toast.error("Failed to load audio");
          setPlaying(false);
        };
      }
      audioRef.current.play().catch(() => {
        toast.error("Failed to play audio");
        setPlaying(false);
      });
      setPlaying(true);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handleSearch = () => {
    const trimmed = mintInput.trim();
    if (!trimmed) { toast.error("Please enter a mint address"); return; }
    if (!isValidMintAddress(trimmed)) { 
      toast.error("Invalid mint address format. Must be a valid Solana address (32-44 characters)"); 
      return; 
    }
    setActiveMint(trimmed);
  };

  // Initiate buy - show confirmation first
  const initiateBuy = () => {
    if (!connected || !publicKey) { 
      toast.error("Connect wallet first"); 
      return; 
    }
    if (!buyAmount || !tokenInfo) { 
      toast.error("Enter valid amount"); 
      return; 
    }
    
    const amount = parseFloat(buyAmount);
    if (amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const preview = calculateTradePreview("buy", amount);
    if (!preview) {
      toast.error("Unable to calculate trade");
      return;
    }

    setPendingTrade({
      type: "buy",
      inputAmount: amount,
      outputAmount: preview.outputAmount,
      priceImpact: preview.priceImpact,
      platformFee: preview.platformFee,
    });
    setConfirmDialogOpen(true);
  };

  // Initiate sell - show confirmation first
  const initiateSell = () => {
    if (!connected || !publicKey) { 
      toast.error("Connect wallet first"); 
      return; 
    }
    if (!sellAmount || !tokenInfo) { 
      toast.error("Enter valid amount"); 
      return; 
    }
    
    const amount = parseFloat(sellAmount);
    if (amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amount > userBalance) {
      toast.error("Insufficient token balance");
      return;
    }

    const preview = calculateTradePreview("sell", amount);
    if (!preview) {
      toast.error("Unable to calculate trade");
      return;
    }

    setPendingTrade({
      type: "sell",
      inputAmount: amount,
      outputAmount: preview.outputAmount,
      priceImpact: preview.priceImpact,
      platformFee: preview.platformFee,
    });
    setConfirmDialogOpen(true);
  };

  // Execute confirmed trade
  const executeConfirmedTrade = async () => {
    if (!pendingTrade || !publicKey || !sendTransaction || !tokenInfo) return;

    setTrading(true);
    try {
      const walletAddress = publicKey.toString();

      if (pendingTrade.type === "buy") {
        // BUY: User sends SOL to platform wallet, platform sends tokens to user
        const amountLamports = Math.floor(pendingTrade.inputAmount * LAMPORTS_PER_SOL);

        const transaction = new Transaction();
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: BONDING_CURVE_WALLET,
            lamports: amountLamports,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

        // Edge function will transfer tokens from platform wallet to user
        const { data, error } = await supabase.functions.invoke("execute-trade", {
          body: {
            mintAddress: activeMint,
            tradeType: "buy",
            amount: amountLamports,
            walletAddress: walletAddress,
            signature: signature,
          },
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || "Trade failed");

        const usdVolume = pendingTrade.inputAmount * (solUsdPrice || 0);
        await updateTradingVolume(walletAddress, usdVolume);
        
        const tokensReceived = (data.tokensOut || 0) / 1e9;
        toast.success(`Bought ${tokensReceived.toLocaleString()} ${tokenInfo.symbol}!`);
        setBuyAmount("");

      } else {
        // SELL: User sends tokens to platform wallet, platform sends SOL to user
        const tokenAmountUnits = Math.floor(pendingTrade.inputAmount * 1e9);
        const mintPubkey = new PublicKey(activeMint);
        
        // Platform wallet ATA to receive tokens
        const userATA = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const platformATA = await getAssociatedTokenAddress(mintPubkey, BONDING_CURVE_WALLET);

        const transaction = new Transaction();

        // Create platform ATA if it doesn't exist
        try {
          await getAccount(connection, platformATA);
        } catch {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              platformATA,
              BONDING_CURVE_WALLET,
              mintPubkey
            )
          );
        }

        // Transfer tokens to platform wallet
        transaction.add(
          createTransferInstruction(
            userATA,
            platformATA,
            publicKey,
            BigInt(tokenAmountUnits),
            [],
            TOKEN_PROGRAM_ID
          )
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

        // Edge function will transfer SOL from platform wallet to user
        const { data, error } = await supabase.functions.invoke("execute-trade", {
          body: {
            mintAddress: activeMint,
            tradeType: "sell",
            amount: tokenAmountUnits,
            walletAddress: walletAddress,
            signature: signature,
          },
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || "Trade failed");

        const solReceived = (data.solOut || 0) / 1e9;
        const usdVolume = solReceived * (solUsdPrice || 0);
        await updateTradingVolume(walletAddress, usdVolume);
        
        toast.success(`Sold for ${solReceived.toFixed(4)} SOL (${formatUsd(solReceived)})!`);
        setSellAmount("");
      }

      loadTokenInfo();
      fetchUserBalance();
      setConfirmDialogOpen(false);
      setPendingTrade(null);

    } catch (error: any) {
      console.error("Trade error:", error);
      toast.error(error.message || "Transaction failed");
    }
    setTrading(false);
  };

  const estimatedBuyTokens = buyAmount && tokenInfo ? (parseFloat(buyAmount) / tokenInfo.price).toFixed(0) : "0";
  const estimatedSellSol = sellAmount && tokenInfo ? (parseFloat(sellAmount) * tokenInfo.price).toFixed(6) : "0";

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Navbar />
      <main className="pt-24 pb-20 min-h-screen">
        <div className="container mx-auto px-4 max-w-6xl">
          <Link to="/tokens" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Tokens
          </Link>

          {!connected && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p>Connect your wallet to trade tokens.</p>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <Label>Token Mint Address</Label>
            <div className="flex gap-3 mt-2">
              <Input placeholder="Enter mint address..." value={mintInput} onChange={(e) => setMintInput(e.target.value)} className="flex-1" />
              <Button onClick={handleSearch}>Load Token</Button>
            </div>
          </div>

          {loading && <div className="bg-card rounded-xl p-12 text-center border border-border"><Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" /></div>}

          {!loading && tokenInfo && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-start gap-6">
                    {/* Token Image with Play Button */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                      {tokenInfo.imageUri ? (
                        <img
                          src={tokenInfo.imageUri}
                          alt={tokenInfo.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                          <span className="text-3xl">🎵</span>
                        </div>
                      )}
                      <button
                        onClick={toggleAudio}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      >
                        {playing ? <Pause className="w-8 h-8 text-white" /> : <Play className="w-8 h-8 text-white ml-1" />}
                      </button>
                      {playing && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Pause className="w-8 h-8 text-white animate-pulse" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl font-bold">{tokenInfo.name}</h2>
                        <span className="px-2 py-1 bg-primary/20 text-primary rounded-lg text-sm">${tokenInfo.symbol}</span>
                        {tokenInfo.priceChange24h !== undefined && (
                          <span className={`px-2 py-1 rounded-lg text-sm font-semibold ${
                            tokenInfo.priceChange24h >= 0 
                              ? "bg-green-500/20 text-green-500" 
                              : "bg-red-500/20 text-red-500"
                          }`}>
                            {tokenInfo.priceChange24h >= 0 ? "+" : ""}{tokenInfo.priceChange24h.toFixed(2)}%
                          </span>
                        )}
                        {/* Live Indicator */}
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          isLive ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
                        }`}>
                          {isLive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {isLive ? "Live" : "Static"}
                        </div>
                        {/* Solana Explorer Link */}
                        <a
                          href={`https://explorer.solana.com/address/${tokenInfo.mint}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Explorer
                        </a>
                      </div>
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Price</p>
                          <p className="font-bold text-primary">{tokenInfo.price.toFixed(8)} SOL</p>
                          <p className="text-xs text-muted-foreground">{formatUsd(tokenInfo.price)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Liquidity</p>
                          <p className="font-bold text-green-500">{tokenInfo.solReserves.toFixed(4)} SOL</p>
                          <p className="text-xs text-muted-foreground">{formatUsd(tokenInfo.solReserves)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Market Cap</p>
                          <p className="font-bold">{formatUsd(tokenInfo.solReserves * 2)}</p>
                          {tokenInfo.volume24h && (
                            <p className="text-xs text-muted-foreground">Vol: ${tokenInfo.volume24h.toLocaleString()}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-muted-foreground">Your Balance</p>
                          <p className="font-bold">
                            {balanceLoading ? "..." : userBalance.toLocaleString()} {tokenInfo.symbol}
                          </p>
                          {userPnL && (
                            <p className={`text-xs font-medium ${userPnL.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {userPnL.pnl >= 0 ? "+" : ""}{userPnL.pnl.toFixed(4)} SOL ({userPnL.pnlPercent >= 0 ? "+" : ""}{userPnL.pnlPercent.toFixed(1)}%)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-2xl shadow-noiz-lg p-6">
                  <h3 className="font-bold mb-4">Price Chart</h3>
                  <div className="h-80">
                    <TradingViewChart data={candleData} height={300} />
                  </div>
                </div>

                {/* Trade History Section */}
                <div className="bg-card rounded-2xl shadow-noiz-lg p-6">
                  <h3 className="font-bold mb-4">Recent Trades</h3>
                  {tradeHistory.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No trades yet</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {tradeHistory.map((trade) => (
                        <div key={trade.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`px-2 py-1 rounded text-xs font-bold ${
                              trade.trade_type === "buy" 
                                ? "bg-green-500/20 text-green-500" 
                                : "bg-red-500/20 text-red-500"
                            }`}>
                              {trade.trade_type.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {(trade.amount / 1e9).toLocaleString()} {tokenInfo?.symbol || "tokens"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                @ {(trade.price_lamports / 1e9).toFixed(8)} SOL
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {formatTimeAgo(new Date(trade.created_at).getTime())}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {trade.wallet_address.slice(0, 4)}...{trade.wallet_address.slice(-4)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-card rounded-2xl shadow-noiz-lg p-6 sticky top-24 h-fit">
                <Tabs defaultValue="buy">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="buy"><TrendingUp className="w-4 h-4 mr-2" />Buy</TabsTrigger>
                    <TabsTrigger value="sell"><TrendingDown className="w-4 h-4 mr-2" />Sell</TabsTrigger>
                  </TabsList>
                  <TabsContent value="buy" className="space-y-4">
                    <div><Label>Amount (SOL)</Label><Input type="number" placeholder="0.0" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} className="mt-2" /></div>
                    <div className="flex gap-2">{["0.1", "0.5", "1", "5"].map((amt) => <Button key={amt} variant="outline" size="sm" onClick={() => setBuyAmount(amt)}>{amt}</Button>)}</div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">You'll receive</p>
                      <p className="font-bold">{parseInt(estimatedBuyTokens).toLocaleString()} {tokenInfo.symbol}</p>
                      {buyAmount && <p className="text-xs text-muted-foreground">Cost: {buyAmount} SOL ({formatUsd(parseFloat(buyAmount) || 0)})</p>}
                    </div>
                    <Button onClick={initiateBuy} disabled={trading || !connected} className="w-full bg-noiz-green hover:bg-noiz-green/80">{trading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{trading ? "Processing..." : "Buy Tokens"}</Button>
                  </TabsContent>
                  <TabsContent value="sell" className="space-y-4">
                    <div><Label>Amount (Tokens)</Label><Input type="number" placeholder="0" value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} className="mt-2" /></div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">You'll receive</p>
                      <p className="font-bold">{estimatedSellSol} SOL</p>
                      {sellAmount && <p className="text-xs text-muted-foreground">Value: {formatUsd(parseFloat(estimatedSellSol) || 0)}</p>}
                    </div>
                    <Button onClick={initiateSell} disabled={trading || !connected} className="w-full bg-noiz-pink hover:bg-noiz-pink/80">{trading ? "Processing..." : "Sell Tokens"}</Button>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Trade Confirmation Dialog */}
      {tokenInfo && pendingTrade && (
        <TradeConfirmDialog
          open={confirmDialogOpen}
          onOpenChange={(open) => {
            setConfirmDialogOpen(open);
            if (!open) setPendingTrade(null);
          }}
          onConfirm={executeConfirmedTrade}
          loading={trading}
          tradeType={pendingTrade.type}
          inputAmount={pendingTrade.inputAmount.toString()}
          inputSymbol={pendingTrade.type === "buy" ? "SOL" : tokenInfo.symbol}
          outputAmount={pendingTrade.outputAmount.toLocaleString()}
          outputSymbol={pendingTrade.type === "buy" ? tokenInfo.symbol : "SOL"}
          priceImpact={pendingTrade.priceImpact}
          platformFee={pendingTrade.platformFee}
          currentPrice={tokenInfo.price}
        />
      )}
      <MobileTabBar />
    </div>
  );
};

export default TradePage;
