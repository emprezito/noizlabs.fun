import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Twitter, Link2, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface SocialShareButtonProps {
  title: string;
  description?: string;
  url?: string;
  price?: number;
  marketCap?: number;
  isToken?: boolean;
  mintAddress?: string;
  imageUrl?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  clipId?: string;
}

export const SocialShareButton = ({
  title,
  description,
  url,
  price,
  marketCap,
  isToken = false,
  mintAddress,
  imageUrl,
  variant = "outline",
  size = "sm",
  clipId,
}: SocialShareButtonProps) => {
  const [copied, setCopied] = useState(false);

  // Use custom domain for all shared links
  const BASE_SHARE_URL = "https://noizlabs-io.vercel.app";

  const getShareUrl = () => {
    if (url) {
      // If URL is provided, ensure it uses the custom domain
      try {
        const urlObj = new URL(url);
        return `${BASE_SHARE_URL}${urlObj.pathname}${urlObj.search}`;
      } catch {
        return url;
      }
    }
    if (mintAddress) return `${BASE_SHARE_URL}/trade?mint=${mintAddress}`;
    // Use current path with custom domain
    return `${BASE_SHARE_URL}${window.location.pathname}${window.location.search}`;
  };

  const formatPrice = (price: number) => {
    if (price < 0.000001) return price.toExponential(2);
    if (price < 0.01) return price.toFixed(6);
    return price.toFixed(4);
  };

  const formatMarketCap = (mc: number) => {
    if (mc >= 1000000) return `$${(mc / 1000000).toFixed(2)}M`;
    if (mc >= 1000) return `$${(mc / 1000).toFixed(2)}K`;
    return `$${mc.toFixed(2)}`;
  };

  const buildShareText = () => {
    let text = `🎵 Check out "${title}" on NoizLabs!`;
    
    if (isToken && price !== undefined) {
      text += `\n\n💰 Price: ${formatPrice(price)} SOL`;
    }
    
    if (marketCap !== undefined && marketCap > 0) {
      text += `\n📊 Market Cap: ${formatMarketCap(marketCap)}`;
    }
    
    if (description) {
      text += `\n\n${description.slice(0, 100)}${description.length > 100 ? '...' : ''}`;
    }
    
    text += `\n\n🔥 Trade now on NoizLabs - The Sound of Web3`;
    text += `\n${getShareUrl()}`;
    
    return text;
  };

  const shareToTwitter = () => {
    const text = buildShareText();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
  };

  const shareToTelegram = () => {
    const text = buildShareText();
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(getShareUrl())}&text=${encodeURIComponent(text)}`;
    window.open(telegramUrl, "_blank");
  };

  const copyLink = async () => {
    try {
      const shareUrl = getShareUrl();
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: buildShareText(),
          url: getShareUrl(),
        });
      } catch (error) {
        // User cancelled or share failed
        if ((error as Error).name !== "AbortError") {
          toast.error("Failed to share");
        }
      }
    } else {
      copyLink();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-2">
          <Share2 className="w-4 h-4" />
          {size !== "icon" && "Share"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={shareToTwitter} className="cursor-pointer">
          <Twitter className="w-4 h-4 mr-2" />
          Share on X
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToTelegram} className="cursor-pointer">
          <MessageCircle className="w-4 h-4 mr-2" />
          Share on Telegram
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink} className="cursor-pointer">
          {copied ? (
            <Check className="w-4 h-4 mr-2 text-green-500" />
          ) : (
            <Link2 className="w-4 h-4 mr-2" />
          )}
          {copied ? "Copied!" : "Copy Link"}
        </DropdownMenuItem>
        {navigator.share && (
          <DropdownMenuItem onClick={shareNative} className="cursor-pointer">
            <Share2 className="w-4 h-4 mr-2" />
            More Options
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
