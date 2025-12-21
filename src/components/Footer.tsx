import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-2">
            <span className="text-xl">🎵</span>
            <span className="font-bold text-primary">NoizLabs</span>
            <span className="text-muted-foreground text-sm hidden sm:inline">
              — Audio meme launchpad on Solana
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/create" className="hover:text-foreground transition-colors">
              Create
            </Link>
            <Link to="/explore" className="hover:text-foreground transition-colors">
              Explore
            </Link>
            <Link to="/trade" className="hover:text-foreground transition-colors">
              Trade
            </Link>
            <a href="#" className="hover:text-foreground transition-colors">
              Twitter
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Discord
            </a>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          © 2025 NoizLabs. Built on Solana.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
