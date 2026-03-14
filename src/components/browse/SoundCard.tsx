import { Play, Pause, Eye, Heart, Rocket, Loader2, ExternalLink, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SoundWithStatus } from "@/hooks/useSoundBrowser";

interface SoundCardProps {
  sound: SoundWithStatus;
  isPlaying: boolean;
  onPlay: () => void;
  onMint: () => void;
  isMinting?: boolean;
}

function truncateTitle(title: string, max = 30) {
  return title.length > max ? title.slice(0, max) + "…" : title;
}

function truncateWallet(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function SoundCard({ sound, isPlaying, onPlay, onMint, isMinting }: SoundCardProps) {
  const { mintStatus, registryEntry } = sound;

  return (
    <div className="group relative bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-all hover:shadow-lg">
      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        {mintStatus === "available" && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
            ✅ Available
          </Badge>
        )}
        {mintStatus === "reserved" && (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs animate-pulse">
            ⏳ Minting in Progress...
          </Badge>
        )}
        {mintStatus === "minted" && (
          <Badge className="bg-muted text-muted-foreground border-border text-xs">
            🔒 Already Minted
          </Badge>
        )}
        <button
          onClick={onPlay}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0",
            isPlaying
              ? "bg-primary text-primary-foreground scale-110"
              : "bg-secondary hover:bg-primary/20 text-foreground"
          )}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
      </div>

      {/* Title */}
      <h3 className="font-bold text-foreground text-sm leading-tight mb-2 min-h-[2.5rem]">
        {truncateTitle(sound.title)}
      </h3>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
        <span className="flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {(sound.views || 0).toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="w-3 h-3" />
          {(sound.favorites || 0).toLocaleString()}
        </span>
      </div>

      {/* Action Area */}
      {mintStatus === "available" && (
        <Button
          onClick={onMint}
          disabled={isMinting}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs animate-pulse hover:animate-none"
          size="sm"
        >
          {isMinting ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Reserving...
            </>
          ) : (
            <>
              <Rocket className="w-3 h-3 mr-1" />
              Mint This Sound
            </>
          )}
        </Button>
      )}

      {mintStatus === "reserved" && (
        <Button disabled variant="secondary" className="w-full text-xs opacity-60" size="sm">
          Being minted right now
        </Button>
      )}

      {mintStatus === "minted" && registryEntry && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <span className="text-foreground font-medium">{registryEntry.token_name}</span>
              {" "}
              <span className="text-primary">${registryEntry.token_ticker}</span>
            </p>
            <p>Minted by {truncateWallet(registryEntry.minted_by || "")}</p>
          </div>
          <div className="flex gap-2">
            {registryEntry.token_address && (
              <>
                <a
                  href={`https://explorer.solana.com/address/${registryEntry.token_address}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View
                  </Button>
                </a>
                <a href={`/trade?mint=${registryEntry.token_address}`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full text-xs">
                    <ArrowRightLeft className="w-3 h-3 mr-1" />
                    Trade
                  </Button>
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
