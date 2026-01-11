import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { TokenTicker } from "./TokenTicker";
import MobileTabBar from "./MobileTabBar";

interface AppLayoutProps {
  children: ReactNode;
  showTicker?: boolean;
}

export function AppLayout({ children, showTicker = true }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      {/* Left Sidebar - Desktop only */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Token Ticker */}
        {showTicker && <TokenTicker />}

        {/* Page Content */}
        <main className="flex-1 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Tab Bar */}
      <MobileTabBar />
    </div>
  );
}
