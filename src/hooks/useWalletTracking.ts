import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";

export const useWalletTracking = () => {
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
        console.error("Error tracking wallet connection:", error);
      }
    };

    trackWalletConnection();
  }, [publicKey, connected]);
};
