import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, GraduationCap, Volume2, Clock, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GraduatedToken {
  id: string;
  name: string;
  symbol: string;
  mint_address: string;
  cover_image_url: string | null;
  raydium_pool_address: string | null;
  migration_timestamp: string | null;
  total_volume: number | null;
  sol_reserves: number | null;
  creator_wallet: string;
}

export default function Graduated() {
  const [tokens, setTokens] = useState<GraduatedToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("tokens")
        .select("id, name, symbol, mint_address, cover_image_url, raydium_pool_address, migration_timestamp, total_volume, sol_reserves, creator_wallet")
        .eq("is_graduated", true)
        .order("migration_timestamp", { ascending: false });
      setTokens((data as GraduatedToken[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const formatVol = (lamports: number | null) => {
    if (!lamports) return "0";
    const sol = lamports / 1e9;
    return sol >= 1000 ? `${(sol / 1000).toFixed(1)}K` : sol.toFixed(2);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Graduated Tokens</h1>
            <p className="text-sm text-muted-foreground">Tokens that reached $50K market cap and migrated to Raydium</p>
          </div>
        </div>

        {/* Mainnet notice */}
        <Card className="p-4 border-primary/20 bg-primary/5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <GraduationCap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Mainnet Feature</p>
            <p className="text-xs text-muted-foreground">
              Raydium pool creation and live trading of graduated tokens will be available once the platform launches on mainnet. Currently on devnet, graduations are simulated.
            </p>
          </div>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-48 animate-pulse bg-muted" />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <Card className="p-12 text-center space-y-3">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold text-foreground">No graduated tokens yet</h3>
            <p className="text-muted-foreground text-sm">Tokens graduate when they reach a $50,000 USD market cap on the bonding curve.</p>
          </Card>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {tokens.map((t) => (
                <Card key={t.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {t.cover_image_url ? (
                      <img src={t.cover_image_url} alt={t.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-lg">🎵</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">${t.symbol}</p>
                    </div>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500 shrink-0">
                      <GraduationCap className="w-3 h-3 mr-1" /> Graduated
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Volume</p>
                      <p className="font-semibold">{formatVol(t.total_volume)} SOL</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Migrated</p>
                      <p className="font-semibold">{t.migration_timestamp ? formatDistanceToNow(new Date(t.migration_timestamp), { addSuffix: true }) : "—"}</p>
                    </div>
                  </div>
                  {t.raydium_pool_address && (
                    <Button size="sm" variant="outline" className="w-full" asChild>
                      <a href={`https://raydium.io/swap/?inputMint=sol&outputMint=${t.mint_address}`} target="_blank" rel="noopener noreferrer">
                        Trade on Raydium <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <Card className="hidden md:block overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Token</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Migrated</TableHead>
                    <TableHead>Pool</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {t.cover_image_url ? (
                            <img src={t.cover_image_url} alt={t.name} className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">🎵</div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground">{t.name}</p>
                            <p className="text-xs text-muted-foreground">${t.symbol}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Volume2 className="w-3 h-3 text-muted-foreground" />
                          {formatVol(t.total_volume)} SOL
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {t.migration_timestamp ? formatDistanceToNow(new Date(t.migration_timestamp), { addSuffix: true }) : "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px] block">
                          {t.raydium_pool_address?.slice(0, 12)}...
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" asChild>
                          <a href={`https://raydium.io/swap/?inputMint=sol&outputMint=${t.mint_address}`} target="_blank" rel="noopener noreferrer">
                            Trade <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
