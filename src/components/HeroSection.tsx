import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="bg-background pt-32 pb-20 min-h-screen flex items-center">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-card rounded-full px-6 py-2 border border-border mb-8 animate-fade-in">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            <span className="text-sm font-semibold text-foreground">
              Now Live on Testnet
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <span className="text-primary">
              Turn Audio Memes
            </span>
            <br />
            <span className="text-foreground">Into Tradeable Assets</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: "0.2s" }}>
            The first audio meme launchpad on Solana. Create, trade, and earn from viral sounds with bonding curve mechanics.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Link to="/create">
              <Button size="lg" className="text-lg px-8 py-6">
                🚀 Create Your Token
              </Button>
            </Link>
            <Link to="/tokens">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                🔍 Explore Tokens
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-card rounded-xl p-8 border border-border animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <div className="text-4xl font-bold text-primary mb-2">0.02 SOL</div>
              <div className="text-muted-foreground font-medium">Creation Fee</div>
            </div>
            <div className="bg-card rounded-xl p-8 border border-border animate-fade-in" style={{ animationDelay: "0.5s" }}>
              <div className="text-4xl font-bold text-accent mb-2">1%</div>
              <div className="text-muted-foreground font-medium">Trading Fee</div>
            </div>
            <div className="bg-card rounded-xl p-8 border border-border animate-fade-in" style={{ animationDelay: "0.6s" }}>
              <div className="text-4xl font-bold text-noiz-blue mb-2">Instant</div>
              <div className="text-muted-foreground font-medium">Liquidity</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;