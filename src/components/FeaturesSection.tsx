const features = [
  {
    emoji: "🎵",
    title: "Audio First",
    description: "Upload any audio meme, AI-generated voice, or sound effect. Make it tradeable in seconds.",
  },
  {
    emoji: "📈",
    title: "Bonding Curve",
    description: "Automatic price discovery. No liquidity pools needed. Price increases as more tokens are bought.",
  },
  {
    emoji: "⚡",
    title: "Solana Speed",
    description: "Lightning-fast trades with minimal fees. Built on Solana for the best DeFi experience.",
  },
  {
    emoji: "🎁",
    title: "Earn Points",
    description: "Every action earns points. Get rewarded with $NOIZ tokens at mainnet launch.",
  },
  {
    emoji: "🔒",
    title: "Fair Launch",
    description: "No presales, no VCs dumping on you. Everyone starts at the same bonding curve price.",
  },
  {
    emoji: "🚀",
    title: "Go Viral",
    description: "Share your audio tokens everywhere. The more viral it gets, the higher the price.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="bg-card py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-foreground">
            Why NoizLabs?
          </h2>
          <p className="text-center text-muted-foreground text-lg mb-16 max-w-2xl mx-auto">
            The pump.fun for audio. Fair launch, instant liquidity, zero rug pulls.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="bg-muted rounded-xl p-8 border border-border hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-5xl mb-4">{feature.emoji}</div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;