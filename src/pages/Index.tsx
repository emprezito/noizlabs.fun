import { AppLayout } from "@/components/AppLayout";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import OnboardingTutorial from "@/components/OnboardingTutorial";

const Index = () => {
  return (
    <AppLayout>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CTASection />
      <Footer />
      <OnboardingTutorial />
    </AppLayout>
  );
};

export default Index;
