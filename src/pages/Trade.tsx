import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, TrendingUp, TrendingDown, Loader2, Info, Play, Pause } from "lucide-react";

interface TokenInfo {
  name: string;
  symbol: string;
  audioUri: string;
  totalSupply: string;
  price: number;
  solReserves: number;
  tokenReserves: number;
}

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

  useEffect(() => {
    if (activeMint) {
      loadTokenInfo();
    }
  }, [activeMint]);

  const loadTokenInfo = () => {
    setLoading(true);
    // Simulate loading token info
    setTimeout(() => {
      setTokenInfo({
        name: "Bruh Sound Effect",
        symbol: "BRUH",
        audioUri: "",
        totalSupply: "1000000000",
        price: 0.00001765,
        solReserves: 15.5,
        tokenReserves: 850000000,
      });
      setUserBalance("1500000");
      setLoading(false);
    }, 1000);
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
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-black text-center mb-8 font-display gradient-text">
              Trade Audio Tokens
            </h1>

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
              <div className="space-y-6">
                {/* Token Info Card */}
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
                      <h2 className="text-2xl font-bold text-foreground font-display">
                        {tokenInfo.name}
                      </h2>
                      <p className="text-muted-foreground">${tokenInfo.symbol}</p>
                      <div className="mt-4 grid grid-cols-3 gap-4">
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
                          <p className="text-sm text-muted-foreground">Your Balance</p>
                          <p className="text-lg font-bold text-foreground">
                            {parseInt(userBalance).toLocaleString()} {tokenInfo.symbol}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trading Panel */}
                <div className="bg-card rounded-2xl shadow-noiz-lg p-6">
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
                            {amt} SOL
                          </Button>
                        ))}
                      </div>

                      <div className="bg-muted rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">You will receive:</span>
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
                          <span className="text-muted-foreground">You will receive:</span>
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
                  <Info className="w-5 h-5 text-accent mt-0.5" />
                  <div>
                    <p className="text-sm text-foreground font-semibold">
                      Bonding Curve Trading
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Prices are automatically determined by the bonding curve. As more tokens are
                      bought, the price increases. 1% fee on each trade.
                    </p>
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
