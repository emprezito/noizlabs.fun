const features = [
  {
    emoji: "🎵",
    title: "Audio First",
    description: "Upload any audio meme or sound effect. Make it tradeable in seconds.",
  },
  {
    emoji: "📈",
    title: "Bonding Curve",
    description: "Automatic price discovery. Price increases as more tokens are bought.",
  },
  {
    emoji: "⚡",
    title: "Solana Speed",
    description: "Lightning-fast trades with minimal fees on Solana.",
  },
  {
    emoji: "🎁",
    title: "Earn Points",
    description: "Every action earns points. Get rewarded at mainnet launch.",
  },
  {
    emoji: "🔒",
    title: "Fair Launch",
    description: "No presales, no VCs. Everyone starts at the same price.",
  },
  {
    emoji: "🚀",
    title: "Go Viral",
    description: "Share your tokens everywhere. More buyers = higher price.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="bg-card py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2 text-foreground">
            Why NoizLabs?
          </h2>
          <p className="text-center text-muted-foreground text-sm mb-8 max-w-xl mx-auto">
            The pump.fun for audio. Fair launch, instant liquidity, zero rug pulls.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="bg-muted rounded-lg p-4 border border-border hover:border-primary/50 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-2xl md:text-3xl mb-2">{feature.emoji}</div>
                <h3 className="text-base md:text-lg font-bold mb-1 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground text-xs md:text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
