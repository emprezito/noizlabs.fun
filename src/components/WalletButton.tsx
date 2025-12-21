import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, Copy, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const clearMobileWalletCache = () => {
  try {
    window.localStorage.removeItem("walletName");
  } catch {
    // ignore
  }
};

export const WalletButton = () => {
  const { publicKey, wallet, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

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

  if (!publicKey) {
    return (
      <Button
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="min-h-[48px] px-6 gap-2"
        size="lg"
      >
        <Wallet className="w-5 h-5" />
        {connecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-h-[48px] px-4 gap-2" size="lg">
          {wallet?.adapter.icon && (
            <img
              src={wallet.adapter.icon}
              alt={wallet.adapter.name}
              className="w-5 h-5"
            />
          )}
          <span>{truncatedAddress}</span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
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
