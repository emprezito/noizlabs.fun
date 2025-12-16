const steps = [
  {
    number: 1,
    title: "Upload Audio",
    description: "Record a voice memo, upload a sound effect, or generate AI voices.",
  },
  {
    number: 2,
    title: "Create Token",
    description: "Set name and symbol. Pay 0.02 SOL. Launch instantly with a bonding curve.",
  },
  {
    number: 3,
    title: "Share & Profit",
    description: "Share everywhere. As people buy, price goes up. Early holders win.",
  },
];

const HowItWorksSection = () => {
  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-foreground">
            How It Works
          </h2>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="flex items-center gap-4 md:gap-6 bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-lg md:text-xl font-bold">
                  {step.number}
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
