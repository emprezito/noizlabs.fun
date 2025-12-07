import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, TrendingUp, TrendingDown, Loader2, Play, Pause, ArrowLeft, ExternalLink, AlertCircle } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { 
  fetchBondingCurve, 
  fetchAudioToken, 
  buyTokensInstruction, 
  sellTokensInstruction,
  calculateBuyPrice,
  calculateSellReturn 
} from "@/lib/solana/program";

interface TokenInfo {
  name: string;
  symbol: string;
  audioUri: string;
  totalSupply: number;
  price: number;
  solReserves: number;
  tokenReserves: number;
  mint: string;
}

interface Transaction {
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

const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "1", type: "buy", amount: 1500000, price: 0.00001765, timestamp: Date.now() - 300000, wallet: "7Np...abc" },
  { id: "2", type: "sell", amount: 500000, price: 0.00001720, timestamp: Date.now() - 900000, wallet: "8Kp...def" },
  { id: "3", type: "buy", amount: 2500000, price: 0.00001680, timestamp: Date.now() - 1800000, wallet: "2Lp...ghi" },
];

const TradePage = () => {
  const [searchParams] = useSearchParams();
  const initialMint = searchParams.get("mint") || "";
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [mintInput, setMintInput] = useState(initialMint);
  const [activeMint, setActiveMint] = useState(initialMint);
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [trading, setTrading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [userBalance, setUserBalance] = useState("0");
  const [playing, setPlaying] = useState(false);
  const [chartData] = useState(generateChartData());
  const [transactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);

  useEffect(() => {
    if (activeMint) loadTokenInfo();
  }, [activeMint]);

  const loadTokenInfo = async () => {
    setLoading(true);
    try {
      const mintPubkey = new PublicKey(activeMint);
      const [audioToken, bondingCurve] = await Promise.all([
        fetchAudioToken(connection, mintPubkey),
        fetchBondingCurve(connection, mintPubkey),
      ]);

      if (audioToken && bondingCurve) {
        const price = bondingCurve.tokenReserves > 0 
          ? bondingCurve.solReserves / bondingCurve.tokenReserves 
          : 0;
        setTokenInfo({
          name: audioToken.name,
          symbol: audioToken.symbol,
          audioUri: audioToken.audioUri,
          totalSupply: audioToken.totalSupply,
          price,
          solReserves: bondingCurve.solReserves,
          tokenReserves: bondingCurve.tokenReserves,
          mint: activeMint,
        });
      } else {
        // Demo fallback
        setTokenInfo({
          name: "Demo Token", symbol: "DEMO", audioUri: "", totalSupply: 1000000000,
          price: 0.00001765, solReserves: 15.5, tokenReserves: 850000000, mint: activeMint,
        });
      }
      setUserBalance("1500000");
    } catch (error) {
      console.error("Error loading token:", error);
      setTokenInfo({
        name: "Demo Token", symbol: "DEMO", audioUri: "", totalSupply: 1000000000,
        price: 0.00001765, solReserves: 15.5, tokenReserves: 850000000, mint: activeMint,
      });
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
    if (!mintInput) { toast.error("Please enter a mint address"); return; }
    setActiveMint(mintInput);
  };

  const handleBuy = async () => {
    if (!connected || !publicKey) { toast.error("Connect wallet first"); return; }
    if (!buyAmount || !tokenInfo) { toast.error("Enter valid amount"); return; }
    
    setTrading(true);
    try {
      const mintPubkey = new PublicKey(activeMint);
      const tokenAmount = BigInt(Math.floor(parseFloat(buyAmount) / tokenInfo.price * 1e9));
      const instruction = await buyTokensInstruction(connection, publicKey, mintPubkey, tokenAmount);
      const transaction = new Transaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");
      toast.success(`Bought tokens! TX: ${signature.slice(0, 8)}...`);
      setBuyAmount("");
      loadTokenInfo();
    } catch (error: any) {
      toast.error(error.message || "Transaction failed");
    }
    setTrading(false);
  };

  const handleSell = async () => {
    if (!connected || !publicKey) { toast.error("Connect wallet first"); return; }
    if (!sellAmount || !tokenInfo) { toast.error("Enter valid amount"); return; }
    
    setTrading(true);
    try {
      const mintPubkey = new PublicKey(activeMint);
      const tokenAmount = BigInt(Math.floor(parseFloat(sellAmount) * 1e9));
      const instruction = await sellTokensInstruction(connection, publicKey, mintPubkey, tokenAmount);
      const transaction = new Transaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");
      toast.success(`Sold tokens! TX: ${signature.slice(0, 8)}...`);
      setSellAmount("");
      loadTokenInfo();
    } catch (error: any) {
      toast.error(error.message || "Transaction failed");
    }
    setTrading(false);
  };

  const estimatedBuyTokens = buyAmount && tokenInfo ? (parseFloat(buyAmount) / tokenInfo.price).toFixed(0) : "0";
  const estimatedSellSol = sellAmount && tokenInfo ? (parseFloat(sellAmount) * tokenInfo.price).toFixed(6) : "0";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="gradient-hero pt-24 pb-20 min-h-screen">
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

          <div className="bg-card rounded-2xl shadow-noiz-lg p-6 mb-6">
            <Label>Token Mint Address</Label>
            <div className="flex gap-3 mt-2">
              <Input placeholder="Enter mint address..." value={mintInput} onChange={(e) => setMintInput(e.target.value)} className="flex-1" />
              <Button onClick={handleSearch} variant="hero">Load Token</Button>
            </div>
          </div>

          {loading && <div className="bg-card rounded-2xl p-12 text-center"><Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" /></div>}

          {!loading && tokenInfo && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card rounded-2xl shadow-noiz-lg p-6">
                  <div className="flex items-start gap-6">
                    <button onClick={() => setPlaying(!playing)} className="w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center">
                      {playing ? <Pause className="w-8 h-8 text-primary-foreground" /> : <Play className="w-8 h-8 text-primary-foreground ml-1" />}
                    </button>
                    <div>
                      <h2 className="text-2xl font-bold">{tokenInfo.name} <span className="px-2 py-1 bg-noiz-purple/20 text-noiz-purple rounded-lg text-sm">${tokenInfo.symbol}</span></h2>
                      <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                        <div><p className="text-muted-foreground">Price</p><p className="font-bold text-noiz-purple">{tokenInfo.price.toFixed(8)} SOL</p></div>
                        <div><p className="text-muted-foreground">Liquidity</p><p className="font-bold text-noiz-green">{tokenInfo.solReserves.toFixed(2)} SOL</p></div>
                        <div><p className="text-muted-foreground">Market Cap</p><p className="font-bold">${(tokenInfo.solReserves * 200).toFixed(0)}</p></div>
                        <div><p className="text-muted-foreground">Your Balance</p><p className="font-bold">{parseInt(userBalance).toLocaleString()}</p></div>
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
                    <div className="p-3 bg-muted rounded-lg"><p className="text-sm text-muted-foreground">You'll receive</p><p className="font-bold">{parseInt(estimatedBuyTokens).toLocaleString()} {tokenInfo.symbol}</p></div>
                    <Button onClick={handleBuy} disabled={trading || !connected} className="w-full bg-noiz-green hover:bg-noiz-green/80">{trading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{trading ? "Processing..." : "Buy Tokens"}</Button>
                  </TabsContent>
                  <TabsContent value="sell" className="space-y-4">
                    <div><Label>Amount (Tokens)</Label><Input type="number" placeholder="0" value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} className="mt-2" /></div>
                    <div className="p-3 bg-muted rounded-lg"><p className="text-sm text-muted-foreground">You'll receive</p><p className="font-bold">{estimatedSellSol} SOL</p></div>
                    <Button onClick={handleSell} disabled={trading || !connected} className="w-full bg-noiz-pink hover:bg-noiz-pink/80">{trading ? "Processing..." : "Sell Tokens"}</Button>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TradePage;
