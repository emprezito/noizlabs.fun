import { Upload, Coins, Share2 } from "lucide-react";

const steps = [
  { number: 1, icon: Upload, title: "Upload Audio", description: "Record a voice memo, upload a sound effect, or generate AI voices." },
  { number: 2, icon: Coins, title: "Create Token", description: "Set name and symbol. Pay 0.02 SOL. Launch instantly with a bonding curve." },
  { number: 3, icon: Share2, title: "Share & Profit", description: "Share everywhere. As people buy, price goes up. Early holders win." },
];

const HowItWorksSection = () => {
  return (
    <section className="py-14 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-foreground">
            How It Works
          </h2>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="flex items-center gap-5 bg-card rounded-2xl p-4 border border-border hover:border-primary/50 transition-all duration-300 group"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Step circle */}
                <div className="flex-shrink-0 w-11 h-11 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-lg font-bold shadow-md shadow-primary/20">
                  {step.number}
                </div>
                {/* Icon */}
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <step.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base md:text-lg font-bold mb-0.5 text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
