import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, TrendingUp, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
}

export function TokenCard({
  mint,
  name,
  symbol,
  audioUri,
  imageUri,
  price,
  priceChange,
  marketCap,
  volume,
}: TokenCardProps) {
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!audioUri) {
      toast.error("No audio available");
      return;
    }

    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      // Stop other audio
      document.querySelectorAll("audio").forEach((a) => a.pause());

      if (!audioRef.current) {
        audioRef.current = new Audio(audioUri);
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
    navigator.clipboard.writeText(mint);
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
      to={`/trade?mint=${mint}`}
      className="group bg-card rounded-xl border border-border p-4 hover:border-primary/50 transition-all hover:shadow-lg"
    >
      {/* Image/Audio Player */}
      <div className="relative aspect-square rounded-lg overflow-hidden mb-3 bg-muted">
        {imageUri ? (
          <img
            src={imageUri}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
            <span className="text-4xl">🎵</span>
          </div>
        )}
        
        {/* Play Button Overlay */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            {playing ? (
              <Pause className="w-5 h-5 text-primary-foreground" />
            ) : (
              <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
            )}
          </div>
        </button>
      </div>

      {/* Token Info */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
              {name}
            </h3>
            <p className="text-sm text-muted-foreground">${symbol}</p>
          </div>
          <div
            className={`shrink-0 px-2 py-1 rounded-lg text-xs font-semibold ${
              priceChange >= 0
                ? "bg-green-500/10 text-green-500"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(1)}%
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Price</p>
            <p className="font-semibold">{price.toFixed(8)} SOL</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Market Cap</p>
            <p className="font-semibold">{marketCap.toFixed(2)} SOL</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" className="flex-1">
            <TrendingUp className="w-3 h-3 mr-1" />
            Trade
          </Button>
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
        </div>
      </div>
    </Link>
  );
}
