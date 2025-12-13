import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowDown, Loader2 } from "lucide-react";

interface TradeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  tradeType: "buy" | "sell";
  inputAmount: string;
  inputSymbol: string;
  outputAmount: string;
  outputSymbol: string;
  priceImpact: number;
  platformFee: number;
  currentPrice: number;
}

export function TradeConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  tradeType,
  inputAmount,
  inputSymbol,
  outputAmount,
  outputSymbol,
  priceImpact,
  platformFee,
  currentPrice,
}: TradeConfirmDialogProps) {
  const isPriceImpactHigh = priceImpact > 5;
  const isPriceImpactVeryHigh = priceImpact > 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tradeType === "buy" ? "Confirm Purchase" : "Confirm Sale"}
          </DialogTitle>
          <DialogDescription>
            Review the details of your trade before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trade Summary */}
          <div className="bg-muted rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">You pay</span>
              <span className="font-bold text-lg">
                {inputAmount} {inputSymbol}
              </span>
            </div>
            
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
                <ArrowDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">You receive</span>
              <span className="font-bold text-lg text-primary">
                {outputAmount} {outputSymbol}
              </span>
            </div>
          </div>

          {/* Trade Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Price</span>
              <span>{currentPrice.toFixed(8)} SOL per token</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Fee (0.25%)</span>
              <span>{platformFee.toFixed(6)} SOL</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Price Impact</span>
              <span className={`font-medium ${
                isPriceImpactVeryHigh 
                  ? "text-destructive" 
                  : isPriceImpactHigh 
                    ? "text-yellow-500" 
                    : "text-green-500"
              }`}>
                {priceImpact.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Warning for high price impact */}
          {isPriceImpactHigh && (
            <div className={`flex items-start gap-3 p-3 rounded-lg ${
              isPriceImpactVeryHigh 
                ? "bg-destructive/10 border border-destructive/30" 
                : "bg-yellow-500/10 border border-yellow-500/30"
            }`}>
              <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                isPriceImpactVeryHigh ? "text-destructive" : "text-yellow-500"
              }`} />
              <div className="text-sm">
                <p className="font-medium">
                  {isPriceImpactVeryHigh ? "Very High Price Impact" : "High Price Impact"}
                </p>
                <p className="text-muted-foreground">
                  {isPriceImpactVeryHigh 
                    ? "This trade has a very high price impact. Consider trading a smaller amount."
                    : "This trade will significantly move the price."
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={tradeType === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Confirm ${tradeType === "buy" ? "Purchase" : "Sale"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
