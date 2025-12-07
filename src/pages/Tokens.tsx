import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useConnection } from "@solana/wallet-adapter-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, TrendingUp, Sparkles, Play, Pause, Wifi, WifiOff } from "lucide-react";
import { fetchAllTokensWithCurves, TokenWithCurve, getBondingCurvePDA } from "@/lib/solana/fetchTokens";
import { PublicKey } from "@solana/web3.js";

interface AudioTokenData {
  mint: string;
  name: string;
  symbol: string;
  audioUri: string;
  authority: string;
  totalSupply: string;
  createdAt: number;
  bondingCurveData?: {
    solReserves: string;
    tokenReserves: string;
    tokensSold: string;
    price: number;
  };
}

// Demo tokens for fallback
const DEMO_TOKENS: AudioTokenData[] = [
  {
    mint: "8m6HBVw1n2q6E3YWTk...",
    name: "Bruh Sound Effect",
    symbol: "BRUH",
    audioUri: "",
    authority: "7Np...abc",
    totalSupply: "1000000000",
    createdAt: Date.now() - 86400000,
    bondingCurveData: {
      solReserves: "15000000000",
      tokenReserves: "850000000000000000",
      tokensSold: "150000000000000000",
      price: 0.00001765,
    },
  },
  {
    mint: "9k7HBVw1n2q6E3YWTk...",
    name: "Vine Boom",
    symbol: "BOOM",
    audioUri: "",
    authority: "8Kp...def",
    totalSupply: "1000000000",
    createdAt: Date.now() - 172800000,
    bondingCurveData: {
      solReserves: "25000000000",
      tokenReserves: "750000000000000000",
      tokensSold: "250000000000000000",
      price: 0.00003333,
    },
  },
];

const TokensPage = () => {
  const { connection } = useConnection();
  const [tokens, setTokens] = useState<AudioTokenData[]>(DEMO_TOKENS);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "trending" | "new">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [subscriptionIds, setSubscriptionIds] = useState<number[]>([]);

  // Convert blockchain data to UI format
  const convertToUIFormat = useCallback((tokensWithCurves: TokenWithCurve[]): AudioTokenData[] => {
    return tokensWithCurves.map(({ audioToken, bondingCurve, currentPrice }) => ({
      mint: audioToken.mint,
      name: audioToken.name,
      symbol: audioToken.symbol,
      audioUri: audioToken.audioUri,
      authority: audioToken.authority,
      totalSupply: String(audioToken.totalSupply * 1e9),
      createdAt: audioToken.createdAt,
      bondingCurveData: bondingCurve ? {
        solReserves: String(bondingCurve.solReserves * 1e9),
        tokenReserves: String(bondingCurve.tokenReserves * 1e9),
        tokensSold: String(bondingCurve.tokensSold * 1e9),
        price: currentPrice,
      } : undefined,
    }));
  }, []);

  // Fetch tokens from blockchain
  const fetchAllTokens = useCallback(async () => {
    setLoading(true);
    try {
      const tokensWithCurves = await fetchAllTokensWithCurves(connection);
      
      if (tokensWithCurves.length > 0) {
        const uiTokens = convertToUIFormat(tokensWithCurves);
        setTokens(uiTokens);
        
        // Set up real-time subscriptions
        setupSubscriptions(tokensWithCurves);
      } else {
        // Use demo data if no tokens found
        setTokens(DEMO_TOKENS);
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
      setTokens(DEMO_TOKENS);
    }
    setLoading(false);
  }, [connection, convertToUIFormat]);

  // Set up WebSocket subscriptions for real-time updates
  const setupSubscriptions = useCallback((tokensWithCurves: TokenWithCurve[]) => {
    // Clean up existing subscriptions
    subscriptionIds.forEach(id => {
      connection.removeAccountChangeListener(id);
    });

    const newIds: number[] = [];

    tokensWithCurves.forEach(({ audioToken, bondingCurve }) => {
      if (bondingCurve) {
        try {
          const [curvePDA] = getBondingCurvePDA(new PublicKey(audioToken.mint));
          
          const subId = connection.onAccountChange(
            curvePDA,
            (accountInfo) => {
              // Update token price in real-time
              const data = accountInfo.data;
              if (data.length >= 89) {
                let offset = 8 + 32 + 32; // Skip discriminator, mint, creator
                const solReserves = Number(data.readBigUInt64LE(offset)) / 1e9;
                offset += 8;
                const tokenReserves = Number(data.readBigUInt64LE(offset)) / 1e9;
                
                const newPrice = tokenReserves > 0 ? solReserves / tokenReserves : 0;
                
                setTokens(prev => prev.map(t => {
                  if (t.mint === audioToken.mint && t.bondingCurveData) {
                    return {
                      ...t,
                      bondingCurveData: {
                        ...t.bondingCurveData,
                        solReserves: String(solReserves * 1e9),
                        tokenReserves: String(tokenReserves * 1e9),
                        price: newPrice,
                      },
                    };
                  }
                  return t;
                }));
              }
            },
            "confirmed"
          );
          newIds.push(subId);
        } catch (error) {
          console.error("Error setting up subscription:", error);
        }
      }
    });

    setSubscriptionIds(newIds);
    setIsLive(newIds.length > 0);
  }, [connection, subscriptionIds]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptionIds.forEach(id => {
        connection.removeAccountChangeListener(id);
      });
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllTokens();
  }, []);

  const filteredTokens = tokens
    .filter((token) => {
      if (searchQuery) {
        return (
          token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (filter === "new") {
        return b.createdAt - a.createdAt;
      }
      if (filter === "trending") {
        return (b.bondingCurveData?.price || 0) - (a.bondingCurveData?.price || 0);
      }
      return 0;
    });

  const totalVolume = tokens.reduce(
    (sum, t) => sum + parseFloat(t.bondingCurveData?.solReserves || "0"),
    0
  ) / 1e9;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-foreground">🎵 Audio Tokens</h1>
              <p className="text-muted-foreground">
                Discover and trade audio meme tokens
              </p>
            </div>
            {/* Live Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isLive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {isLive ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isLive ? "Live" : "Demo Mode"}
            </div>
          </div>

          {/* Search & Filters Bar */}
          <div className="mb-6 flex flex-col md:flex-row gap-4 items-center bg-card rounded-lg p-4 border border-border">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={() => setFilter("all")}
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
              >
                All
              </Button>
              <Button
                onClick={() => setFilter("trending")}
                variant={filter === "trending" ? "default" : "outline"}
                size="sm"
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                Trending
              </Button>
              <Button
                onClick={() => setFilter("new")}
                variant={filter === "new" ? "default" : "outline"}
                size="sm"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                New
              </Button>
              <Button
                onClick={fetchAllTokens}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-muted-foreground text-sm">Total Tokens</p>
              <p className="text-2xl font-bold text-foreground">{tokens.length}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-muted-foreground text-sm">Showing</p>
              <p className="text-2xl font-bold text-accent">
                {filteredTokens.length}
              </p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-muted-foreground text-sm">Total Volume</p>
              <p className="text-2xl font-bold text-primary">
                {totalVolume.toFixed(2)} SOL
              </p>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">Loading tokens...</p>
            </div>
          )}

          {/* Tokens Table Header */}
          {!loading && filteredTokens.length > 0 && (
            <div className="bg-card rounded-t-lg border border-border border-b-0">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-sm text-muted-foreground font-semibold">
                <div className="col-span-3">Token</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">24h %</div>
                <div className="col-span-2 text-right">Market Cap</div>
                <div className="col-span-2 text-right">Volume</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
            </div>
          )}

          {/* Tokens List */}
          {!loading && (
            <div className="bg-card rounded-b-lg border border-border border-t-0">
              {filteredTokens.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg">No tokens found</p>
                  <p className="text-muted-foreground/60 text-sm mt-2">
                    Try a different search or filter
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredTokens.map((token) => (
                    <TokenRow key={token.mint} token={token} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

function TokenRow({ token }: { token: AudioTokenData }) {
  const [playing, setPlaying] = useState(false);

  const getCurrentPrice = () => {
    if (!token.bondingCurveData) return 0;
    const solReserves = parseFloat(token.bondingCurveData.solReserves) / 1e9;
    const tokenReserves = parseFloat(token.bondingCurveData.tokenReserves) / 1e9;
    if (tokenReserves === 0) return 0;
    return solReserves / tokenReserves;
  };

  const getPriceChange = () => {
    if (!token.bondingCurveData) return 0;
    const sold = parseFloat(token.bondingCurveData.tokensSold) / 1e9;
    const totalSupply = parseFloat(token.bondingCurveData.tokenReserves) / 1e9 + sold;
    return (sold / totalSupply) * 100;
  };

  const price = getCurrentPrice();
  const priceChange = getPriceChange();
  const marketCap = token.bondingCurveData
    ? parseFloat(token.bondingCurveData.solReserves) / 1e9
    : 0;
  const volume = marketCap * 0.3;
  const priceInUSD = price * 200;

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPlaying(!playing);
  };

  return (
    <Link
      to={`/trade?mint=${token.mint}`}
      className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer group"
    >
      {/* Token Info */}
      <div className="col-span-3 flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 bg-primary rounded-full flex items-center justify-center hover:bg-primary/80 transition-colors flex-shrink-0"
        >
          {playing ? (
            <Pause className="w-4 h-4 text-primary-foreground" />
          ) : (
            <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
          )}
        </button>
        <div className="min-w-0">
          <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
            {token.name}
          </p>
          <p className="text-sm text-muted-foreground truncate">${token.symbol}</p>
        </div>
      </div>

      {/* Price */}
      <div className="col-span-2 flex flex-col items-end justify-center">
        <p className="font-semibold text-foreground">{price.toFixed(8)} SOL</p>
        <p className="text-xs text-muted-foreground">${priceInUSD.toFixed(6)}</p>
      </div>

      {/* 24h Change */}
      <div className="col-span-2 flex items-center justify-end">
        <div
          className={`px-3 py-1 rounded-lg font-semibold ${
            priceChange >= 0
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {priceChange >= 0 ? "+" : ""}
          {priceChange.toFixed(2)}%
        </div>
      </div>

      {/* Market Cap */}
      <div className="col-span-2 flex flex-col items-end justify-center">
        <p className="font-semibold text-foreground">{marketCap.toFixed(2)} SOL</p>
        <p className="text-xs text-muted-foreground">${(marketCap * 200).toFixed(0)}</p>
      </div>

      {/* Volume */}
      <div className="col-span-2 flex flex-col items-end justify-center">
        <p className="font-semibold text-foreground">{volume.toFixed(2)} SOL</p>
        <p className="text-xs text-muted-foreground">${(volume * 200).toFixed(0)}</p>
      </div>

      {/* Actions */}
      <div className="col-span-1 flex items-center justify-end">
        <Button size="sm">
          Trade
        </Button>
      </div>
    </Link>
  );
}

export default TokensPage;