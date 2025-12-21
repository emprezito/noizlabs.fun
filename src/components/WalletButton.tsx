import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Wallet } from "lucide-react";

export const WalletButton = () => {
  const { connected, publicKey, wallet } = useWallet();

  const label = useMemo(() => {
    if (connected && publicKey) {
      const key = publicKey.toString();
      return `${key.slice(0, 4)}...${key.slice(-4)}`;
    }

    // Helpful on mobile where “Connect” can feel like nothing happened.
    return wallet ? "Approve in wallet" : "Connect Wallet";
  }, [connected, publicKey, wallet]);

  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton>
        <span className="flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          {label}
        </span>
      </WalletMultiButton>
    </div>
  );
};

export default WalletButton;
