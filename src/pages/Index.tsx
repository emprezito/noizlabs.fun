import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { publicKey, connected } = useWallet();

  // Handle referral link on landing
  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode && connected && publicKey) {
      applyReferralFromLink(refCode);
    }
  }, [searchParams, connected, publicKey]);

  const applyReferralFromLink = async (refCode: string) => {
    const walletAddress = publicKey?.toString();
    if (!walletAddress) return;

    try {
      // Check if user already has a referrer
      const { data: userData } = await supabase
        .from("user_points")
        .select("referred_by, total_points")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (userData?.referred_by) return; // Already referred

      // Check if referral code exists
      const { data: referrer } = await supabase
        .from("user_points")
        .select("wallet_address, referral_code")
        .eq("referral_code", refCode.toUpperCase())
        .maybeSingle();

      if (!referrer || referrer.wallet_address === walletAddress) return;

      // Apply referral
      await supabase
        .from("user_points")
        .update({ referred_by: refCode.toUpperCase() })
        .eq("wallet_address", walletAddress);

      // Bonus points
      const currentPoints = userData?.total_points || 0;
      await supabase
        .from("user_points")
        .update({ total_points: currentPoints + 100 })
        .eq("wallet_address", walletAddress);

      toast.success("Referral applied! You earned 100 bonus points!");
      
      // Clean URL
      setSearchParams({});
    } catch (error) {
      console.error("Error applying referral:", error);
    }
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CTASection />
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
};

export default Index;
