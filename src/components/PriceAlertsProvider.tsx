import { ReactNode } from "react";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";

// This component initializes price alerts monitoring
export function PriceAlertsProvider({ children }: { children: ReactNode }) {
  usePriceAlerts();
  return <>{children}</>;
}
