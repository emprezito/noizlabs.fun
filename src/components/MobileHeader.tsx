import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Menu,
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
  GraduationCap,
  ChevronDown,
  Copy,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "./NotificationBell";
import { WalletIdenticon } from "./WalletIdenticon";
import CustomWalletModal from "./CustomWalletModal";
import { clearMobileWalletCache } from "./WalletButton";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Explore", href: "/explore", icon: Compass },
  { name: "Create", href: "/create", icon: PlusCircle },
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Trade", href: "/trade", icon: ArrowLeftRight },
  { name: "Graduated", href: "/graduated", icon: GraduationCap },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { name: "Profile", href: "/profile", icon: User },
];

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requestingAirdrop, setRequestingAirdrop] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const location = useLocation();
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { price: solPrice, loading: priceLoading } = useSolPrice();
  const { balance, loading: balanceLoading, refetch: refetchBalance } = useWalletBalance();

  const truncatedAddress = useMemo(() => {
    if (!publicKey) return null;
    const addr = publicKey.toBase58();
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  }, [publicKey]);

  const usdValue = useMemo(() => {
    if (balance == null || solPrice == null) return null;
    return (balance * solPrice).toFixed(2);
  }, [balance, solPrice]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!publicKey) { setIsAdmin(false); return; }
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
    <div className="md:hidden">
      <div className="flex items-center justify-between h-16 px-3 sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        {/* Left: Hamburger + Logo icon */}
        <div className="flex items-center gap-1.5">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-popover border-border">
              <div className="flex flex-col h-full">
                <div className="flex items-center p-4 border-b border-border">
                  <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                    <span className="text-2xl">🎵</span>
                    <span className="text-lg font-bold text-primary">NoizLabs</span>
                  </Link>
                </div>
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
                      <Link to="/admin" onClick={() => setOpen(false)} className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors", isActive("/admin") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                        <Shield className="w-5 h-5" /><span>Admin</span>
                      </Link>
                      <Link to="/analytics" onClick={() => setOpen(false)} className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors", isActive("/analytics") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                        <BarChart3 className="w-5 h-5" /><span>Analytics</span>
                      </Link>
                    </>
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/">
            <span className="text-xl">🎵</span>
          </Link>
        </div>

        {/* Right: Wallet + Notification */}
        <div className="flex items-center gap-1.5">
          {connecting && (
            <Button disabled size="sm" className="h-9 px-3 gap-1.5 cursor-wait">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Connecting…</span>
            </Button>
          )}

          {!connecting && !connected && (
            <>
              <Button onClick={() => setWalletModalOpen(true)} size="sm" className="h-9 px-3 gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                <span className="text-xs">Connect Wallet</span>
              </Button>
              <CustomWalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
            </>
          )}

          {!connecting && connected && publicKey && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 h-9 pl-1 pr-2 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer select-none">
                    <WalletIdenticon address={publicKey.toBase58()} size={28} />
                    <span className="text-xs font-medium text-foreground">{truncatedAddress}</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-60 p-0 z-[60] bg-popover border border-border rounded-xl overflow-hidden"
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <WalletIdenticon address={publicKey.toBase58()} size={36} />
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

                    <div className="mt-2 p-2.5 rounded-lg bg-muted/40 space-y-1.5">
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

                  <div className="p-1.5">
                    <DropdownMenuItem onClick={requestAirdrop} disabled={requestingAirdrop} className="gap-2 cursor-pointer rounded-lg text-sm">
                      {requestingAirdrop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Droplets className="w-4 h-4" />}
                      Get Devnet SOL
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDisconnect} className="gap-2 cursor-pointer rounded-lg text-sm text-destructive focus:text-destructive">
                      <LogOut className="w-4 h-4" />
                      Disconnect
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <NotificationBell />
        </div>
      </div>
    </div>
  );
}

export default MobileHeader;
