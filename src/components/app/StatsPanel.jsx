import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Flame, CheckCircle2, Droplets, Calendar } from "lucide-react";
import { useT } from "@/i18n";

export default function StatsPanel({ subscriberId }) {
  const t = useT();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["subscriberStats", subscriberId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getSubscriberStats", { subscriber_id: subscriberId });
      return res.data;
    },
    enabled: !!subscriberId,
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">{t("components.statsPanel.title")}</h3>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-secondary/40 rounded-xl p-3 h-16 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statItems = [
    {
      icon: Flame,
      label: t("components.statsPanel.mealsDone"),
      value: stats.total_meals_logged,
      unit: t("components.statsPanel.mealUnit"),
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      icon: CheckCircle2,
      label: t("components.statsPanel.compliance"),
      value: stats.compliance_rate,
      unit: "%",
      color: "text-primary",
      bg: "bg-primary/5",
    },
    {
      icon: Flame,
      label: t("components.statsPanel.avgCal"),
      value: stats.avg_daily_calories,
      unit: t("components.statsPanel.calPerDay"),
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      icon: Droplets,
      label: t("components.statsPanel.avgWater"),
      value: stats.avg_water_cups,
      unit: t("components.statsPanel.cupPerDay"),
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">{t("components.statsPanel.title")}</h3>
        {stats.days_remaining !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/60 px-3 py-1 rounded-full">
            <Calendar className="w-3 h-3" />
            <span>
              {stats.days_remaining > 0
                ? t("components.statsPanel.daysRemaining", { days: stats.days_remaining })
                : t("components.statsPanel.subEnded")}
            </span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {statItems.map((item, i) => (
          <div key={i} className={`${item.bg} rounded-xl p-3`}>
            <item.icon className={`w-4 h-4 ${item.color} mb-1`} />
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`font-bold text-foreground`}>
              {item.value} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
