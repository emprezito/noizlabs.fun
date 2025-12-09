import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Droplets, Loader2 } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import WalletButton from "./WalletButton";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  const location = useLocation();
  const { price, loading } = useSolPrice();
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const requestAirdrop = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    setRequestingAirdrop(true);
    try {
      const signature = await connection.requestAirdrop(publicKey, 1 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(signature, "confirmed");
      toast.success("Received 1 SOL! (Devnet)");
    } catch (error: any) {
      console.error("Airdrop error:", error);
      if (error.message?.includes("429")) {
        toast.error("Rate limited. Please wait a moment and try again.");
      } else {
        toast.error("Airdrop failed. Try again later.");
      }
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

            {/* Devnet Faucet Button */}
            {connected && (
              <Button
                variant="outline"
                size="sm"
                onClick={requestAirdrop}
                disabled={requestingAirdrop}
                className="hidden sm:flex items-center gap-2"
              >
                {requestingAirdrop ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Droplets className="w-4 h-4" />
                )}
                <span className="hidden lg:inline">Get Devnet SOL</span>
              </Button>
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
              {/* Mobile Faucet Button */}
              {connected && (
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