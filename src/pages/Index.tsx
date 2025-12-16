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
import OnboardingTutorial from "@/components/OnboardingTutorial";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { publicKey, connected } = useWallet();

  // Store referral code when user arrives via link (before wallet connection)
  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      localStorage.setItem("noizlabs_pending_referral", refCode.toUpperCase());
      // Clean URL immediately so it looks cleaner
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Apply referral when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      const pendingReferral = localStorage.getItem("noizlabs_pending_referral");
      if (pendingReferral) {
        applyReferralFromLink(pendingReferral);
      }
    }
  }, [connected, publicKey]);

  const applyReferralFromLink = async (refCode: string) => {
    const walletAddress = publicKey?.toString();
    if (!walletAddress) return;

    try {
      // Check if user exists
      const { data: userData } = await supabase
        .from("user_points")
        .select("referred_by, total_points, referral_code")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      // If user already has a referrer, skip
      if (userData?.referred_by) {
        localStorage.removeItem("noizlabs_pending_referral");
        return;
      }

      // Check if referral code exists and is not the user's own code
      const { data: referrer } = await supabase
        .from("user_points")
        .select("wallet_address, referral_code")
        .eq("referral_code", refCode)
        .maybeSingle();

      if (!referrer || referrer.wallet_address === walletAddress) {
        localStorage.removeItem("noizlabs_pending_referral");
        return;
      }

      if (userData) {
        // User exists - update their record
        await supabase
          .from("user_points")
          .update({ 
            referred_by: refCode,
            total_points: (userData.total_points || 0) + 100 
          })
          .eq("wallet_address", walletAddress);
      } else {
        // New user - create their record with referral
        const { data: codeData } = await supabase.rpc("generate_referral_code");
        
        await supabase
          .from("user_points")
          .insert({
            wallet_address: walletAddress,
            total_points: 100,
            referred_by: refCode,
            referral_code: codeData || `${walletAddress.slice(0, 8).toUpperCase()}`,
          });
      }

      toast.success("Referral applied! You earned 100 bonus points! 🎉");
      localStorage.removeItem("noizlabs_pending_referral");
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
      <OnboardingTutorial />
    </div>
  );
};

export default Index;
