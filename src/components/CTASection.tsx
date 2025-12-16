import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="bg-primary py-10">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-3">
          Ready to Launch Your Audio Token?
        </h2>
        <p className="text-sm md:text-base text-primary-foreground/80 mb-5 max-w-xl mx-auto">
          Join the first wave of audio meme creators. Earn points for the $NOIZ airdrop.
        </p>
        <Link to="/create">
          <Button variant="secondary" size="default" className="px-6">
            🎵 Create Token
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default CTASection;
