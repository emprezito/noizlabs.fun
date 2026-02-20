import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/SidebarContext";
import Index from "./pages/Index";
import Create from "./pages/Create";
import Explore from "./pages/Explore";
import Trade from "./pages/Trade";
import Portfolio from "./pages/Portfolio";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Analytics from "./pages/Analytics";
import UserAnalytics from "./pages/UserAnalytics";
import Graduated from "./pages/Graduated";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SidebarProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/create" element={<Create />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/trade" element={<Trade />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/graduated" element={<Graduated />} />
            <Route path="/my-analytics" element={<UserAnalytics />} />
            {/* Redirects for old routes */}
            <Route path="/tokens" element={<Navigate to="/explore?tab=tokens" replace />} />
            <Route path="/discover" element={<Navigate to="/explore?tab=clips" replace />} />
            <Route path="/vesting" element={<Navigate to="/portfolio" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SidebarProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
