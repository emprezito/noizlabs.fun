import { usePriceAlerts } from "@/hooks/usePriceAlerts";

// This component initializes price alerts monitoring
export function PriceAlertsProvider({ children }: { children: React.ReactNode }) {
  usePriceAlerts();
  return <>{children}</>;
}
