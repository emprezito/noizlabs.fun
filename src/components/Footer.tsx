import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-3xl">🎵</span>
              <span className="text-xl font-bold text-primary">NoizLabs</span>
            </div>
            <p className="text-muted-foreground">
              The first audio meme launchpad on Solana.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-foreground">Product</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link to="/create" className="hover:text-foreground transition-colors">
                  Create
                </Link>
              </li>
              <li>
                <Link to="/tokens" className="hover:text-foreground transition-colors">
                  Explore
                </Link>
              </li>
              <li>
                <Link to="/trade" className="hover:text-foreground transition-colors">
                  Trade
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-foreground">Community</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Twitter
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Discord
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Telegram
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-foreground">Resources</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Docs
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
          <p>© 2024 NoizLabs. Built on Solana. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;