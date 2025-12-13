import { useState, useEffect, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Loader2, Play, Pause, ArrowLeft, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useSolPrice } from "@/hooks/useSolPrice";
import { updateTradingVolume } from "@/lib/taskUtils";
import { supabase } from "@/integrations/supabase/client";
import { TradeConfirmDialog } from "@/components/TradeConfirmDialog";

// Bonding curve constants for price impact calculation
const PLATFORM_FEE_BPS = 25;
const BASIS_POINTS_DIVISOR = 10000;

// Platform fee wallet - receives SOL from buys
const PLATFORM_FEE_WALLET = new PublicKey("GVHjPM3DfTnSFLMx72RcCCAViqWWsJ6ENKXRq7nWedEp");

interface TokenInfo {
  name: string;
  symbol: string;
  audioUri: string;
  totalSupply: number;
  price: number;
  solReserves: number;
  tokenReserves: number;
  mint: string;
  creatorWallet: string;
}

interface TradeTransaction {
  id: string;
  type: "buy" | "sell";
  amount: number;
  price: number;
  timestamp: number;
  wallet: string;
}

const generateChartData = () => {
  const data = [];
  let price = 0.00001;
  for (let i = 0; i < 24; i++) {
    price = price + (Math.random() - 0.4) * 0.000005;
    price = Math.max(0.000005, price);
    data.push({ time: `${i}:00`, price, volume: Math.random() * 5 });
  }
  return data;
};

const DEMO_TRANSACTIONS: TradeTransaction[] = [
  { id: "1", type: "buy", amount: 1500000, price: 0.00001765, timestamp: Date.now() - 300000, wallet: "7Np...abc" },
  { id: "2", type: "sell", amount: 500000, price: 0.00001720, timestamp: Date.now() - 900000, wallet: "8Kp...def" },
  { id: "3", type: "buy", amount: 2500000, price: 0.00001680, timestamp: Date.now() - 1800000, wallet: "2Lp...ghi" },
];

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
  const [chartData, setChartData] = useState(generateChartData());
  const [transactions] = useState<TradeTransaction[]>(DEMO_TRANSACTIONS);
  const [isLive, setIsLive] = useState(false);
  
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

  // Set up real-time subscription for token data from Supabase
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

          setChartData(prev => {
            const newData = [...prev.slice(1), {
              time: new Date().toLocaleTimeString().slice(0, 5),
              price: newPrice,
              volume: Math.random() * 5,
            }];
            return newData;
          });
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
    if (activeMint) loadTokenInfo();
  }, [activeMint]);

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
        const price = tokenReserves > 0 ? solReserves / tokenReserves : 0;
        
        setTokenInfo({
          name: token.name,
          symbol: token.symbol,
          audioUri: token.audio_url || "",
          totalSupply: Number(token.total_supply),
          price,
          solReserves,
          tokenReserves,
          mint: activeMint,
          creatorWallet: token.creator_wallet,
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
        const amountLamports = Math.floor(pendingTrade.inputAmount * LAMPORTS_PER_SOL);

        const transaction = new Transaction();
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: PLATFORM_FEE_WALLET,
            lamports: amountLamports,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

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
        
        toast.success(`Bought ${data.tokensOut?.toLocaleString() || ""} tokens! TX: ${signature.slice(0, 8)}...`);
        setBuyAmount("");

      } else {
        const tokenAmountUnits = Math.floor(pendingTrade.inputAmount * 1e9);
        const mintPubkey = new PublicKey(activeMint);
        const creatorPubkey = new PublicKey(tokenInfo.creatorWallet);

        const userATA = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const creatorATA = await getAssociatedTokenAddress(mintPubkey, creatorPubkey);

        const transaction = new Transaction();

        try {
          await getAccount(connection, creatorATA);
        } catch {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              creatorATA,
              creatorPubkey,
              mintPubkey
            )
          );
        }

        transaction.add(
          createTransferInstruction(
            userATA,
            creatorATA,
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
        
        toast.success(`Sold for ${solReceived.toFixed(4)} SOL! TX: ${signature.slice(0, 8)}...`);
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
    <div className="min-h-screen bg-background">
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
                    <button onClick={() => setPlaying(!playing)} className="w-20 h-20 bg-primary rounded-xl flex items-center justify-center">
                      {playing ? <Pause className="w-8 h-8 text-primary-foreground" /> : <Play className="w-8 h-8 text-primary-foreground ml-1" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold">{tokenInfo.name}</h2>
                        <span className="px-2 py-1 bg-noiz-purple/20 text-noiz-purple rounded-lg text-sm">${tokenInfo.symbol}</span>
                        {/* Live Indicator */}
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          isLive ? "bg-noiz-green/20 text-noiz-green" : "bg-muted text-muted-foreground"
                        }`}>
                          {isLive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {isLive ? "Live" : "Static"}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Price</p>
                          <p className="font-bold text-noiz-purple">{tokenInfo.price.toFixed(8)} SOL</p>
                          <p className="text-xs text-muted-foreground">{formatUsd(tokenInfo.price)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Liquidity</p>
                          <p className="font-bold text-noiz-green">{tokenInfo.solReserves.toFixed(2)} SOL</p>
                          <p className="text-xs text-muted-foreground">{formatUsd(tokenInfo.solReserves)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Market Cap</p>
                          <p className="font-bold">{formatUsd(tokenInfo.solReserves * 2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Your Balance</p>
                          <p className="font-bold">
                            {balanceLoading ? "..." : userBalance.toLocaleString()} {tokenInfo.symbol}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-2xl shadow-noiz-lg p-6">
                  <h3 className="font-bold mb-4">Price Chart</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs><linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} /><stop offset="95%" stopColor="#A855F7" stopOpacity={0} /></linearGradient></defs>
                        <XAxis dataKey="time" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(6)} />
                        <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: "8px" }} />
                        <Area type="monotone" dataKey="price" stroke="#A855F7" strokeWidth={2} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
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
    </div>
  );
};

export default TradePage;
