import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useWallet, Wallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, ExternalLink, Smartphone, Monitor } from "lucide-react";
import { toast } from "sonner";

interface CustomWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Detect if we're on a mobile device
const isMobile = () => {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

// Generate deep link URLs for mobile wallets
const getWalletDeepLink = (walletName: string, returnUrl: string): string | null => {
  const encodedUrl = encodeURIComponent(returnUrl);
  
  switch (walletName.toLowerCase()) {
    case "phantom":
      // Phantom universal link format
      return `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedUrl}`;
    case "solflare":
      // Solflare deep link format
      return `https://solflare.com/ul/v1/browse/${encodedUrl}?ref=${encodedUrl}`;
    default:
      return null;
  }
};

export const CustomWalletModal: FC<CustomWalletModalProps> = ({ open, onOpenChange }) => {
  const { wallets, select, connect, publicKey, connecting, connected, wallet } = useWallet();
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const mobile = useMemo(() => isMobile(), []);
  
  // Get the current page URL for return after mobile wallet auth
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  // Filter wallets to show installed ones first, then loadable ones
  const availableWallets = useMemo(() => {
    return wallets.filter((w) => 
      w.readyState === WalletReadyState.Installed || 
      w.readyState === WalletReadyState.Loadable
    );
  }, [wallets]);

  // Separate mobile adapter from regular wallets
  const mobileAdapter = useMemo(() => {
    return wallets.find((w) => w.adapter.name === "Mobile Wallet Adapter");
  }, [wallets]);

  const regularWallets = useMemo(() => {
    return availableWallets.filter((w) => w.adapter.name !== "Mobile Wallet Adapter");
  }, [availableWallets]);

  // Show success screen when connected
  useEffect(() => {
    if (connected && publicKey && open) {
      setShowSuccess(true);
      setIsConnecting(false);
      
      // Auto-close after showing success
      const timer = setTimeout(() => {
        setShowSuccess(false);
        onOpenChange(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [connected, publicKey, open, onOpenChange]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setShowSuccess(false);
      setSelectedWallet(null);
      setIsConnecting(false);
    }
  }, [open]);

  const handleWalletSelect = useCallback(async (wallet: Wallet) => {
    const walletName = wallet.adapter.name;
    setSelectedWallet(walletName);
    setIsConnecting(true);

    try {
      // On mobile, try deep linking for Phantom/Solflare
      if (mobile && wallet.readyState !== WalletReadyState.Installed) {
        const deepLink = getWalletDeepLink(walletName, currentUrl);
        
        if (deepLink) {
          // Open the wallet app via deep link
          window.location.href = deepLink;
          return;
        }
      }

      // Select and connect the wallet
      select(wallet.adapter.name);
      
      // Give the adapter time to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      try {
        await connect();
      } catch (connectError: any) {
        // WalletNotReadyError is expected if the wallet isn't installed
        if (connectError.name === "WalletNotReadyError") {
          // Try deep linking as fallback
          const deepLink = getWalletDeepLink(walletName, currentUrl);
          if (deepLink) {
            toast.info(`Opening ${walletName}...`);
            window.location.href = deepLink;
            return;
          }
          toast.error(`${walletName} is not installed. Please install it first.`);
        } else {
          throw connectError;
        }
      }
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      toast.error(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
      setSelectedWallet(null);
    }
  }, [select, connect, mobile, currentUrl]);

  // Handle Mobile Wallet Adapter (for in-app browsers like Phantom/Solflare browser)
  const handleMobileAdapterConnect = useCallback(async () => {
    if (!mobileAdapter) return;
    
    setSelectedWallet("Mobile Wallet Adapter");
    setIsConnecting(true);

    try {
      select(mobileAdapter.adapter.name);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await connect();
    } catch (error: any) {
      console.error("Mobile adapter error:", error);
      toast.error("Failed to connect. Make sure you're in a wallet browser.");
    } finally {
      setIsConnecting(false);
      setSelectedWallet(null);
    }
  }, [mobileAdapter, select, connect]);

  // Success screen
  if (showSuccess && connected && publicKey) {
    const truncatedAddress = `${publicKey.toBase58().slice(0, 6)}...${publicKey.toBase58().slice(-4)}`;
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-foreground">Connected!</h3>
              <p className="text-sm text-muted-foreground mt-1">{truncatedAddress}</p>
            </div>
            {wallet?.adapter.icon && (
              <img
                src={wallet.adapter.icon}
                alt={wallet.adapter.name}
                className="w-8 h-8"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Connect Wallet</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Show device type indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-4">
            {mobile ? (
              <>
                <Smartphone className="w-4 h-4" />
                <span>Mobile detected - tap to open wallet app</span>
              </>
            ) : (
              <>
                <Monitor className="w-4 h-4" />
                <span>Select your wallet</span>
              </>
            )}
          </div>

          {/* Mobile Wallet Adapter option (for in-app browsers) */}
          {mobile && mobileAdapter && (
            <Button
              variant="outline"
              className="w-full h-16 justify-start gap-4 px-4"
              onClick={handleMobileAdapterConnect}
              disabled={isConnecting}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">Already in Wallet App?</div>
                <div className="text-xs text-muted-foreground">
                  Use this if you're browsing in Phantom/Solflare
                </div>
              </div>
              {isConnecting && selectedWallet === "Mobile Wallet Adapter" && (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
            </Button>
          )}

          {/* Regular wallet options */}
          {regularWallets.map((wallet) => {
            const isSelected = selectedWallet === wallet.adapter.name;
            const isInstalled = wallet.readyState === WalletReadyState.Installed;
            
            return (
              <Button
                key={wallet.adapter.name}
                variant="outline"
                className="w-full h-16 justify-start gap-4 px-4"
                onClick={() => handleWalletSelect(wallet)}
                disabled={isConnecting}
              >
                {wallet.adapter.icon && (
                  <img
                    src={wallet.adapter.icon}
                    alt={wallet.adapter.name}
                    className="w-10 h-10 rounded-lg"
                  />
                )}
                <div className="flex-1 text-left">
                  <div className="font-medium">{wallet.adapter.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {isInstalled ? (
                      "Detected"
                    ) : mobile ? (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        Open in app
                      </span>
                    ) : (
                      "Not installed"
                    )}
                  </div>
                </div>
                {isConnecting && isSelected && (
                  <Loader2 className="w-5 h-5 animate-spin" />
                )}
              </Button>
            );
          })}

          {regularWallets.length === 0 && !mobileAdapter && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No wallets detected</p>
              <p className="text-sm mt-2">
                Please install{" "}
                <a 
                  href="https://phantom.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Phantom
                </a>{" "}
                or{" "}
                <a 
                  href="https://solflare.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Solflare
                </a>
              </p>
            </div>
          )}
        </div>

        {mobile && (
          <p className="text-xs text-center text-muted-foreground pb-2">
            After connecting, you'll be returned to this page automatically
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomWalletModal;
