import { useState, useRef, useEffect } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import noizlabsLogo from "@/assets/noizlabs-logo.png";

export interface TokenEarningsData {
  tokenName: string;
  tokenSymbol: string;
  currentMarketCap: number;
  allTimeMarketCap: number;
  totalVolume: number;
  creatorFeesEarned: number;
  username?: string;
  walletAddress: string;
}

interface CreatorEarningsCardProps {
  tokenData: TokenEarningsData;
  solPrice: number;
}

type TimePeriod = "1h" | "24h" | "1w" | "all";

const shortenAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const formatUSD = (value: number): string => {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const getPeriodLabel = (period: TimePeriod): string => {
  switch (period) {
    case "1h": return "Last 1 Hour";
    case "24h": return "Last 24 Hours";
    case "1w": return "Last 7 Days";
    case "all": return "All Time";
  }
};

export const CreatorEarningsCard = ({ tokenData, solPrice }: CreatorEarningsCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [period, setPeriod] = useState<TimePeriod>("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const logoRef = useRef<HTMLImageElement | null>(null);

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

  // Generate preview when period changes or logo loads
  useEffect(() => {
    if (logoLoaded) {
      generateImage(true);
    }
  }, [period, logoLoaded, tokenData]);

  const generateImage = async (isPreview = false) => {
    if (!canvasRef.current || !logoRef.current) return;
    
    if (!isPreview) setIsGenerating(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size (social-media friendly aspect ratio)
    canvas.width = 1200;
    canvas.height = 630;

    // Background gradient (dark theme matching NoizLabs)
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#0a0a0f");
    gradient.addColorStop(0.5, "#0d0d15");
    gradient.addColorStop(1, "#0a0a0f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add subtle grid pattern
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

    // Decorative gradient orbs
    const orb1 = ctx.createRadialGradient(200, 200, 0, 200, 200, 300);
    orb1.addColorStop(0, "rgba(59, 130, 246, 0.15)");
    orb1.addColorStop(1, "transparent");
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, 500, 500);

    const orb2 = ctx.createRadialGradient(1000, 400, 0, 1000, 400, 350);
    orb2.addColorStop(0, "rgba(139, 92, 246, 0.12)");
    orb2.addColorStop(1, "transparent");
    ctx.fillStyle = orb2;
    ctx.fillRect(700, 100, 500, 500);

    // Draw logo
    const logoSize = 80;
    ctx.drawImage(logoRef.current, 50, 40, logoSize, logoSize);

    // NoizLabs text next to logo
    ctx.font = "bold 28px Inter, system-ui, sans-serif";
    const logoGradient = ctx.createLinearGradient(140, 60, 280, 100);
    logoGradient.addColorStop(0, "#3b82f6");
    logoGradient.addColorStop(1, "#a855f7");
    ctx.fillStyle = logoGradient;
    ctx.fillText("NOIZLABS", 145, 90);

    // Period badge
    ctx.font = "600 14px Inter, system-ui, sans-serif";
    const periodText = getPeriodLabel(period);
    const periodWidth = ctx.measureText(periodText).width + 24;
    ctx.fillStyle = "rgba(139, 92, 246, 0.2)";
    ctx.beginPath();
    ctx.roundRect(canvas.width - periodWidth - 50, 50, periodWidth, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#a855f7";
    ctx.fillText(periodText, canvas.width - periodWidth - 38, 72);

    // Main title
    ctx.font = "bold 48px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Creator Earnings Report", 50, 180);

    // Token info section
    ctx.font = "600 32px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`${tokenData.tokenName}`, 50, 240);
    
    ctx.font = "500 24px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`$${tokenData.tokenSymbol}`, 50 + ctx.measureText(tokenData.tokenName).width + 15, 240);

    // Creator info
    const displayName = tokenData.username || shortenAddress(tokenData.walletAddress);
    ctx.font = "500 18px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`Created by: ${displayName} (${shortenAddress(tokenData.walletAddress)})`, 50, 280);

    // Stats grid - Row 1
    const statsY = 340;
    const statWidth = 270;
    const statGap = 30;

    const stats = [
      { label: "Current Market Cap", value: formatUSD(tokenData.currentMarketCap * solPrice) },
      { label: "All-Time Market Cap", value: formatUSD(tokenData.allTimeMarketCap * solPrice) },
      { label: "Total Trading Volume", value: formatUSD(tokenData.totalVolume * solPrice) },
      { label: "Creator Fees Earned", value: formatUSD(tokenData.creatorFeesEarned * solPrice), highlight: true },
    ];

    stats.forEach((stat, index) => {
      const x = 50 + (index % 4) * (statWidth + statGap);
      const y = statsY;

      // Stat card background
      ctx.fillStyle = stat.highlight ? "rgba(34, 197, 94, 0.1)" : "rgba(30, 41, 59, 0.5)";
      ctx.beginPath();
      ctx.roundRect(x, y, statWidth, 130, 12);
      ctx.fill();

      // Border
      ctx.strokeStyle = stat.highlight ? "rgba(34, 197, 94, 0.3)" : "rgba(71, 85, 105, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Stat label
      ctx.font = "500 14px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(stat.label, x + 20, y + 35);

      // Stat value
      ctx.font = "bold 32px Inter, system-ui, sans-serif";
      ctx.fillStyle = stat.highlight ? "#22c55e" : "#ffffff";
      ctx.fillText(stat.value, x + 20, y + 85);
    });

    // Decorative sound wave line at bottom
    ctx.strokeStyle = "rgba(139, 92, 246, 0.3)";
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

    // Watermark
    ctx.font = "500 12px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#475569";
    ctx.textAlign = "right";
    ctx.fillText("Powered by NoizLabs", canvas.width - 50, canvas.height - 30);
    ctx.textAlign = "left";

    // Set preview
    setPreviewUrl(canvas.toDataURL("image/png"));
    
    if (!isPreview) setIsGenerating(false);
  };

  const downloadImage = async () => {
    await generateImage(false);
    
    if (!canvasRef.current) return;
    
    const link = document.createElement("a");
    link.download = `noizlabs-earnings-${tokenData.tokenSymbol}-${period}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Earnings Certificate</CardTitle>
            <CardDescription>Download your creator earnings report</CardDescription>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as TimePeriod)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1 Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="1w">Last 7 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="relative aspect-[1200/630] w-full bg-muted/20 rounded-lg overflow-hidden border border-border">
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Earnings preview" 
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
              Download Earnings Image
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CreatorEarningsCard;
