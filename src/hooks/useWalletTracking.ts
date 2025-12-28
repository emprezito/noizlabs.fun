import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";

export const useWalletTracking = () => {
  const { publicKey, connected } = useWallet();

  useEffect(() => {
    const trackWalletConnection = async () => {
      if (!publicKey || !connected) return;

      const walletAddress = publicKey.toBase58();

      try {
        // Upsert wallet connection
        await supabase
          .from("connected_wallets")
          .upsert(
            {
              wallet_address: walletAddress,
              last_connected_at: new Date().toISOString(),
            },
            {
              onConflict: "wallet_address",
              ignoreDuplicates: false,
            }
          );
      } catch (error) {
        console.error("Error tracking wallet connection:", error);
      }
    };

    trackWalletConnection();
  }, [publicKey, connected]);
};
