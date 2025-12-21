import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Wallet, RefreshCw, Trash2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";

const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

export const clearMobileWalletCache = () => {
  try {
    window.localStorage.removeItem("mwa_authorization");
    window.localStorage.removeItem("walletName");
  } catch {
    // ignore
  }
};

export const WalletButton = () => {
  const { connected, publicKey, wallet, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [helpOpen, setHelpOpen] = useState(false);
  const isMobile = useMemo(() => isMobileDevice(), []);

  const label = useMemo(() => {
    if (connected && publicKey) {
      const key = publicKey.toString();
      return `${key.slice(0, 4)}...${key.slice(-4)}`;
    }
    return wallet ? "Approve in wallet" : "Connect Wallet";
  }, [connected, publicKey, wallet]);

  const handleRetry = () => {
    disconnect();
    setTimeout(() => setVisible(true), 100);
  };

  const handleClearCache = () => {
    clearMobileWalletCache();
    disconnect();
    toast.success("Cache cleared. Try connecting again.");
    setTimeout(() => setVisible(true), 100);
  };

  return (
    <div className="wallet-button-wrapper space-y-2">
      <WalletMultiButton>
        <span className="flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          {label}
        </span>
      </WalletMultiButton>

      {/* Mobile helper panel - only show when not connected on mobile */}
      {isMobile && !connected && (
        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
            >
              <HelpCircle className="w-3 h-3 mr-1" />
              Having trouble connecting?
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-xs text-muted-foreground">
              Wallets open in native apps. After approving, you'll be redirected back.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="flex-1 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                className="flex-1 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear Cache
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default WalletButton;
