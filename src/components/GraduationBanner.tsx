import { ExternalLink, Rocket, TrendingUp, Loader2, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { GraduationState } from "@/hooks/useGraduation";

const MIGRATION_MARKET_CAP_USD = 50_000;

interface GraduationBannerProps {
  graduation: GraduationState;
  tokenName: string;
  tokenSymbol: string;
}

export function GraduationBanner({ graduation, tokenName, tokenSymbol }: GraduationBannerProps) {
  const { isGraduated, isMigrating, marketCapUsd, progressPercent, raydiumPoolAddress } = graduation;

  if (isGraduated) {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-yellow-500/10 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-bold text-sm">🎓 Graduated to Raydium</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-medium">
                  GRADUATED
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tokenName} reached $50K market cap and is now trading on Raydium
              </p>
            </div>
          </div>
          {raydiumPoolAddress && (
            <Button
              size="sm"
              className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 gap-2 text-xs"
              onClick={() => window.open(`https://raydium.io/swap/?inputMint=sol&outputMint=${raydiumPoolAddress}`, '_blank')}
            >
              <Rocket className="w-3.5 h-3.5" />
              Trade on Raydium
              <ExternalLink className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isMigrating) {
    return (
      <div className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-purple-900/10 p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          <div>
            <span className="text-purple-400 font-bold text-sm">Migrating to Raydium...</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Trading is paused. Liquidity is being moved to Raydium. This takes a few seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Progress bar phase
  const remaining = Math.max(0, MIGRATION_MARKET_CAP_USD - marketCapUsd);

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Bonding Curve Phase</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">
            ${marketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} / $50K
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            {progressPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="relative">
        <Progress
          value={progressPercent}
          className="h-2.5 bg-secondary"
        />
        {progressPercent > 10 && (
          <div
            className="absolute top-0 left-0 h-2.5 rounded-full bg-gradient-to-r from-primary via-purple-500 to-yellow-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Rocket className="w-3 h-3" />
          {remaining > 0
            ? `$${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} until Raydium graduation`
            : 'Ready to graduate!'}
        </span>
        <span className="text-[10px]">🎓 $50K target</span>
      </div>
    </div>
  );
}

// Compact version for token cards
interface GraduationProgressBarProps {
  progressPercent: number;
  marketCapUsd: number;
  isGraduated: boolean;
}

export function GraduationProgressBar({ progressPercent, marketCapUsd, isGraduated }: GraduationProgressBarProps) {
  if (isGraduated) {
    return (
      <div className="flex items-center gap-1.5">
        <Trophy className="w-3 h-3 text-yellow-400" />
        <span className="text-[10px] text-yellow-400 font-medium">Graduated</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Rocket className="w-2.5 h-2.5" />
          Raydium
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">{progressPercent.toFixed(1)}%</span>
      </div>
      <div className="relative h-1 bg-secondary rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, progressPercent)}%` }}
        />
      </div>
    </div>
  );
}
