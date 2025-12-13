import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, TrendingUp, Sparkles, Play, Pause, Copy, Check, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSolPrice } from "@/hooks/useSolPrice";

interface TokenData {
  id: string;
  mint_address: string;
  name: string;
  symbol: string;
  creator_wallet: string;
  audio_url: string | null;
  metadata_uri: string | null;
  total_supply: number;
  sol_reserves: number;
  token_reserves: number;
  tokens_sold: number;
  total_volume: number;
  created_at: string;
  is_active: boolean;
}

const TokensPage = () => {
  const { price: solUsdPrice, formatUsd } = useSolPrice();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "trending" | "new">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch tokens from Supabase
  const fetchAllTokens = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      toast.error("Failed to load tokens");
      setTokens([]);
    }
    setLoading(false);
  };

  // Set up real-time subscription
  useEffect(() => {
    fetchAllTokens();

    const channel = supabase
      .channel("tokens-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tokens",
        },
        () => {
          fetchAllTokens();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (filter === "trending") {
        // Sort by volume
        return (b.total_volume || 0) - (a.total_volume || 0);
      }
      return 0;
    });

  const totalVolume = tokens.reduce(
    (sum, t) => sum + (t.total_volume || 0),
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
                Discover and trade audio meme tokens created on NoizLabs
              </p>
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
                <div className="col-span-2 text-right">Market Cap</div>
                <div className="col-span-2 text-right">Volume</div>
                <div className="col-span-3 text-right">Actions</div>
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
                    Be the first to create one!
                  </p>
                  <Link to="/create">
                    <Button className="mt-4">Create Token</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredTokens.map((token) => (
                    <TokenRow key={token.id} token={token} formatUsd={formatUsd} />
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

function TokenRow({ token, formatUsd }: { token: TokenData; formatUsd: (sol: number) => string }) {
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Calculate price from reserves (pump.fun style)
  const solReserves = (token.sol_reserves || 0) / 1e9;
  const tokenReserves = (token.token_reserves || 0) / 1e9;
  const price = tokenReserves > 0 ? solReserves / tokenReserves : 0;
  
  // Market cap = price * circulating supply (tokens sold)
  const tokensSold = (token.tokens_sold || 0) / 1e9;
  const marketCap = solReserves; // In bonding curve, liquidity = market cap
  const volume = (token.total_volume || 0) / 1e9;

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!token.audio_url) {
      toast.error("No audio available for this token");
      return;
    }

    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      document.querySelectorAll('audio').forEach(audio => audio.pause());
      
      if (!audioRef.current) {
        audioRef.current = new Audio(token.audio_url);
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

  const copyMint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(token.mint_address);
    setCopied(true);
    toast.success("Mint address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return (
    <Link
      to={`/trade?mint=${token.mint_address}`}
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
        <p className="font-semibold text-foreground">{price.toFixed(10)} SOL</p>
        <p className="text-xs text-muted-foreground">{formatUsd(price)}</p>
      </div>

      {/* Market Cap */}
      <div className="col-span-2 flex flex-col items-end justify-center">
        <p className="font-semibold text-foreground">{marketCap.toFixed(4)} SOL</p>
        <p className="text-xs text-muted-foreground">{formatUsd(marketCap)}</p>
      </div>

      {/* Volume */}
      <div className="col-span-2 flex flex-col items-end justify-center">
        <p className="font-semibold text-foreground">{volume.toFixed(4)} SOL</p>
        <p className="text-xs text-muted-foreground">{formatUsd(volume)}</p>
      </div>

      {/* Actions */}
      <div className="col-span-3 flex items-center justify-end gap-2">
        <a
          href={`https://explorer.solana.com/address/${token.mint_address}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          title="View on Solana Explorer"
        >
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </a>
        <button
          onClick={copyMint}
          className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          title="Copy mint address"
        >
          {copied ? (
            <Check className="w-4 h-4 text-primary" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <Button size="sm">
          Trade
        </Button>
      </div>
    </Link>
  );
}

export default TokensPage;