import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame } from "lucide-react";

interface MintEntry {
  id: string;
  minted_by: string;
  token_name: string;
  token_ticker: string;
  minted_at: string;
}

function truncateWallet(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function LiveActivityFeed() {
  const [mints, setMints] = useState<MintEntry[]>([]);

  const fetchRecent = async () => {
    try {
      const { data } = await supabase.functions.invoke("sounds-registry", {
        body: { action: "recent_mints" },
      });
      if (data?.mints) setMints(data.mints.slice(0, 5));
    } catch {
      // Silent fail
    }
  };

  useEffect(() => {
    fetchRecent();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("sounds-registry-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sounds_registry", filter: "status=eq.minted" },
        () => fetchRecent()
      )
      .subscribe();

    // Also poll every 10s
    const interval = setInterval(fetchRecent, 10000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (!mints.length) return null;

  return (
    <div className="bg-card/50 border border-border rounded-xl p-3 overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <Flame className="w-4 h-4 text-orange-400" />
        <span className="text-xs font-bold text-foreground">Live Mints</span>
      </div>
      <div className="space-y-1.5">
        {mints.map(mint => (
          <div key={mint.id} className="text-xs text-muted-foreground truncate animate-in fade-in slide-in-from-bottom-1">
            <span className="text-orange-400">🔥</span>{" "}
            <span className="text-foreground font-medium">@{truncateWallet(mint.minted_by || "")}</span>
            {" "}minted &apos;{mint.token_name}&apos; as{" "}
            <span className="text-primary font-bold">${mint.token_ticker}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
