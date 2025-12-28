// Import polyfills first
import "./polyfills";

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { WalletProvider } from "./lib/solana/WalletProvider";
import { PriceAlertsProvider } from "./components/PriceAlertsProvider";
import { WalletTracker } from "./components/WalletTracker";

createRoot(document.getElementById("root")!).render(
  <WalletProvider>
    <WalletTracker />
    <PriceAlertsProvider>
      <App />
    </PriceAlertsProvider>
  </WalletProvider>
);
