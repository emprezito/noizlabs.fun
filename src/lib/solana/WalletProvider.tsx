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

const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

const getAppIdentity = () => {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://noizlabs.xyz";

  return {
    name: "NoizLabs",
    uri: origin,
    icon: `${origin}/icon.png`,
  };
};

export const WalletProvider: FC<Props> = ({ children }) => {
  const endpoint = useMemo(() => clusterApiUrl(NETWORK), []);

  const wallets = useMemo(() => {
    const walletAdapters = [];

    // Mobile: use Solana Mobile Wallet Adapter (native wallet apps + return-to-dapp)
    // Desktop: use browser extension adapters.
    if (isMobileDevice()) {
      walletAdapters.push(
        new SolanaMobileWalletAdapter({
          addressSelector: {
            select: async (addresses) => addresses[0],
          },
          appIdentity: getAppIdentity(),
          authorizationResultCache: {
            get: async () => {
              try {
                const raw = window.localStorage.getItem("mwa_authorization");
                return raw ? JSON.parse(raw) : null;
              } catch {
                return null;
              }
            },
            set: async (value) => {
              try {
                window.localStorage.setItem(
                  "mwa_authorization",
                  JSON.stringify(value)
                );
              } catch {
                // ignore
              }
            },
            clear: async () => {
              try {
                window.localStorage.removeItem("mwa_authorization");
              } catch {
                // ignore
              }
            },
          },
          cluster: NETWORK,
          onWalletNotFound: async () => {
            // Default MWA behavior shows install options; keep a gentle fallback.
            if (typeof window === "undefined") return;

            const ua = navigator.userAgent;
            const isAndroid = /Android/i.test(ua);
            const isIOS = /iPhone|iPad|iPod/i.test(ua);

            if (isAndroid) {
              window.open(
                "https://play.google.com/store/apps/details?id=app.phantom",
                "_blank"
              );
            } else if (isIOS) {
              window.open(
                "https://apps.apple.com/app/phantom-solana-wallet/id1598432977",
                "_blank"
              );
            }
          },
        })
      );

      return walletAdapters;
    }

    // Desktop adapters
    walletAdapters.push(new PhantomWalletAdapter(), new SolflareWalletAdapter());
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
