import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { SolanaMobileWalletAdapter } from "@solana-mobile/wallet-adapter-mobile";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
  children: ReactNode;
}

// Use devnet for testing, switch to mainnet-beta for production
const NETWORK = WalletAdapterNetwork.Devnet;

// Check if running on mobile
const isMobile = () => {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

export const WalletProvider: FC<Props> = ({ children }) => {
  const endpoint = useMemo(() => clusterApiUrl(NETWORK), []);

  const wallets = useMemo(() => {
    const walletAdapters = [];

    // Add Mobile Wallet Adapter for mobile devices - this enables deep linking
    if (isMobile()) {
      walletAdapters.push(
        new SolanaMobileWalletAdapter({
          addressSelector: {
            select: async (addresses) => addresses[0],
          },
          appIdentity: {
            name: "NoizLabs",
            uri: window.location.origin,
            icon: `${window.location.origin}/favicon.ico`,
          },
          authorizationResultCache: {
            get: async () => null,
            set: async () => {},
            clear: async () => {},
          },
          cluster: NETWORK,
          onWalletNotFound: async () => {
            // This will be called if no mobile wallet is found
            // The default behavior will show install options
            if (typeof window !== "undefined") {
              // Try to detect and redirect to wallet app stores
              const isAndroid = /Android/i.test(navigator.userAgent);
              const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
              
              if (isAndroid) {
                window.open("https://play.google.com/store/apps/details?id=app.phantom", "_blank");
              } else if (isIOS) {
                window.open("https://apps.apple.com/app/phantom-solana-wallet/id1598432977", "_blank");
              }
            }
          },
        })
      );
    }

    // Always add standard wallet adapters as fallback
    walletAdapters.push(
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter()
    );

    return walletAdapters;
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

export default WalletProvider;
