import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, TrendingUp, Sparkles, Play, Pause, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSolPrice } from "@/hooks/useSolPrice";

interface TokenData {
  id: string;
  mint_address: string;
  name: string;
  symbol: string;
  audio_url: string | null;
  sol_reserves: number;
  token_reserves: number;
  total_volume: number;
  created_at: string;
  cover_image_url?: string | null;
}

const TokensTab = () => {
  const { formatUsd } = useSolPrice();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "trending" | "new">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAllTokens = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tokens")
        .select(`*, audio_clips:audio_clip_id (audio_url, cover_image_url)`)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const tokensWithImages = (data || []).map((token: any) => ({
        ...token,
        audio_url: token.audio_clips?.audio_url || token.audio_url,
        // Prioritize token's own cover_image_url, fallback to audio_clips
        cover_image_url: token.cover_image_url || token.audio_clips?.cover_image_url || null,
      }));
      
      setTokens(tokensWithImages);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      toast.error("Failed to load tokens");
      setTokens([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllTokens();

    const channel = supabase
      .channel("tokens-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "tokens" }, () => fetchAllTokens())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredTokens = tokens
    .filter((token) => {
      if (searchQuery) {
        return token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => {
      if (filter === "new") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (filter === "trending") return (b.total_volume || 0) - (a.total_volume || 0);
      return 0;
    });

  return (
    <div>
      {/* Search & Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2 bg-card rounded-lg p-3 border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          <Button onClick={() => setFilter("all")} variant={filter === "all" ? "default" : "outline"} size="sm">All</Button>
          <Button onClick={() => setFilter("trending")} variant={filter === "trending" ? "default" : "outline"} size="sm">
            <TrendingUp className="w-3 h-3 mr-1" />Trending
          </Button>
          <Button onClick={() => setFilter("new")} variant={filter === "new" ? "default" : "outline"} size="sm">
            <Sparkles className="w-3 h-3 mr-1" />New
          </Button>
          <Button onClick={fetchAllTokens} variant="outline" size="sm">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 flex gap-3 text-sm">
        <div className="bg-card rounded-lg px-3 py-2 border border-border">
          <span className="text-muted-foreground">Total:</span>{" "}
          <span className="font-bold">{tokens.length}</span>
        </div>
        <div className="bg-card rounded-lg px-3 py-2 border border-border">
          <span className="text-muted-foreground">Showing:</span>{" "}
          <span className="font-bold text-accent">{filteredTokens.length}</span>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Token Grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTokens.length === 0 ? (
            <div className="col-span-full text-center py-8 bg-card rounded-lg border border-border">
              <p className="text-muted-foreground">No tokens found</p>
              <Link to="/create"><Button size="sm" className="mt-2">Create Token</Button></Link>
            </div>
          ) : (
            filteredTokens.map((token) => (
              <TokenCard key={token.id} token={token} formatUsd={formatUsd} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

function TokenCard({ token, formatUsd }: { token: TokenData; formatUsd: (sol: number) => string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const solReserves = (token.sol_reserves || 0) / 1e9;
  const tokenReserves = (token.token_reserves || 0) / 1e9;
  const price = tokenReserves > 0 ? solReserves / tokenReserves : 0;
  const volume = (token.total_volume || 0) / 1e9;

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!token.audio_url) {
      toast.error("No audio available");
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
      }
      audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  useEffect(() => {
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);

  return (
    <div
      onClick={() => window.location.href = `/trade?mint=${token.mint_address}`}
      className="bg-card rounded-lg border border-border p-3 hover:border-primary/50 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {/* Image */}
        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          {token.cover_image_url ? (
            <img src={token.cover_image_url} alt={token.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
              <span className="text-lg">🎵</span>
            </div>
          )}
          {/* Play button - always visible on mobile, hover on desktop */}
          <button
            onClick={togglePlay}
            className={`absolute inset-0 flex items-center justify-center transition-opacity ${
              playing 
                ? "bg-black/40 opacity-100" 
                : "bg-black/40 opacity-100 md:opacity-0 md:hover:opacity-100"
            }`}
          >
            {playing ? <Pause className="w-4 h-4 text-white animate-pulse" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground truncate">{token.name}</p>
          <p className="text-xs text-muted-foreground">${token.symbol}</p>
        </div>

        {/* Stats */}
        <div className="text-right text-xs">
          <p className="font-semibold text-foreground">{price.toFixed(8)}</p>
          <p className="text-muted-foreground">{formatUsd(price)}</p>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <div className="flex gap-3 text-muted-foreground">
          <span>MC: {solReserves.toFixed(3)} SOL</span>
          <span>Vol: {volume.toFixed(2)} SOL</span>
        </div>
        <a
          href={`https://explorer.solana.com/address/${token.mint_address}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

export default TokensTab;
