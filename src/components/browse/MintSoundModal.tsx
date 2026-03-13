import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Clock, Rocket, Loader2, Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { SoundWithStatus } from "@/hooks/useSoundBrowser";

interface MintSoundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sound: SoundWithStatus | null;
  timeLeft: number;
  formatTimeLeft: () => string;
  onRelease: () => void;
  onSubmitMint: (name: string, ticker: string, description: string) => Promise<void>;
  isMinting: boolean;
  mintResult?: { tokenAddress: string; tokenName: string; tokenTicker: string } | null;
}

export function MintSoundModal({
  open,
  onOpenChange,
  sound,
  timeLeft,
  formatTimeLeft,
  onRelease,
  onSubmitMint,
  isMinting,
  mintResult,
}: MintSoundModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (sound) {
      setName(sound.title.slice(0, 32));
      const autoTicker = sound.title
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6) || "TOKEN";
      setTicker(autoTicker);
      setDescription(`${sound.title} — Minted on NoizLabs. The original sound token.`);
    }
  }, [sound]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !mintResult) {
      onRelease();
    }
    onOpenChange(isOpen);
  };

  const handleMint = async () => {
    if (!name.trim() || !ticker.trim()) {
      toast.error("Name and ticker are required");
      return;
    }
    await onSubmitMint(name.trim(), ticker.trim().slice(0, 6), description.trim());
  };

  const tweetText = mintResult
    ? `I just minted '${mintResult.tokenName}' as $${mintResult.tokenTicker} on @noizlabs_fun — nobody else can ever mint this sound again 🔒 #Solana #NoizLabs`
    : "";

  const copyTweet = () => {
    navigator.clipboard.writeText(tweetText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!sound) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        {mintResult ? (
          /* POST-MINT SUCCESS */
          <div className="space-y-6 text-center py-4">
            <div className="text-5xl">🎉</div>
            <DialogHeader>
              <DialogTitle className="text-2xl text-foreground">You just made history.</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              <span className="text-foreground font-bold">{mintResult.tokenName}</span> (${mintResult.tokenTicker}) is now permanently yours on-chain. No one else can ever mint this sound.
            </p>

            <div className="bg-secondary/50 rounded-xl p-4 text-left text-sm text-muted-foreground">
              {tweetText}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={copyTweet}
                variant="outline"
                className="flex-1"
              >
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full">
                  <Share2 className="w-4 h-4 mr-1" />
                  Share on 𝕏
                </Button>
              </a>
            </div>

            <Button
              variant="secondary"
              onClick={() => {
                onOpenChange(false);
                navigate(`/trade?mint=${mintResult.tokenAddress}`);
              }}
              className="w-full"
            >
              View & Trade Token
            </Button>
          </div>
        ) : (
          /* MINT FORM */
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle className="text-xl text-foreground flex items-center gap-2">
                <Rocket className="w-5 h-5 text-primary" />
                Mint Sound Token
              </DialogTitle>
            </DialogHeader>

            {/* Reservation Banner */}
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center gap-3">
              <Lock className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 text-sm">
                <p className="text-foreground font-medium">5-minute reservation active</p>
                <p className="text-muted-foreground text-xs">Complete your mint before time runs out.</p>
              </div>
              <div className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-lg border border-border">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className={`font-mono font-bold text-sm ${timeLeft < 60 ? "text-destructive" : "text-foreground"}`}>
                  {formatTimeLeft()}
                </span>
              </div>
            </div>

            {/* Audio Source (locked) */}
            <div className="bg-secondary/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Audio Source (locked)</p>
              <p className="text-sm text-foreground font-medium truncate">{sound.title}</p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label className="text-foreground text-sm">Token Name</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value.slice(0, 32))}
                  placeholder="Sound name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-foreground text-sm">Ticker (max 6 chars)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    value={ticker}
                    onChange={e => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                    placeholder="TICKER"
                    className="pl-7"
                  />
                </div>
              </div>

              <div>
                <Label className="text-foreground text-sm">Description</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 resize-none"
                />
              </div>
            </div>

            <Button
              onClick={handleMint}
              disabled={isMinting || timeLeft <= 0}
              className="w-full font-bold"
              size="lg"
            >
              {isMinting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Minting on Solana...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Mint Token — 0.02 SOL
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
