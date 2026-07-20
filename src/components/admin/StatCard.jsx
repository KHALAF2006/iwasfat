import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Polished admin stat card with optional trend indicator and skeleton state.
 * trend: number (e.g. +12 / -3) shown with an up/down/flat icon.
 */
export default function StatCard({ icon: Icon, label, value, sub, trend, color = "bg-primary/10 text-primary", loading }) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <Skeleton className="w-10 h-10 rounded-xl mb-3" />
        <Skeleton className="h-7 w-16 mb-2" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  const TrendIcon = trend == null ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend == null ? "" : trend > 0 ? "text-emerald-600" : trend < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
          <Icon className="w-5 h-5" />
        </div>
        {TrendIcon && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            {Math.abs(trend)}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/80 mt-1 leading-snug">{sub}</p>}
    </div>
  );
}
