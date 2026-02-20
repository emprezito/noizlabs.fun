import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { DesktopHeader } from "./DesktopHeader";
import { TokenTicker } from "./TokenTicker";
import MobileTabBar from "./MobileTabBar";
import MobileHeader from "./MobileHeader";
import { useSidebarState } from "./SidebarContext";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  showTicker?: boolean;
}

export function AppLayout({ children, showTicker = true }: AppLayoutProps) {
  const { collapsed } = useSidebarState();

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Left Sidebar - Desktop only (fixed position) */}
      <AppSidebar />

      {/* Main Content Area - offset by sidebar width on desktop */}
      <div
        className={cn(
          "min-h-screen flex flex-col w-full transition-all duration-300",
          collapsed ? "md:pl-16" : "md:pl-56"
        )}
      >
        {/* Desktop Header */}
        <DesktopHeader />

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
