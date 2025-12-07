const steps = [
  {
    number: 1,
    title: "Upload Your Audio",
    description: "Record a voice memo, upload a sound effect, or generate AI voices. Any audio works.",
  },
  {
    number: 2,
    title: "Create Token",
    description: "Set name and symbol. Pay 0.02 SOL. Your token launches with a bonding curve instantly.",
  },
  {
    number: 3,
    title: "Share & Profit",
    description: "Share on Twitter, Discord, TikTok. As people buy, price goes up. Early holders win big.",
  },
];

const HowItWorksSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-foreground">
            How It Works
          </h2>

          <div className="space-y-6">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="flex flex-col md:flex-row items-center gap-6 md:gap-8 bg-card rounded-xl p-6 md:p-8 border border-border hover:border-primary/50 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="flex-shrink-0 w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold">
                  {step.number}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold mb-2 text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground text-lg">{step.description}</p>
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