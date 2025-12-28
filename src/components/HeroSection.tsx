import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="bg-background pt-24 pb-12 min-h-[75vh] flex items-center">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-card rounded-full px-4 py-1.5 border border-border mb-6 animate-fade-in">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
            <span className="text-xs font-semibold text-foreground">
              Now Live on Testnet
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <span className="text-primary">Turn Audio Memes</span>
            <br />
            <span className="text-foreground">Into Tradeable Assets</span>
          </h1>

          {/* Subheading */}
          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.2s" }}>
            The first audio meme launchpad on Solana. Create, trade, and earn from viral sounds.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Link to="/create">
              <Button size="default" className="px-6">
                🚀 Create Token
              </Button>
            </Link>
            <Link to="/explore">
              <Button variant="outline" size="default" className="px-6">
                🔍 Explore
              </Button>
            </Link>
          </div>

          {/* Stats - Compact inline */}
          <div className="mt-12 flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
            <div className="bg-card rounded-lg px-4 py-3 border border-border animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <span className="text-xl font-bold text-primary">0.02 SOL</span>
              <span className="text-muted-foreground text-sm ml-2">Creation Fee</span>
            </div>
            <div className="bg-card rounded-lg px-4 py-3 border border-border animate-fade-in" style={{ animationDelay: "0.5s" }}>
              <span className="text-xl font-bold text-accent">1%</span>
              <span className="text-muted-foreground text-sm ml-2">Trading Fee</span>
            </div>
            <div className="bg-card rounded-lg px-4 py-3 border border-border animate-fade-in" style={{ animationDelay: "0.6s" }}>
              <span className="text-xl font-bold text-foreground">Instant</span>
              <span className="text-muted-foreground text-sm ml-2">Liquidity</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
