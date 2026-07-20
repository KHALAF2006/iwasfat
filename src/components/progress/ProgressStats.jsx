import { TrendingDown, TrendingUp, Target, Scale, Zap } from "lucide-react";
import { useT } from "@/i18n";

export default function ProgressStats({ subscriber, weightLogs }) {
  const t = useT();
  const startWeight = subscriber?.current_weight || 0;
  const targetWeight = subscriber?.target_weight || 0;
  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : startWeight;
  const totalLost = startWeight - currentWeight;
  const remaining = Math.max(0, currentWeight - targetWeight);
  const progressPct = startWeight > targetWeight
    ? Math.min(100, Math.round((totalLost / (startWeight - targetWeight)) * 100))
    : 0;

  const lastLog = weightLogs[weightLogs.length - 1];
  const prevLog = weightLogs[weightLogs.length - 2];
  const weekChange = lastLog && prevLog ? (lastLog.weight - prevLog.weight).toFixed(1) : null;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="bg-card rounded-2xl border border-border/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">{t("components.progressStats.towardGoal")}</span>
          <span className="text-sm font-bold text-primary">{progressPct}%</span>
        </div>
        <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{t("components.progressStats.start")} {startWeight} {t("common.kg")}</span>
          <span>{t("components.progressStats.target")} {targetWeight} {t("common.kg")}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
          <Scale className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xl font-bold text-foreground">{currentWeight}</p>
          <p className="text-xs text-muted-foreground">{t("components.progressStats.currentWeight")}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
          {totalLost >= 0
            ? <TrendingDown className="w-5 h-5 text-green-500 mx-auto mb-1" />
            : <TrendingUp className="w-5 h-5 text-destructive mx-auto mb-1" />
          }
          <p className={`text-xl font-bold ${totalLost >= 0 ? "text-green-600" : "text-destructive"}`}>
            {Math.abs(totalLost).toFixed(1)}
          </p>
          <p className="text-xs text-muted-foreground">
            {totalLost >= 0 ? t("components.progressStats.kgLost") : t("components.progressStats.kgGained")}
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
          <Target className="w-5 h-5 text-accent mx-auto mb-1" />
          <p className="text-xl font-bold text-foreground">{remaining.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">{t("components.progressStats.kgRemaining")}</p>
        </div>
      </div>

      {/* Weekly change */}
      {weekChange !== null && (
        <div className={`rounded-2xl border p-3 flex items-center gap-3 ${parseFloat(weekChange) <= 0 ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
          <Zap className={`w-5 h-5 ${parseFloat(weekChange) <= 0 ? "text-green-600" : "text-orange-500"}`} />
          <div>
            <p className={`text-sm font-semibold ${parseFloat(weekChange) <= 0 ? "text-green-700" : "text-orange-600"}`}>
              {parseFloat(weekChange) <= 0
                ? t("components.progressStats.down", { value: Math.abs(weekChange) })
                : t("components.progressStats.up", { value: weekChange })} {t("components.progressStats.sinceLast")}
            </p>
            <p className="text-xs text-muted-foreground">
              {parseFloat(weekChange) <= 0 ? t("components.progressStats.greatJob") : t("components.progressStats.dontWorry")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
