import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Component that tracks wallet connections when users connect their wallet
 * Should be placed at a high level in the component tree, inside WalletProvider
 */
export const WalletTracker = () => {
  const { publicKey, connected } = useWallet();

  useEffect(() => {
    const trackWalletConnection = async () => {
      if (!publicKey || !connected) return;

      try {
        await supabase.functions.invoke("manage-user-data", {
          body: {
            action: "track_wallet",
            walletAddress: publicKey.toBase58(),
          },
        });
      } catch (error) {
        // Silently fail - analytics shouldn't break the app
        console.error("Error tracking wallet connection:", error);
      }
    };

    trackWalletConnection();
  }, [publicKey, connected]);

  return null;
};
