import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { TokenTicker } from "./TokenTicker";
import MobileTabBar from "./MobileTabBar";
import MobileHeader from "./MobileHeader";

interface AppLayoutProps {
  children: ReactNode;
  showTicker?: boolean;
}

export function AppLayout({ children, showTicker = true }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Left Sidebar - Desktop only */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">
        {/* Mobile Header with hamburger menu */}
        <MobileHeader />

        {/* Top Token Ticker */}
        {showTicker && <TokenTicker />}

        {/* Page Content */}
        <main className="flex-1 min-w-0 overflow-x-hidden pb-16 md:pb-0">{children}</main>
      </div>

      {/* Mobile Tab Bar */}
      <MobileTabBar />
    </div>
  );
}
