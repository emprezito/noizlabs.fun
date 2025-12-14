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
  audio_clip_id: string | null;
  cover_image_url?: string | null;
}

const TokensPage = () => {
  const { price: solUsdPrice, formatUsd } = useSolPrice();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "trending" | "new">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch tokens from Supabase with audio clip data
  const fetchAllTokens = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tokens")
        .select(`
          *,
          audio_clips:audio_clip_id (
            audio_url,
            cover_image_url
          )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Flatten the audio clip data
      const tokensWithImages = (data || []).map((token: any) => ({
        ...token,
        audio_url: token.audio_clips?.audio_url || token.audio_url,
        cover_image_url: token.audio_clips?.cover_image_url || null,
      }));
      
      setTokens(tokensWithImages);
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
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-2 text-foreground">🎵 Audio Tokens</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Discover and trade audio meme tokens created on NoizLabs
            </p>
          </div>

          {/* Search & Filters Bar */}
          <div className="mb-4 md:mb-6 flex flex-col gap-3 bg-card rounded-lg p-3 md:p-4 border border-border">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 md:pl-10 text-sm"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setFilter("all")}
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                className="text-xs md:text-sm"
              >
                All
              </Button>
              <Button
                onClick={() => setFilter("trending")}
                variant={filter === "trending" ? "default" : "outline"}
                size="sm"
                className="text-xs md:text-sm"
              >
                <TrendingUp className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                Trending
              </Button>
              <Button
                onClick={() => setFilter("new")}
                variant={filter === "new" ? "default" : "outline"}
                size="sm"
                className="text-xs md:text-sm"
              >
                <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                New
              </Button>
              <Button
                onClick={fetchAllTokens}
                variant="outline"
                size="sm"
                className="ml-auto"
              >
                <RefreshCw className={`w-3 h-3 md:w-4 md:h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mb-4 md:mb-6 grid grid-cols-3 gap-2 md:gap-4">
            <div className="bg-card rounded-lg p-3 md:p-4 border border-border">
              <p className="text-muted-foreground text-xs md:text-sm">Total Tokens</p>
              <p className="text-lg md:text-2xl font-bold text-foreground">{tokens.length}</p>
            </div>
            <div className="bg-card rounded-lg p-3 md:p-4 border border-border">
              <p className="text-muted-foreground text-xs md:text-sm">Showing</p>
              <p className="text-lg md:text-2xl font-bold text-accent">
                {filteredTokens.length}
              </p>
            </div>
            <div className="bg-card rounded-lg p-3 md:p-4 border border-border">
              <p className="text-muted-foreground text-xs md:text-sm">Total Volume</p>
              <p className="text-lg md:text-2xl font-bold text-primary truncate">
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

          {/* Tokens Table Header - Desktop Only */}
          {!loading && filteredTokens.length > 0 && (
            <div className="hidden md:block bg-card rounded-t-lg border border-border border-b-0">
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
            <div className="bg-card rounded-lg md:rounded-b-lg md:rounded-t-none border border-border md:border-t-0">
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
    <>
      {/* Mobile Card Layout */}
      <div
        onClick={() => window.location.href = `/trade?mint=${token.mint_address}`}
        className="md:hidden p-4 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <div className="flex items-start gap-3">
          {/* Token Image with Play Overlay */}
          <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
            {token.cover_image_url ? (
              <img
                src={token.cover_image_url}
                alt={token.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                <span className="text-xl">🎵</span>
              </div>
            )}
            <button
              onClick={togglePlay}
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            >
              {playing ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </button>
            {playing && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Pause className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">{token.name}</p>
                <p className="text-sm text-muted-foreground">${token.symbol}</p>
              </div>
              <Button size="sm" className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                Trade
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Price</p>
                <p className="font-semibold text-foreground truncate">{price.toFixed(8)}</p>
                <p className="text-muted-foreground">{formatUsd(price)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Mkt Cap</p>
                <p className="font-semibold text-foreground">{marketCap.toFixed(2)}</p>
                <p className="text-muted-foreground">{formatUsd(marketCap)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Volume</p>
                <p className="font-semibold text-foreground">{volume.toFixed(2)}</p>
                <p className="text-muted-foreground">{formatUsd(volume)}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <a
                href={`https://explorer.solana.com/address/${token.mint_address}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
              <button
                onClick={copyMint}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table Row Layout */}
      <div
        onClick={() => window.location.href = `/trade?mint=${token.mint_address}`}
        className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer group"
      >
        {/* Token Info with Image */}
        <div className="col-span-3 flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
            {token.cover_image_url ? (
              <img
                src={token.cover_image_url}
                alt={token.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                <span className="text-lg">🎵</span>
              </div>
            )}
            <button
              onClick={togglePlay}
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            >
              {playing ? (
                <Pause className="w-4 h-4 text-white" />
              ) : (
                <Play className="w-4 h-4 text-white ml-0.5" />
              )}
            </button>
            {playing && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Pause className="w-4 h-4 text-white animate-pulse" />
              </div>
            )}
          </div>
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
          <Button size="sm" onClick={(e) => e.stopPropagation()}>
            Trade
          </Button>
        </div>
      </div>
    </>
  );
}

export default TokensPage;