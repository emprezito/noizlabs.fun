import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Menu,
  X,
  Compass,
  PlusCircle,
  Briefcase,
  ArrowLeftRight,
  Trophy,
  User,
  Shield,
  BarChart3,
  Droplets,
  Loader2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import WalletButton from "./WalletButton";
import { NotificationBell } from "./NotificationBell";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const navigation = [
  { name: "Explore", href: "/explore", icon: Compass },
  { name: "Create", href: "/create", icon: PlusCircle },
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Trade", href: "/trade", icon: ArrowLeftRight },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { name: "Profile", href: "/profile", icon: User },
];

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requestingAirdrop, setRequestingAirdrop] = useState(false);
  const location = useLocation();
  const { publicKey, connected } = useWallet();
  const { price: solPrice, loading: priceLoading } = useSolPrice();
  const { balance, loading: balanceLoading, refetch: refetchBalance } = useWalletBalance();

  useEffect(() => {
    const checkAdmin = async () => {
      if (!publicKey) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("admin_wallets")
        .select("id")
        .eq("wallet_address", publicKey.toBase58())
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [publicKey]);

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const requestAirdrop = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    setRequestingAirdrop(true);
    try {
      const { data, error } = await supabase.functions.invoke("devnet-faucet", {
        body: { walletAddress: publicKey.toBase58() },
      });

      if (data?.rateLimited) {
        const minutes = typeof data.minutesRemaining === "number" ? data.minutesRemaining : null;
        if (minutes != null) {
          toast.error(`Please wait ${minutes} minute${minutes > 1 ? "s" : ""} before requesting again`);
          return;
        }
        toast.error("Rate limited. Please try again later.");
        return;
      }

      if (error) {
        toast.error("Faucet request failed. Try again later.");
        return;
      }

      const receivedAmount = data?.amount ?? 0.5;
      toast.success(`Received ${receivedAmount} SOL! (Devnet)`);
      setTimeout(() => refetchBalance(), 2000);
    } catch (error: any) {
      console.error("Faucet error:", error);
      toast.error("Faucet request failed. Try again later.");
    } finally {
      setRequestingAirdrop(false);
    }
  };

  return (
    <div className="md:hidden">
      {/* Top bar with wallet info */}
      <div className="flex items-center justify-between px-3 py-2 bg-background border-b border-border">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                    <span className="text-2xl">🎵</span>
                    <span className="text-lg font-bold text-primary">NoizLabs</span>
                  </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                        isActive(item.href)
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </Link>
                  ))}

                  {isAdmin && (
                    <>
                      <Link
                        to="/admin"
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                          isActive("/admin")
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <Shield className="w-5 h-5" />
                        <span>Admin</span>
                      </Link>
                      <Link
                        to="/analytics"
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                          isActive("/analytics")
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <BarChart3 className="w-5 h-5" />
                        <span>Analytics</span>
                      </Link>
                    </>
                  )}
                </nav>

                {/* Wallet Section in Drawer */}
                <div className="p-3 border-t border-border space-y-3">
                  {connected && (
                    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Balance</span>
                        <span className="font-medium">
                          {balanceLoading ? "..." : `${balance?.toFixed(3) ?? "0"} SOL`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">SOL Price</span>
                        <span className="font-medium">
                          {priceLoading ? "..." : `$${solPrice?.toFixed(2)}`}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={requestAirdrop}
                        disabled={requestingAirdrop}
                        className="w-full"
                      >
                        {requestingAirdrop ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Droplets className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Get Devnet SOL
                      </Button>
                    </div>
                  )}
                  <WalletButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-1.5">
            <span className="text-xl">🎵</span>
            <span className="font-bold text-primary">NoizLabs</span>
          </Link>
        </div>

        {/* Right: Wallet info + Connect */}
        <div className="flex items-center gap-2">
          {connected && (
            <div className="flex items-center gap-2 text-xs">
              <div className="flex flex-col items-end">
                <span className="font-medium text-foreground">
                  {balanceLoading ? "..." : `${balance?.toFixed(2) ?? "0"} SOL`}
                </span>
                <span className="text-muted-foreground">
                  {priceLoading ? "" : `$${solPrice?.toFixed(0)}`}
                </span>
              </div>
            </div>
          )}
          <NotificationBell />
          <WalletButton />
        </div>
      </div>
    </div>
  );
}

export default MobileHeader;