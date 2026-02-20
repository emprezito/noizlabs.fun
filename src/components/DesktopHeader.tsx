import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronDown, Copy, LogOut, Droplets, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { supabase } from "@/integrations/supabase/client";
import { WalletIdenticon } from "./WalletIdenticon";
import { NotificationBell } from "./NotificationBell";
import CustomWalletModal from "./CustomWalletModal";
import { clearMobileWalletCache } from "./WalletButton";

export function DesktopHeader() {
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { price: solPrice, loading: priceLoading } = useSolPrice();
  const { balance, loading: balanceLoading, refetch: refetchBalance } = useWalletBalance();
  const [modalOpen, setModalOpen] = useState(false);
  const [requestingAirdrop, setRequestingAirdrop] = useState(false);

  const truncatedAddress = useMemo(() => {
    if (!publicKey) return null;
    const addr = publicKey.toBase58();
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  }, [publicKey]);

  const usdValue = useMemo(() => {
    if (balance == null || solPrice == null) return null;
    return (balance * solPrice).toFixed(2);
  }, [balance, solPrice]);

  const handleCopy = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      toast.success("Address copied");
    }
  };

  const handleDisconnect = () => {
    clearMobileWalletCache();
    disconnect();
    toast.success("Wallet disconnected");
  };

  const requestAirdrop = async () => {
    if (!publicKey) return;
    setRequestingAirdrop(true);
    try {
      const { data, error } = await supabase.functions.invoke("devnet-faucet", {
        body: { walletAddress: publicKey.toBase58() },
      });
      if (data?.rateLimited) {
        const min = typeof data.minutesRemaining === "number" ? data.minutesRemaining : null;
        toast.error(min != null ? `Wait ${min} min before requesting again` : "Rate limited.");
        return;
      }
      if (error) { toast.error("Faucet failed."); return; }
      toast.success(`Received ${data?.amount ?? 0.5} SOL! (Devnet)`);
      setTimeout(() => refetchBalance(), 2000);
    } catch {
      toast.error("Faucet request failed.");
    } finally {
      setRequestingAirdrop(false);
    }
  };

  return (
    <header className="hidden md:flex items-center justify-between h-[68px] px-6 sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl">
      {/* LEFT: Logo */}
      <Link to="/" className="flex items-center gap-2.5">
        <span className="text-2xl">🎵</span>
        <span
          className="text-lg font-bold tracking-tight"
          style={{
            background: "linear-gradient(135deg, hsl(252 76% 61%), hsl(250 80% 75%))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          NoizLabs
        </span>
      </Link>

      {/* CENTER: Testnet pill */}
      <div className="flex items-center">
        <div className="px-3 py-1 rounded-full border border-border/60 bg-muted/40 text-[11px] font-medium text-muted-foreground tracking-wide">
          Now Live on Solana Testnet
        </div>
      </div>

      {/* RIGHT: Notifications + Wallet */}
      <div className="flex items-center gap-3">
        <NotificationBell />

        {connecting && (
          <Button disabled className="h-10 px-5 gap-2 cursor-wait">
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting…
          </Button>
        )}

        {!connecting && !connected && (
          <>
            <Button
              onClick={() => setModalOpen(true)}
              className="h-10 px-5 gap-2"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </Button>
            <CustomWalletModal open={modalOpen} onOpenChange={setModalOpen} />
          </>
        )}

        {!connecting && connected && publicKey && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 h-10 pl-1.5 pr-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer select-none">
                <WalletIdenticon address={publicKey.toBase58()} size={32} />
                <span className="text-sm font-medium text-foreground">
                  {truncatedAddress}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 p-0 z-50 bg-popover border border-border rounded-xl overflow-hidden"
            >
              {/* Balance section */}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <WalletIdenticon address={publicKey.toBase58()} size={40} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{truncatedAddress}</p>
                    <button
                      onClick={handleCopy}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy address
                    </button>
                  </div>
                </div>

                <div className="mt-3 p-3 rounded-lg bg-muted/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">SOL Balance</span>
                    <span className="text-sm font-semibold text-foreground">
                      {balanceLoading ? "…" : `${balance?.toFixed(4) ?? "0"} SOL`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">USD Value</span>
                    <span className="text-sm text-foreground">
                      {balanceLoading || priceLoading ? "…" : `$${usdValue ?? "0.00"}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">SOL Price</span>
                    <span className="text-sm text-foreground">
                      {priceLoading ? "…" : `$${solPrice?.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator className="m-0" />

              <div className="p-2">
                <DropdownMenuItem
                  onClick={requestAirdrop}
                  disabled={requestingAirdrop}
                  className="gap-2 cursor-pointer rounded-lg"
                >
                  {requestingAirdrop ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Droplets className="w-4 h-4" />
                  )}
                  Get Devnet SOL
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleDisconnect}
                  className="gap-2 cursor-pointer rounded-lg text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

export default DesktopHeader;
