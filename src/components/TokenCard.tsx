import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, Music2, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface TokenCardProps {
  mint: string;
  name: string;
  symbol: string;
  audioUri: string;
  imageUri?: string;
  price: number;
  priceChange: number;
  marketCap: number;
  volume: number;
  priceHistory?: { value: number }[];
}

export function TokenCard({
  mint, name, symbol, audioUri, imageUri,
  price, priceChange, marketCap, volume, priceHistory,
}: TokenCardProps) {
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const chartData = priceHistory && priceHistory.length > 1
    ? priceHistory
    : Array.from({ length: 10 }, (_, i) => ({ value: 1 + i * 0.01 }));

  const isPositive = priceChange >= 0;
  const chartColor = isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))";

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioUri) { toast.error("No audio available"); return; }
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      document.querySelectorAll("audio").forEach((a) => a.pause());
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUri);
        audioRef.current.onended = () => setPlaying(false);
        audioRef.current.onerror = () => { toast.error("Failed to load audio"); setPlaying(false); };
      }
      audioRef.current.play().catch(() => { toast.error("Failed to play audio"); setPlaying(false); });
      setPlaying(true);
    }
  };

  const copyMint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(mint);
    setCopied(true);
    toast.success("Mint address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);

  return (
    <Link
      to={`/trade?mint=${mint}`}
      className="group flex flex-col bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/60 hover:-translate-y-0.5 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
    >
      {/* Cover Image */}
      <div className="relative w-full aspect-video overflow-hidden bg-muted">
        {imageUri ? (
          <img src={imageUri} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20">
            <Music2 className="w-10 h-10 text-primary/40" />
          </div>
        )}

        {/* Playing equalizer */}
        {playing && (
          <div className="absolute top-2 left-2 flex items-end gap-0.5 h-4 bg-black/40 rounded px-1.5 py-0.5">
            {[1, 2, 3].map((i) => (
              <span key={i} className="w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.1}s`, height: `${50 + i * 15}%` }} />
            ))}
          </div>
        )}

        {/* Play button - floating bottom right, visible on hover */}
        <button
          onClick={togglePlay}
          className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="w-4 h-4 text-primary-foreground" /> : <Play className="w-4 h-4 text-primary-foreground ml-0.5" />}
        </button>
      </div>

      {/* Token Info row */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-border">
          {imageUri ? (
            <img src={imageUri} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary/20 flex items-center justify-center">
              <Music2 className="w-4 h-4 text-primary" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">{name}</p>
          <p className="text-xs text-muted-foreground">${symbol}</p>
        </div>
        <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md ${isPositive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
          {isPositive ? "+" : ""}{priceChange.toFixed(1)}%
        </span>
      </div>

      {/* Sparkline */}
      <div className="px-3 pt-2 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line type="monotone" dataKey="value" stroke={chartColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-px bg-border mx-3 mb-3 mt-2 rounded-lg overflow-hidden border border-border">
        <div className="bg-card px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">MC</p>
          <p className="text-xs font-semibold text-foreground">{marketCap.toFixed(2)} SOL</p>
        </div>
        <div className="bg-card px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vol</p>
          <p className="text-xs font-semibold text-foreground">{volume.toFixed(2)} SOL</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-border/50">
        <p className="text-xs font-mono text-muted-foreground">{price.toFixed(8)} SOL</p>
        <div className="flex items-center gap-1">
          <button onClick={copyMint} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Copy mint address">
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          <a href={`https://explorer.solana.com/address/${mint}?cluster=devnet`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </a>
        </div>
      </div>
    </Link>
  );
}
