import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="bg-primary py-20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
          Ready to Launch Your Audio Token?
        </h2>
        <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
          Join the first wave of audio meme creators. Get rewarded with points for the $NOIZ airdrop.
        </p>
        <Link to="/create">
          <Button variant="secondary" size="lg" className="text-lg px-8 py-6">
            🎵 Create Your First Token
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default CTASection;