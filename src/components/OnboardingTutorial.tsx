import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { Wallet, Music, TrendingUp, Gift, ArrowRight, X } from "lucide-react";

const TUTORIAL_STEPS = [
  {
    title: "Welcome to NoizLabs! 🎵",
    description: "The first audio meme launchpad on Solana. Turn viral sounds into tradeable tokens.",
    icon: Music,
    tips: [
      "Create audio tokens with bonding curve mechanics",
      "Trade tokens and earn from price appreciation",
      "Complete quests to earn points and badges",
    ],
  },
  {
    title: "Connect Your Wallet",
    description: "You'll need a Solana wallet to interact with NoizLabs.",
    icon: Wallet,
    tips: [
      "Click 'Connect Wallet' in the top right",
      "Use Phantom or Solflare wallet",
      "Get free devnet SOL from the faucet to test",
    ],
  },
  {
    title: "Explore & Create",
    description: "Discover trending audio clips or create your own tokens.",
    icon: TrendingUp,
    tips: [
      "Browse the Explore page for trending clips",
      "Upload your own audio to the Clips tab",
      "Mint clips as tradeable tokens",
    ],
  },
  {
    title: "Earn Rewards",
    description: "Complete daily quests and invite friends to earn points.",
    icon: Gift,
    tips: [
      "Check the Leaderboard for daily quests",
      "Earn points for plays, likes, trades, and more",
      "Share your referral link to earn bonus points",
    ],
  },
];

const OnboardingTutorial = () => {
  const { connected } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has seen the tutorial
    const hasSeenTutorial = localStorage.getItem("noizlabs_tutorial_seen");
    if (!hasSeenTutorial) {
      // Show tutorial after a short delay for better UX
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    localStorage.setItem("noizlabs_tutorial_seen", "true");
    setIsOpen(false);
  };

  const handleSkip = () => {
    handleClose();
  };

  const step = TUTORIAL_STEPS[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <button 
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">{step.title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {step.tips.map((tip, index) => (
            <div 
              key={index} 
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
            >
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                {index + 1}
              </div>
              <p className="text-sm text-foreground">{tip}</p>
            </div>
          ))}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 py-2">
          {TUTORIAL_STEPS.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentStep ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={handleSkip} className="flex-1">
            Skip
          </Button>
          <Button onClick={handleNext} className="flex-1 gap-2">
            {isLastStep ? "Get Started" : "Next"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingTutorial;
