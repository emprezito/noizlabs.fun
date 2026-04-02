import { Music2, TrendingUp, Zap, Gift, Lock, Share2 } from "lucide-react";

const features = [
  { icon: Music2, title: "Audio First", description: "Upload any audio meme or sound effect. Make it tradeable in seconds." },
  { icon: TrendingUp, title: "Bonding Curve", description: "Automatic price discovery. Price increases as more tokens are bought." },
  { icon: Zap, title: "Solana Speed", description: "Lightning-fast trades with minimal fees on Solana." },
  { icon: Gift, title: "Earn Points", description: "Every action earns points. Get rewarded at mainnet launch." },
  { icon: Lock, title: "Fair Launch", description: "No presales, no VCs. Everyone starts at the same price." },
  { icon: Share2, title: "Go Viral", description: "Share your tokens everywhere. More buyers = higher price." },
];

const FeaturesSection = () => {
  return (
    <section className="bg-card py-14">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2 text-foreground">
            Why NoizLabs?
          </h2>
          <p className="text-center text-muted-foreground text-sm mb-10 max-w-xl mx-auto">
            The pump.fun for audio. Fair launch, instant liquidity, zero rug pulls.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="bg-background rounded-xl p-4 border border-border hover:border-primary/50 transition-all duration-300 group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Icon container */}
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground text-xs md:text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
