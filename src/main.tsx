// Import polyfills first
import "./polyfills";

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { WalletProvider } from "./lib/solana/WalletProvider";
import { PriceAlertsProvider } from "./components/PriceAlertsProvider";

createRoot(document.getElementById("root")!).render(
  <WalletProvider>
    <PriceAlertsProvider>
      <App />
    </PriceAlertsProvider>
  </WalletProvider>
);
