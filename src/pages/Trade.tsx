import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, TrendingUp, TrendingDown, Loader2, Info, Play, Pause, ArrowLeft, ExternalLink } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

interface TokenInfo {
  name: string;
  symbol: string;
  audioUri: string;
  totalSupply: string;
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

// Demo chart data
const generateChartData = () => {
  const data = [];
  let price = 0.00001;
  for (let i = 0; i < 24; i++) {
    price = price + (Math.random() - 0.4) * 0.000005;
    price = Math.max(0.000005, price);
    data.push({
      time: `${i}:00`,
      price: price,
      volume: Math.random() * 5,
    });
  }
  return data;
};

// Demo transactions
const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "1", type: "buy", amount: 1500000, price: 0.00001765, timestamp: Date.now() - 300000, wallet: "7Np...abc" },
  { id: "2", type: "sell", amount: 500000, price: 0.00001720, timestamp: Date.now() - 900000, wallet: "8Kp...def" },
  { id: "3", type: "buy", amount: 2500000, price: 0.00001680, timestamp: Date.now() - 1800000, wallet: "2Lp...ghi" },
  { id: "4", type: "buy", amount: 800000, price: 0.00001650, timestamp: Date.now() - 3600000, wallet: "4Mp...jkl" },
  { id: "5", type: "sell", amount: 1200000, price: 0.00001700, timestamp: Date.now() - 7200000, wallet: "9Qp...mno" },
];

// Token data mapping (simulating fetching by mint)
const TOKEN_DATA: Record<string, TokenInfo> = {
  "8m6HBVw1n2q6E3YWTk...": {
    name: "Bruh Sound Effect",
    symbol: "BRUH",
    audioUri: "",
    totalSupply: "1000000000",
    price: 0.00001765,
    solReserves: 15.5,
    tokenReserves: 850000000,
    mint: "8m6HBVw1n2q6E3YWTk...",
  },
  "9k7HBVw1n2q6E3YWTk...": {
    name: "Vine Boom",
    symbol: "BOOM",
    audioUri: "",
    totalSupply: "1000000000",
    price: 0.00003333,
    solReserves: 25.0,
    tokenReserves: 750000000,
    mint: "9k7HBVw1n2q6E3YWTk...",
  },
  "3j4HBVw1n2q6E3YWTk...": {
    name: "Oof Sound",
    symbol: "OOF",
    audioUri: "",
    totalSupply: "1000000000",
    price: 0.0000087,
    solReserves: 8.0,
    tokenReserves: 920000000,
    mint: "3j4HBVw1n2q6E3YWTk...",
  },
  "5m8HBVw1n2q6E3YWTk...": {
    name: "Sad Violin",
    symbol: "SAD",
    audioUri: "",
    totalSupply: "1000000000",
    price: 0.00007,
    solReserves: 42.0,
    tokenReserves: 600000000,
    mint: "5m8HBVw1n2q6E3YWTk...",
  },
};

const TradePage = () => {
  const [searchParams] = useSearchParams();
  const initialMint = searchParams.get("mint") || "";

  const [mintInput, setMintInput] = useState(initialMint);
  const [activeMint, setActiveMint] = useState(initialMint);
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [userBalance, setUserBalance] = useState("0");
  const [playing, setPlaying] = useState(false);
  const [chartData] = useState(generateChartData());
  const [transactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);

  useEffect(() => {
    if (activeMint) {
      loadTokenInfo();
    }
  }, [activeMint]);

  const loadTokenInfo = () => {
    setLoading(true);
    // Simulate loading token info based on mint
    setTimeout(() => {
      const token = TOKEN_DATA[activeMint] || {
        name: "Unknown Token",
        symbol: "???",
        audioUri: "",
        totalSupply: "1000000000",
        price: 0.00001765,
        solReserves: 15.5,
        tokenReserves: 850000000,
        mint: activeMint,
      };
      setTokenInfo(token);
      setUserBalance("1500000");
      setLoading(false);
    }, 800);
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const handleSearch = () => {
    if (!mintInput) {
      toast.error("Please enter a mint address");
      return;
    }
    setActiveMint(mintInput);
  };

  const handleBuy = () => {
    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    toast.success(`Bought tokens with ${buyAmount} SOL!`);
    setBuyAmount("");
  };

  const handleSell = () => {
    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    toast.success(`Sold ${sellAmount} tokens!`);
    setSellAmount("");
  };

  const calculateBuyReturn = () => {
    if (!buyAmount || !tokenInfo) return 0;
    const sol = parseFloat(buyAmount);
    // Simplified bonding curve calculation
    return (sol / tokenInfo.price).toFixed(0);
  };

  const calculateSellReturn = () => {
    if (!sellAmount || !tokenInfo) return 0;
    const tokens = parseFloat(sellAmount);
    // Simplified bonding curve calculation
    return (tokens * tokenInfo.price).toFixed(6);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="gradient-hero pt-24 pb-20 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* Back Button */}
            <Link
              to="/tokens"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tokens
            </Link>

            {/* Search Section */}
            <div className="bg-card rounded-2xl shadow-noiz-lg p-6 mb-6">
              <Label className="text-foreground mb-2 block">Token Mint Address</Label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Enter mint address..."
                    value={mintInput}
                    onChange={(e) => setMintInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch} variant="hero">
                  Load Token
                </Button>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="bg-card rounded-2xl shadow-noiz-lg p-12 text-center">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                <p className="mt-4 text-muted-foreground">Loading token info...</p>
              </div>
            )}

            {/* Token Info & Trading */}
            {!loading && tokenInfo && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Chart & Transactions */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Token Info Header */}
                  <div className="bg-card rounded-2xl shadow-noiz-lg p-6">
                    <div className="flex items-start gap-6">
                      <button
                        onClick={() => setPlaying(!playing)}
                        className="w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
                      >
                        {playing ? (
                          <Pause className="w-8 h-8 text-primary-foreground" />
                        ) : (
                          <Play className="w-8 h-8 text-primary-foreground ml-1" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-bold text-foreground font-display">
                            {tokenInfo.name}
                          </h2>
                          <span className="px-2 py-1 bg-noiz-purple/20 text-noiz-purple rounded-lg text-sm font-semibold">
                            ${tokenInfo.symbol}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                          {tokenInfo.mint.substring(0, 20)}...
                          <ExternalLink className="w-3 h-3" />
                        </p>
                        <div className="mt-4 grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Price</p>
                            <p className="text-lg font-bold text-noiz-purple">
                              {tokenInfo.price.toFixed(8)} SOL
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Liquidity</p>
                            <p className="text-lg font-bold text-noiz-green">
                              {tokenInfo.solReserves.toFixed(2)} SOL
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Market Cap</p>
                            <p className="text-lg font-bold text-foreground">
                              ${(tokenInfo.solReserves * 200).toFixed(0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Your Balance</p>
                            <p className="text-lg font-bold text-foreground">
                              {parseInt(userBalance).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Price Chart */}
                  <div className="bg-card rounded-2xl shadow-noiz-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-foreground font-display">Price Chart</h3>
                      <div className="flex gap-2">
                        {["1H", "24H", "7D", "30D"].map((period) => (
                          <button
                            key={period}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              period === "24H"
                                ? "bg-noiz-purple text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="time"
                            stroke="#666"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="#666"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => value.toFixed(6)}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1a1a2e",
                              border: "1px solid #333",
                              borderRadius: "8px",
                            }}
                            labelStyle={{ color: "#fff" }}
                            formatter={(value: number) => [value.toFixed(8) + " SOL", "Price"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#A855F7"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPrice)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  <div className="bg-card rounded-2xl shadow-noiz-lg p-6">
                    <h3 className="text-lg font-bold text-foreground font-display mb-4">
                      Recent Transactions
                    </h3>
                    <div className="space-y-3">
                      {transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                tx.type === "buy"
                                  ? "bg-noiz-green/20 text-noiz-green"
                                  : "bg-noiz-pink/20 text-noiz-pink"
                              }`}
                            >
                              {tx.type === "buy" ? (
                                <TrendingUp className="w-5 h-5" />
                              ) : (
                                <TrendingDown className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground capitalize">{tx.type}</p>
                              <p className="text-sm text-muted-foreground">{tx.wallet}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">
                              {tx.amount.toLocaleString()} {tokenInfo.symbol}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatTimeAgo(tx.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - Trading Panel */}
                <div className="space-y-6">
                  {/* Trading Panel */}
                  <div className="bg-card rounded-2xl shadow-noiz-lg p-6 sticky top-24">
                    <Tabs defaultValue="buy" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="buy" className="text-lg font-semibold">
                          <TrendingUp className="w-5 h-5 mr-2" />
                          Buy
                        </TabsTrigger>
                        <TabsTrigger value="sell" className="text-lg font-semibold">
                          <TrendingDown className="w-5 h-5 mr-2" />
                          Sell
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="buy" className="space-y-4">
                        <div>
                          <Label className="text-foreground">Amount (SOL)</Label>
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={buyAmount}
                            onChange={(e) => setBuyAmount(e.target.value)}
                            className="mt-2 text-lg"
                          />
                        </div>

                        <div className="flex gap-2">
                          {["0.1", "0.5", "1", "5"].map((amt) => (
                            <Button
                              key={amt}
                              variant="outline"
                              size="sm"
                              onClick={() => setBuyAmount(amt)}
                              className="flex-1"
                            >
                              {amt}
                            </Button>
                          ))}
                        </div>

                        <div className="bg-muted rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">You receive:</span>
                            <span className="text-lg font-bold text-noiz-green">
                              ~{calculateBuyReturn()} {tokenInfo.symbol}
                            </span>
                          </div>
                        </div>

                        <Button
                          onClick={handleBuy}
                          disabled={!buyAmount}
                          variant="hero"
                          size="xl"
                          className="w-full"
                        >
                          🚀 Buy {tokenInfo.symbol}
                        </Button>
                      </TabsContent>

                      <TabsContent value="sell" className="space-y-4">
                        <div>
                          <Label className="text-foreground">Amount ({tokenInfo.symbol})</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={sellAmount}
                            onChange={(e) => setSellAmount(e.target.value)}
                            className="mt-2 text-lg"
                          />
                        </div>

                        <div className="flex gap-2">
                          {["25", "50", "75", "100"].map((pct) => (
                            <Button
                              key={pct}
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSellAmount(
                                  ((parseInt(userBalance) * parseInt(pct)) / 100).toString()
                                )
                              }
                              className="flex-1"
                            >
                              {pct}%
                            </Button>
                          ))}
                        </div>

                        <div className="bg-muted rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">You receive:</span>
                            <span className="text-lg font-bold text-noiz-pink">
                              ~{calculateSellReturn()} SOL
                            </span>
                          </div>
                        </div>

                        <Button
                          onClick={handleSell}
                          disabled={!sellAmount}
                          variant="secondary"
                          size="xl"
                          className="w-full"
                        >
                          💰 Sell {tokenInfo.symbol}
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </div>

                  {/* Info Card */}
                  <div className="bg-accent/10 rounded-2xl p-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-foreground font-semibold">Bonding Curve</p>
                      <p className="text-sm text-muted-foreground">
                        Prices change based on supply. 1% fee on trades.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !tokenInfo && !activeMint && (
              <div className="bg-card rounded-2xl shadow-noiz-lg p-12 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Enter a Token Address
                </h3>
                <p className="text-muted-foreground">
                  Paste a token mint address above to start trading
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TradePage;
