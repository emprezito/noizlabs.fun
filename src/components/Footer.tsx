import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
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
            <a href="https://x.com/noizlabs_io" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              Twitter
            </a>
            <a href="https://discord.gg/4VCJ5Mh5" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
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
