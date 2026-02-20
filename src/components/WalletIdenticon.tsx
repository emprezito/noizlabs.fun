import { useMemo } from "react";

interface WalletIdenticonProps {
  address: string;
  size?: number;
  className?: string;
}

/**
 * Generates a deterministic gradient identicon from a wallet address,
 * similar to Phantom's wallet avatar style.
 */
export function WalletIdenticon({ address, size = 36, className = "" }: WalletIdenticonProps) {
  const gradientColors = useMemo(() => {
    // Use address bytes to generate deterministic colors
    const hash = address.split("").reduce((acc, char, i) => {
      return acc + char.charCodeAt(0) * (i + 1);
    }, 0);

    const hue1 = hash % 360;
    const hue2 = (hue1 + 40 + (hash % 80)) % 360;
    const hue3 = (hue2 + 40 + (hash % 60)) % 360;

    return {
      color1: `hsl(${hue1}, 75%, 60%)`,
      color2: `hsl(${hue2}, 70%, 55%)`,
      color3: `hsl(${hue3}, 65%, 50%)`,
      angle: (hash % 360),
    };
  }, [address]);

  return (
    <div
      className={`rounded-full flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(${gradientColors.angle}deg, ${gradientColors.color1}, ${gradientColors.color2}, ${gradientColors.color3})`,
      }}
    />
  );
}
