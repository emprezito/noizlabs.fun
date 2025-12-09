import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Droplets, Loader2, Wallet, Shield } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "./WalletButton";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const navigation = [
  { name: "Home", href: "/" },
  { name: "Explore", href: "/tokens" },
  { name: "Create", href: "/create" },
  { name: "Trade", href: "/trade" },
  { name: "Discover", href: "/discover" },
  { name: "Leaderboard", href: "/leaderboard" },
  { name: "Profile", href: "/profile" },
];

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [requestingAirdrop, setRequestingAirdrop] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const { price, loading } = useSolPrice();
  const { publicKey, connected } = useWallet();
  const { balance, loading: balanceLoading, refetch: refetchBalance } = useWalletBalance();

  // Check if wallet is admin
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

      if (error) {
        throw new Error(error.message || "Faucet request failed");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Received ${data.amount} SOL! (Devnet)`);
      // Refetch balance after successful faucet
      setTimeout(() => refetchBalance(), 2000);
    } catch (error: any) {
      console.error("Faucet error:", error);
      toast.error(error.message || "Faucet request failed. Try again later.");
    } finally {
      setRequestingAirdrop(false);
    }
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl">🎵</span>
            <span className="text-xl font-bold text-primary">NoizLabs</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
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
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  isActive("/admin")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>

          {/* SOL Price & Connect Wallet */}
          <div className="flex items-center gap-3">
            {/* SOL Price Ticker */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm">
              <span className="text-muted-foreground">SOL</span>
              {loading ? (
                <span className="text-foreground font-medium">...</span>
              ) : (
                <span className="text-foreground font-bold">
                  ${price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {/* Wallet Balance & Devnet Faucet */}
            {connected && (
              <div className="hidden sm:flex items-center gap-2">
                {/* Balance Display */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-lg text-sm">
                  <Wallet className="w-4 h-4 text-primary" />
                  {balanceLoading ? (
                    <span className="text-muted-foreground">...</span>
                  ) : (
                    <span className="text-foreground font-bold">
                      {balance?.toFixed(4) ?? "0"} SOL
                    </span>
                  )}
                </div>
                
                {/* Faucet Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestAirdrop}
                  disabled={requestingAirdrop}
                  className="flex items-center gap-2"
                >
                  {requestingAirdrop ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Droplets className="w-4 h-4" />
                  )}
                  <span className="hidden lg:inline">Get SOL</span>
                </Button>
              </div>
            )}
            
            <div className="hidden sm:block">
              <WalletButton />
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-foreground" />
              ) : (
                <Menu className="w-6 h-6 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors ${
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
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    isActive("/admin")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Admin Panel
                </Link>
              )}
              {/* Mobile Balance & Faucet */}
              {connected && (
                <div className="space-y-2">
                  {/* Mobile Balance Display */}
                  <div className="flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 rounded-lg">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="text-foreground font-bold">
                      {balanceLoading ? "..." : `${balance?.toFixed(4) ?? "0"} SOL`}
                    </span>
                  </div>
                  
                  {/* Mobile Faucet Button */}
                  <Button
                    variant="outline"
                    onClick={requestAirdrop}
                    disabled={requestingAirdrop}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {requestingAirdrop ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Droplets className="w-4 h-4" />
                    )}
                    Get Devnet SOL
                  </Button>
                </div>
              )}
              <div className="mt-2">
                <WalletButton />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;