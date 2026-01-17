import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import WalletButton from "./WalletButton";
import { NotificationBell } from "./NotificationBell";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSidebarState } from "./SidebarContext";

const navigation = [
  { name: "Explore", href: "/explore", icon: Compass },
  { name: "Create", href: "/create", icon: PlusCircle },
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Trade", href: "/trade", icon: ArrowLeftRight },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { name: "Profile", href: "/profile", icon: User },
];

export function AppSidebar() {
  const { collapsed, toggleCollapsed } = useSidebarState();
  const [requestingAirdrop, setRequestingAirdrop] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const { price, loading } = useSolPrice();
  const { publicKey, connected } = useWallet();
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

  const requestAirdrop = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    setRequestingAirdrop(true);
    try {
      const { data, error, response } = await supabase.functions.invoke("devnet-faucet", {
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
        const status = (response as any)?.status;
        if (status === 429) {
          toast.error("Rate limited. Please try again later.");
          return;
        }
        throw new Error("Faucet request failed");
      }

      const receivedAmount = data?.amount ?? 0.5;
      toast.success(`Received ${receivedAmount} SOL! (Devnet)`);
      setTimeout(() => refetchBalance(), 2000);
    } catch (error: any) {
      console.error("Faucet error:", error);
      toast.error(error.message || "Faucet request failed. Try again later.");
    } finally {
      setRequestingAirdrop(false);
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen bg-background border-r border-border transition-all duration-300 fixed top-0 left-0 z-40",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🎵</span>
          {!collapsed && <span className="text-lg font-bold text-primary">NoizLabs</span>}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? item.name : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.name}</span>}
          </Link>
        ))}

        {isAdmin && (
          <>
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive("/admin")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? "Admin" : undefined}
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Admin</span>}
            </Link>
            <Link
              to="/analytics"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive("/analytics")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? "Analytics" : undefined}
            >
              <BarChart3 className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Analytics</span>}
            </Link>
          </>
        )}
      </nav>

      {/* Wallet Section */}
      <div className="p-2 border-t border-border space-y-2">
        {connected && !collapsed && (
          <div className="px-3 py-2 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-medium">
                {balanceLoading ? "..." : `${balance?.toFixed(2) ?? "0"} SOL`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">SOL Price</span>
              <span className="font-medium">{loading ? "..." : `$${price?.toFixed(2)}`}</span>
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

        {connected && collapsed && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs font-medium text-center">
              {balanceLoading ? "..." : `${balance?.toFixed(1) ?? "0"}`}
            </div>
          </div>
        )}

        <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "")}>
          <NotificationBell />
          <div className={cn(collapsed ? "hidden" : "flex-1")}>
            <WalletButton />
          </div>
          {collapsed && (
            <div className="flex justify-center">
              <WalletButton />
            </div>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={toggleCollapsed}
        className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
