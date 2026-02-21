import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Compass,
  PlusCircle,
  Briefcase,
  ArrowLeftRight,
  Trophy,
  User,
  Shield,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSidebarState } from "./SidebarContext";

const navigation = [
  { name: "Explore", href: "/explore", icon: Compass },
  { name: "Create", href: "/create", icon: PlusCircle },
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Trade", href: "/trade", icon: ArrowLeftRight },
  { name: "Graduated", href: "/graduated", icon: GraduationCap },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { name: "Profile", href: "/profile", icon: User },
];

export function AppSidebar() {
  const { collapsed, toggleCollapsed } = useSidebarState();
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const { publicKey } = useWallet();

  useEffect(() => {
    const checkAdmin = async () => {
      if (!publicKey) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("admin_wallets")
        .select("id")
        .eq("wallet_address", publicKey.toBase58())
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [publicKey]);

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen bg-background border-r border-border transition-all duration-300 fixed top-0 left-0 z-40",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🎵</span>
          {!collapsed && <span className="text-lg font-bold text-primary">NoizLabs</span>}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? item.name : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.name}</span>}
          </Link>
        ))}

        {isAdmin && (
          <>
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive("/admin")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? "Admin" : undefined}
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Admin</span>}
            </Link>
            <Link
              to="/analytics"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive("/analytics")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? "Analytics" : undefined}
            >
              <BarChart3 className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Analytics</span>}
            </Link>
          </>
        )}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={toggleCollapsed}
        className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
