import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet, Copy, LogOut, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import CustomWalletModal from "./CustomWalletModal";

export const clearMobileWalletCache = () => {
  try {
    window.localStorage.removeItem("walletName");
  } catch {
    // ignore
  }
};

export const WalletButton = () => {
  const { publicKey, wallet, disconnect, connecting } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);

  const truncatedAddress = useMemo(() => {
    if (!publicKey) return null;
    const address = publicKey.toBase58();
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }, [publicKey]);

  const handleCopyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      toast.success("Address copied to clipboard");
    }
  };

  const handleDisconnect = () => {
    clearMobileWalletCache();
    disconnect();
    toast.success("Wallet disconnected");
  };

  // Show loading overlay when connecting (especially useful on mobile)
  if (connecting) {
    return (
      <>
        {/* Full-screen loading overlay for mobile */}
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999] flex items-center justify-center md:hidden">
          <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-card border border-border shadow-xl">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-semibold text-foreground">Connecting Wallet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please confirm in your wallet app
              </p>
            </div>
          </div>
        </div>
        
        {/* Desktop/inline button shows loading state */}
        <Button
          disabled
          className="min-h-[48px] px-6 gap-2 relative z-10 cursor-wait"
          size="lg"
        >
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Connecting...</span>
        </Button>
      </>
    );
  }

  if (!publicKey) {
    return (
      <>
        <Button
          onClick={() => setModalOpen(true)}
          className="min-h-[48px] px-6 gap-2 relative z-10 cursor-pointer select-none"
          size="lg"
          type="button"
        >
          <Wallet className="w-5 h-5 pointer-events-none" />
          <span className="pointer-events-none">Connect Wallet</span>
        </Button>
        <CustomWalletModal open={modalOpen} onOpenChange={setModalOpen} />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="min-h-[48px] px-4 gap-2 relative z-10 cursor-pointer select-none" 
          size="lg"
          type="button"
        >
          {wallet?.adapter.icon && (
            <img
              src={wallet.adapter.icon}
              alt={wallet.adapter.name}
              className="w-5 h-5 pointer-events-none"
            />
          )}
          <span className="pointer-events-none">{truncatedAddress}</span>
          <ChevronDown className="w-4 h-4 opacity-50 pointer-events-none" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 z-50 bg-popover border border-border">
        <DropdownMenuItem onClick={handleCopyAddress} className="gap-2 cursor-pointer">
          <Copy className="w-4 h-4" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDisconnect}
          className="gap-2 cursor-pointer text-destructive"
        >
          <LogOut className="w-4 h-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WalletButton;
