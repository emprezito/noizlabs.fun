import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Play, 
  Pause, 
  ArrowRightLeft,
  Calendar,
  Target,
  Flame
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TokenHoldingCardProps {
  holding: {
    mint_address: string;
    name: string;
    symbol: string;
    balance: number;
    price: number;
    value: number;
    pnl: number;
    pnlPercent: number;
    audioUrl?: string;
    imageUrl?: string;
    costBasis?: number;
  };
  walletAddress: string;
  solUsdPrice: number | null;
  playingAudio: string | null;
  onToggleAudio: (mintAddress: string, audioUrl?: string) => void;
}

interface TradeInfo {
  firstBuyDate: Date | null;
  avgBuyPrice: number;
  totalBought: number;
  athPrice: number;
  athPercent: number;
}

export const TokenHoldingCard = ({
  holding,
  walletAddress,
  solUsdPrice,
  playingAudio,
  onToggleAudio,
}: TokenHoldingCardProps) => {
  const navigate = useNavigate();
  const [tradeInfo, setTradeInfo] = useState<TradeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTradeInfo = async () => {
      if (!walletAddress) return;

      try {
        // Get user's trade history for this token
        const { data: trades } = await supabase
          .from("trade_history")
          .select("trade_type, amount, price_lamports, created_at")
          .eq("wallet_address", walletAddress)
          .eq("mint_address", holding.mint_address)
          .order("created_at", { ascending: true });

        if (!trades || trades.length === 0) {
          setLoading(false);
          return;
        }

        // Find first buy date
        const firstBuy = trades.find(t => t.trade_type === "buy");
        const firstBuyDate = firstBuy ? new Date(firstBuy.created_at) : null;

        // Calculate average buy price and total bought
        let totalSolSpent = 0;
        let totalTokensBought = 0;

        trades.forEach((trade) => {
          if (trade.trade_type === "buy") {
            totalSolSpent += Number(trade.price_lamports) / 1e9;
            totalTokensBought += Number(trade.amount) / 1e9;
          }
        });

        const avgBuyPrice = totalTokensBought > 0 ? totalSolSpent / totalTokensBought : 0;

        // Fetch ATH from trade history (highest price per token)
        const { data: allTrades } = await supabase
          .from("trade_history")
          .select("price_lamports, amount")
          .eq("mint_address", holding.mint_address)
          .gt("amount", 0);

        let athPrice = 0;
        allTrades?.forEach((trade) => {
          const pricePerToken = (Number(trade.price_lamports) / 1e9) / (Number(trade.amount) / 1e9);
          if (pricePerToken > athPrice) {
            athPrice = pricePerToken;
          }
        });

        // Calculate ATH percentage from current price
        const athPercent = holding.price > 0 && athPrice > 0 
          ? ((athPrice - holding.price) / holding.price) * 100 
          : 0;

        setTradeInfo({
          firstBuyDate,
          avgBuyPrice,
          totalBought: totalTokensBought,
          athPrice,
          athPercent,
        });
      } catch (error) {
        console.error("Error fetching trade info:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTradeInfo();
  }, [holding.mint_address, walletAddress, holding.price]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPrice = (price: number) => {
    if (price < 0.000001) return price.toExponential(2);
    if (price < 0.01) return price.toFixed(8);
    return price.toFixed(6);
  };

  // Calculate X multiplier from average buy price
  const xMultiplier = tradeInfo?.avgBuyPrice && tradeInfo.avgBuyPrice > 0
    ? holding.price / tradeInfo.avgBuyPrice
    : 1;

  // USD values
  const currentValueUsd = solUsdPrice ? holding.value * solUsdPrice : null;
  const pnlUsd = solUsdPrice ? holding.pnl * solUsdPrice : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Main Row */}
        <div className="flex items-center gap-4 p-4">
          {/* Token Image */}
          <div className="relative flex-shrink-0">
            {holding.imageUrl ? (
              <img
                src={holding.imageUrl}
                alt={holding.name}
                className="w-14 h-14 rounded-lg object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-xl">🎵</span>
              </div>
            )}
            <button
              onClick={() => onToggleAudio(holding.mint_address, holding.audioUrl)}
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 hover:opacity-100 transition-opacity"
            >
              {playingAudio === holding.mint_address ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
          </div>

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{holding.name}</span>
              <span className="text-xs text-muted-foreground">${holding.symbol}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {holding.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens
            </div>
          </div>

          {/* Value & Trade Button */}
          <div className="text-right flex-shrink-0">
            <p className="font-semibold">{holding.value.toFixed(4)} SOL</p>
            {currentValueUsd && (
              <p className="text-xs text-muted-foreground">
                ${currentValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/trade?mint=${holding.mint_address}`)}
            className="flex-shrink-0"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* PnL & Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-4 pt-2 border-t border-border/50 bg-muted/30">
          {/* P&L Card */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">P&L</p>
            <div className={`flex items-center gap-1 ${holding.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
              {holding.pnl >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="font-semibold">
                {holding.pnl >= 0 ? "+" : ""}{holding.pnlPercent.toFixed(1)}%
              </span>
            </div>
            {pnlUsd && (
              <p className={`text-xs ${holding.pnl >= 0 ? "text-green-500/80" : "text-red-500/80"}`}>
                {holding.pnl >= 0 ? "+" : ""}${Math.abs(pnlUsd).toFixed(2)}
              </p>
            )}
          </div>

          {/* X Multiplier */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Flame className="w-3 h-3" />
              Multiplier
            </p>
            <p className={`font-semibold ${xMultiplier >= 1 ? "text-green-500" : "text-red-500"}`}>
              {xMultiplier >= 1 ? "+" : ""}{xMultiplier.toFixed(2)}x
            </p>
            {tradeInfo?.avgBuyPrice && tradeInfo.avgBuyPrice > 0 && (
              <p className="text-xs text-muted-foreground">
                Avg: {formatPrice(tradeInfo.avgBuyPrice)}
              </p>
            )}
          </div>

          {/* First Buy Date */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              First Bought
            </p>
            <p className="font-medium text-sm">
              {tradeInfo?.firstBuyDate ? formatDate(tradeInfo.firstBuyDate) : "-"}
            </p>
          </div>

          {/* Token Price & ATH */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Target className="w-3 h-3" />
              Price / ATH
            </p>
            <p className="font-medium text-sm">
              {formatPrice(holding.price)} SOL
            </p>
            {tradeInfo?.athPrice && tradeInfo.athPrice > holding.price && (
              <p className="text-xs text-yellow-500">
                ATH: {formatPrice(tradeInfo.athPrice)} (+{tradeInfo.athPercent.toFixed(0)}%)
              </p>
            )}
            {tradeInfo?.athPrice && tradeInfo.athPrice <= holding.price && (
              <p className="text-xs text-green-500">
                🔥 At ATH!
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
