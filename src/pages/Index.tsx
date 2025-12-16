import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import OnboardingTutorial from "@/components/OnboardingTutorial";

const Index = () => {
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
