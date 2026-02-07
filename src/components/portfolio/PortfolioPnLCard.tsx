import { useState, useRef, useEffect } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import noizlabsLogo from "@/assets/noizlabs-logo.png";

export interface PortfolioPnLData {
  tokenName: string;
  tokenSymbol: string;
  tokenImage?: string;
  walletAddress: string;
  balance: number;
  currentPrice: number;
  currentValue: number;
  avgBuyPrice: number;
  pnlPercent: number;
  pnlUsd: number;
  xMultiplier: number;
  firstBuyDate: Date | null;
  athPrice: number;
  athPercent: number;
  isAtAth: boolean;
}

interface PortfolioPnLCardProps {
  data: PortfolioPnLData;
  solPrice: number;
}

const shortenAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const formatUSD = (value: number): string => {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
};

const formatPrice = (price: number): string => {
  if (price < 0.000001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(8);
  return price.toFixed(6);
};

export const PortfolioPnLCard = ({ data, solPrice }: PortfolioPnLCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [tokenImageLoaded, setTokenImageLoaded] = useState(false);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const tokenImageRef = useRef<HTMLImageElement | null>(null);
  const [open, setOpen] = useState(false);

  // Preload the logo
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      logoRef.current = img;
      setLogoLoaded(true);
    };
    img.src = noizlabsLogo;
  }, []);

  // Preload token image
  useEffect(() => {
    if (data.tokenImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        tokenImageRef.current = img;
        setTokenImageLoaded(true);
      };
      img.onerror = () => {
        setTokenImageLoaded(true); // Continue without image
      };
      img.src = data.tokenImage;
    } else {
      setTokenImageLoaded(true);
    }
  }, [data.tokenImage]);

  // Generate preview when ready
  useEffect(() => {
    if (logoLoaded && tokenImageLoaded && open) {
      generateImage(true);
    }
  }, [logoLoaded, tokenImageLoaded, data, open]);

  const generateImage = async (isPreview = false) => {
    if (!canvasRef.current || !logoRef.current) return;

    if (!isPreview) setIsGenerating(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1200;
    canvas.height = 630;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#0a0a0f");
    gradient.addColorStop(0.5, "#0d0d15");
    gradient.addColorStop(1, "#0a0a0f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid pattern
    ctx.strokeStyle = "rgba(139, 92, 246, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Decorative gradient orbs based on P&L
    const isProfit = data.pnlPercent >= 0;
    const orbColor = isProfit ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)";
    
    const orb1 = ctx.createRadialGradient(200, 200, 0, 200, 200, 300);
    orb1.addColorStop(0, orbColor);
    orb1.addColorStop(1, "transparent");
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, 500, 500);

    const orb2 = ctx.createRadialGradient(1000, 400, 0, 1000, 400, 350);
    orb2.addColorStop(0, "rgba(139, 92, 246, 0.12)");
    orb2.addColorStop(1, "transparent");
    ctx.fillStyle = orb2;
    ctx.fillRect(700, 100, 500, 500);

    // Draw NoizLabs logo
    const logoSize = 70;
    ctx.drawImage(logoRef.current, 50, 40, logoSize, logoSize);

    // NoizLabs text
    ctx.font = "bold 24px Inter, system-ui, sans-serif";
    const logoGradient = ctx.createLinearGradient(130, 60, 260, 100);
    logoGradient.addColorStop(0, "#3b82f6");
    logoGradient.addColorStop(1, "#a855f7");
    ctx.fillStyle = logoGradient;
    ctx.fillText("NOIZLABS", 130, 85);

    // P&L Badge (top right)
    const pnlBadgeText = `${isProfit ? "+" : ""}${data.pnlPercent.toFixed(1)}%`;
    ctx.font = "bold 24px Inter, system-ui, sans-serif";
    const badgeWidth = ctx.measureText(pnlBadgeText).width + 40;
    ctx.fillStyle = isProfit ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)";
    ctx.beginPath();
    ctx.roundRect(canvas.width - badgeWidth - 50, 45, badgeWidth, 45, 22);
    ctx.fill();
    ctx.strokeStyle = isProfit ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = isProfit ? "#22c55e" : "#ef4444";
    ctx.fillText(pnlBadgeText, canvas.width - badgeWidth - 30, 77);

    // Token image (if available)
    const tokenImgSize = 100;
    const tokenImgX = 50;
    const tokenImgY = 150;
    
    if (tokenImageRef.current) {
      // Clip to rounded rectangle
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(tokenImgX, tokenImgY, tokenImgSize, tokenImgSize, 16);
      ctx.clip();
      ctx.drawImage(tokenImageRef.current, tokenImgX, tokenImgY, tokenImgSize, tokenImgSize);
      ctx.restore();
      
      // Border
      ctx.strokeStyle = "rgba(139, 92, 246, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(tokenImgX, tokenImgY, tokenImgSize, tokenImgSize, 16);
      ctx.stroke();
    } else {
      // Placeholder
      ctx.fillStyle = "rgba(139, 92, 246, 0.2)";
      ctx.beginPath();
      ctx.roundRect(tokenImgX, tokenImgY, tokenImgSize, tokenImgSize, 16);
      ctx.fill();
      ctx.font = "40px sans-serif";
      ctx.fillStyle = "#a855f7";
      ctx.textAlign = "center";
      ctx.fillText("🎵", tokenImgX + tokenImgSize / 2, tokenImgY + tokenImgSize / 2 + 15);
      ctx.textAlign = "left";
    }

    // Token name and symbol
    ctx.font = "bold 42px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(data.tokenName, 170, 200);

    ctx.font = "500 24px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`$${data.tokenSymbol}`, 170, 240);

    // Wallet address
    ctx.font = "500 16px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`Wallet: ${shortenAddress(data.walletAddress)}`, 170, 270);

    // Stats grid
    const statsY = 320;
    const statWidth = 260;
    const statGap = 25;

    const stats = [
      { 
        label: "Current Value", 
        value: `${data.currentValue.toFixed(4)} SOL`,
        subValue: formatUSD(data.currentValue * solPrice),
      },
      { 
        label: "P&L", 
        value: `${isProfit ? "+" : ""}${formatUSD(data.pnlUsd)}`,
        highlight: true,
        isProfit,
      },
      { 
        label: "Multiplier", 
        value: `${data.xMultiplier >= 1 ? "+" : ""}${data.xMultiplier.toFixed(2)}x`,
        subValue: `Avg: ${formatPrice(data.avgBuyPrice)} SOL`,
        highlight: data.xMultiplier >= 2,
        isProfit: data.xMultiplier >= 1,
      },
      { 
        label: data.isAtAth ? "🔥 At ATH!" : "Price vs ATH",
        value: data.isAtAth ? formatPrice(data.currentPrice) + " SOL" : `+${data.athPercent.toFixed(0)}% to ATH`,
        subValue: data.isAtAth ? undefined : `ATH: ${formatPrice(data.athPrice)} SOL`,
        highlight: data.isAtAth,
        isProfit: data.isAtAth,
      },
    ];

    stats.forEach((stat, index) => {
      const x = 50 + (index % 4) * (statWidth + statGap);
      const y = statsY;

      // Stat card background
      let bgColor = "rgba(30, 41, 59, 0.5)";
      let borderColor = "rgba(71, 85, 105, 0.3)";
      
      if (stat.highlight && stat.isProfit) {
        bgColor = "rgba(34, 197, 94, 0.1)";
        borderColor = "rgba(34, 197, 94, 0.3)";
      } else if (stat.highlight && stat.isProfit === false) {
        bgColor = "rgba(239, 68, 68, 0.1)";
        borderColor = "rgba(239, 68, 68, 0.3)";
      }

      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(x, y, statWidth, 130, 12);
      ctx.fill();

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.font = "500 14px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(stat.label, x + 20, y + 35);

      // Value
      ctx.font = "bold 28px Inter, system-ui, sans-serif";
      if (stat.isProfit === true) {
        ctx.fillStyle = "#22c55e";
      } else if (stat.isProfit === false) {
        ctx.fillStyle = "#ef4444";
      } else {
        ctx.fillStyle = "#ffffff";
      }
      ctx.fillText(stat.value, x + 20, y + 75);

      // Sub value
      if (stat.subValue) {
        ctx.font = "500 14px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText(stat.subValue, x + 20, y + 105);
      }
    });

    // First buy date & Holdings
    ctx.font = "500 16px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    const dateText = data.firstBuyDate 
      ? `First bought: ${data.firstBuyDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : "";
    const holdingsText = `Holdings: ${data.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens`;
    ctx.fillText(`${dateText}  •  ${holdingsText}`, 50, 490);

    // Sound wave decoration
    ctx.strokeStyle = isProfit ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < canvas.width; i += 5) {
      const amplitude = 15 + Math.sin(i * 0.02) * 10;
      const y = canvas.height - 60 + Math.sin(i * 0.05) * amplitude;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();

    // Footer
    ctx.font = "500 14px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`Generated on ${new Date().toLocaleDateString()} • noizlabs.fun`, 50, canvas.height - 30);

    ctx.textAlign = "right";
    ctx.fillStyle = "#475569";
    ctx.fillText("Portfolio • Powered by NoizLabs", canvas.width - 50, canvas.height - 30);
    ctx.textAlign = "left";

    setPreviewUrl(canvas.toDataURL("image/png"));
    if (!isPreview) setIsGenerating(false);
  };

  const downloadImage = async () => {
    await generateImage(false);

    if (!canvasRef.current) return;

    const link = document.createElement("a");
    link.download = `noizlabs-pnl-${data.tokenSymbol}-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
          <Download className="w-3.5 h-3.5" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Download P&L Card</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="relative aspect-[1200/630] w-full bg-muted/20 rounded-lg overflow-hidden border border-border">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="P&L preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Hidden canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Download button */}
          <Button
            onClick={downloadImage}
            disabled={isGenerating || !logoLoaded}
            className="w-full gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download P&L Card
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PortfolioPnLCard;
