import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, TrendingUp, Sparkles, Play, Pause, ExternalLink, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSolPrice } from "@/hooks/useSolPrice";
import { LineChart, Line, ResponsiveContainer } from "recharts";

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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tokens", filter: "is_active=eq.true" },
        (payload) => {
          setTokens(prev => prev.map(t =>
            t.mint_address === (payload.new as any).mint_address ? { ...t, ...(payload.new as any) } : t
          ));
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tokens" }, () => fetchAllTokens())
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
      <div className="mb-5 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-card border-border text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "trending", "new"] as const).map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="capitalize"
            >
              {f === "trending" && <TrendingUp className="w-3 h-3 mr-1" />}
              {f === "new" && <Sparkles className="w-3 h-3 mr-1" />}
              {f}
            </Button>
          ))}
          <Button onClick={fetchAllTokens} variant="outline" size="sm" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Stats pills */}
      <div className="mb-5 flex gap-2 text-sm">
        <div className="bg-card rounded-lg px-3 py-1.5 border border-border text-xs">
          <span className="text-muted-foreground">Total: </span>
          <span className="font-bold">{tokens.length}</span>
        </div>
        <div className="bg-card rounded-lg px-3 py-1.5 border border-border text-xs">
          <span className="text-muted-foreground">Showing: </span>
          <span className="font-bold text-primary">{filteredTokens.length}</span>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      )}

      {/* Masonry Token Grid */}
      {!loading && (
        <>
          {filteredTokens.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <Music2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No tokens found</p>
              <Link to="/create">
                <Button size="sm" className="mt-3">Create Token</Button>
              </Link>
            </div>
          ) : (
            <div
              className="columns-1 sm:columns-2 lg:columns-3 gap-4"
              style={{ columnGap: "1rem" }}
            >
              {filteredTokens.map((token) => (
                <div key={token.id} className="break-inside-avoid mb-4">
                  <TokenCard token={token} formatUsd={formatUsd} />
                </div>
              ))}
            </div>
          )}
        </>
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

  // Placeholder sparkline
  const chartData = Array.from({ length: 12 }, (_, i) => ({ value: solReserves * (0.85 + Math.random() * 0.3) }));

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token.audio_url) { toast.error("No audio available"); return; }
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      document.querySelectorAll("audio").forEach((a) => a.pause());
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
      className="group bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/60 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-primary/5"
    >
      {/* Cover image */}
      <div className="relative w-full aspect-video overflow-hidden bg-muted">
        {token.cover_image_url ? (
          <img src={token.cover_image_url} alt={token.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20">
            <Music2 className="w-10 h-10 text-primary/30" />
          </div>
        )}

        {/* Equalizer when playing */}
        {playing && (
          <div className="absolute top-2 left-2 flex items-end gap-0.5 h-4 bg-black/50 rounded px-1.5 py-0.5">
            {[1, 2, 3].map((i) => (
              <span key={i} className="w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.1}s`, height: `${45 + i * 15}%` }} />
            ))}
          </div>
        )}

        {/* Play button */}
        <button
          onClick={togglePlay}
          className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95"
        >
          {playing ? <Pause className="w-4 h-4 text-primary-foreground" /> : <Play className="w-4 h-4 text-primary-foreground ml-0.5" />}
        </button>
      </div>

      {/* Info */}
      <div className="px-3 pt-3">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-border">
            {token.cover_image_url ? (
              <img src={token.cover_image_url} alt={token.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <Music2 className="w-4 h-4 text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">{token.name}</p>
            <p className="text-xs text-muted-foreground">${token.symbol}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-semibold text-foreground">{price.toFixed(8)}</p>
            <p className="text-xs text-muted-foreground">{formatUsd(price)}</p>
          </div>
        </div>

        {/* Sparkline */}
        <div className="h-10 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-px bg-border mx-3 mb-3 mt-2 rounded-lg overflow-hidden border border-border">
        <div className="bg-card px-2.5 py-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">MC</p>
          <p className="text-xs font-semibold">{solReserves.toFixed(3)} SOL</p>
        </div>
        <div className="bg-card px-2.5 py-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vol</p>
          <p className="text-xs font-semibold">{volume.toFixed(2)} SOL</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end px-3 pb-3 pt-1 border-t border-border/40">
        <a
          href={`https://explorer.solana.com/address/${token.mint_address}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </a>
      </div>
    </div>
  );
}

export default TokensTab;
