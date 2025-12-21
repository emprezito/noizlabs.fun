import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

const buildAutoConnectUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.set("autoConnect", "1");
  return url.toString();
};

export const WalletButton = () => {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);

  const isMobile = useMemo(() => isMobileDevice(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (connected) return;

    const url = new URL(window.location.href);
    const shouldAutoConnect = url.searchParams.get("autoConnect") === "1";

    if (!shouldAutoConnect) return;

    // Open the wallet selector after the page loads inside the wallet in-app browser.
    setTimeout(() => setVisible(true), 0);

    // Clean the URL.
    url.searchParams.delete("autoConnect");
    window.history.replaceState({}, "", url.toString());
  }, [connected, setVisible]);

  const openInWalletBrowser = (wallet: "phantom" | "solflare") => {
    const dappUrl = encodeURIComponent(buildAutoConnectUrl());
    const ref = encodeURIComponent(window.location.origin);

    const link =
      wallet === "phantom"
        ? `https://phantom.app/ul/browse/${dappUrl}?ref=${ref}`
        : `https://solflare.com/ul/v1/browse/${dappUrl}?ref=${ref}`;

    window.location.href = link;
  };

  return (
    <div className="wallet-button-wrapper">
      {isMobile && !connected ? (
        <>
          <Button onClick={() => setOpen(true)}>
            <span className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </span>
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Open in your wallet</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Mobile wallets usually connect inside their in-app browser.
                  Choose a wallet to open NoizLabs and connect.
                </p>

                <Button
                  className="w-full"
                  onClick={() => openInWalletBrowser("phantom")}
                >
                  Open in Phantom
                </Button>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => openInWalletBrowser("solflare")}
                >
                  Open in Solflare
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <WalletMultiButton>
          {connected && publicKey ? (
            <span className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </span>
          )}
        </WalletMultiButton>
      )}
    </div>
  );
};

export default WalletButton;
