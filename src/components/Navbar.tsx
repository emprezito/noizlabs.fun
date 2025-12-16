import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Droplets, Loader2, Wallet, Shield, ChevronDown } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "./WalletButton";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const navigation = [
  { name: "Explore", href: "/explore" },
  { name: "Create", href: "/create" },
  { name: "Trade", href: "/trade" },
  { name: "Leaderboard", href: "/leaderboard" },
  { name: "Profile", href: "/profile" },
];

const Navbar = () => {
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
      const { data, error } = await supabase.functions.invoke("devnet-faucet", {
        body: { walletAddress: publicKey.toBase58() },
      });

      if (error) throw new Error(error.message || "Faucet request failed");
      if (data?.error) throw new Error(data.error);

      toast.success(`Received ${data.amount} SOL! (Devnet)`);
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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl">🎵</span>
            <span className="text-lg font-bold text-primary">NoizLabs</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-0.5">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {item.name}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  isActive("/admin")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Wallet Info Popover (Desktop) */}
            {connected ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-1.5 h-8 text-xs">
                    <Wallet className="w-3.5 h-3.5" />
                    {balanceLoading ? "..." : `${balance?.toFixed(2) ?? "0"} SOL`}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="end">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">SOL Price</span>
                      <span className="font-medium">
                        {loading ? "..." : `$${price?.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Balance</span>
                      <span className="font-medium">
                        {balanceLoading ? "..." : `${balance?.toFixed(4) ?? "0"} SOL`}
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
                </PopoverContent>
              </Popover>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md text-xs">
                <span className="text-muted-foreground">SOL</span>
                <span className="font-medium">
                  {loading ? "..." : `$${price?.toFixed(2)}`}
                </span>
              </div>
            )}

            <div className="hidden sm:block">
              <WalletButton />
            </div>

            {/* Mobile wallet button */}
            <div className="md:hidden">
              <WalletButton />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
