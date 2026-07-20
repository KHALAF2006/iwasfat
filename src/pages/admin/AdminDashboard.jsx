import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users, UserCheck, Hourglass, CalendarX2, Ban, Sparkles,
  Wallet, FolderOpen, ArrowLeft, Columns3, CalendarDays, Apple,
} from "lucide-react";
import moment from "moment";
import { Progress } from "@/components/ui/progress";
import StatCard from "@/components/admin/StatCard";
import { useT } from "@/i18n";

// NOTE: 199 SAR is the assumed plan price used ONLY for the potential-MRR estimate.
const ASSUMED_PLAN_PRICE = 199;

const STATUS_BADGE = {
  active: "bg-primary/10 text-primary",
  trial: "bg-accent/10 text-accent",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export default function AdminDashboard() {
  const t = useT();

  const { data: subscribers = [], isLoading: loadingSubs } = useQuery({
    queryKey: ["allSubscribers"],
    queryFn: () => base44.entities.Subscriber.list(),
  });

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["allGroups"],
    queryFn: () => base44.entities.Group.list(),
  });

  const byStatus = (s) => subscribers.filter(sub => sub.subscription_status === s).length;
  const trialCount = byStatus("trial");
  const activeCount = byStatus("active");
  const expiredCount = byStatus("expired");
  const cancelledCount = byStatus("cancelled");

  const weekAgo = moment().subtract(7, "days");
  const newThisWeek = subscribers.filter(s => s.created_date && moment(s.created_date).isAfter(weekAgo)).length;

  // Honest revenue: potential MRR from ACTIVE subscriptions only (trial excluded).
  const estimatedMrr = activeCount * ASSUMED_PLAN_PRICE;

  const quickActions = [
    { to: "/admin/pipeline", icon: Columns3, label: t("adminPro.dash.qaPipeline"), emoji: "🧲" },
    { to: "/admin/subscribers", icon: Users, label: t("adminPro.dash.qaSubscribers"), emoji: "👥" },
    { to: "/admin/daily-plans", icon: CalendarDays, label: t("adminPro.dash.qaDailyPlans"), emoji: "🗓️" },
    { to: "/admin/food-database", icon: Apple, label: t("adminPro.dash.qaFoodDb"), emoji: "🍎" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-6">{t("admin.welcome")}</h1>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={Users} label={t("adminPro.dash.totalSubscribers")} value={subscribers.length} loading={loadingSubs} trend={newThisWeek} color="bg-primary/10 text-primary" />
        <StatCard icon={Sparkles} label={t("adminPro.dash.newThisWeek")} value={newThisWeek} loading={loadingSubs} color="bg-accent/10 text-accent" />
        <StatCard icon={UserCheck} label={t("adminPro.status.active")} value={activeCount} loading={loadingSubs} color="bg-emerald-500/10 text-emerald-600" />
        <StatCard
          icon={Wallet}
          label={t("adminPro.dash.estimatedMrr")}
          value={`${estimatedMrr.toLocaleString()} ${t("admin.sar")}`}
          sub={t("adminPro.dash.estimatedMrrNote", { price: ASSUMED_PLAN_PRICE })}
          loading={loadingSubs}
          color="bg-amber-500/10 text-amber-600"
        />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Hourglass} label={t("adminPro.status.trial")} value={trialCount} loading={loadingSubs} color="bg-accent/10 text-accent" />
        <StatCard icon={UserCheck} label={t("adminPro.status.active")} value={activeCount} loading={loadingSubs} color="bg-emerald-500/10 text-emerald-600" />
        <StatCard icon={CalendarX2} label={t("adminPro.status.expired")} value={expiredCount} loading={loadingSubs} color="bg-orange-500/10 text-orange-600" />
        <StatCard icon={Ban} label={t("adminPro.status.cancelled")} value={cancelledCount} loading={loadingSubs} color="bg-muted text-muted-foreground" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        {/* Quick actions */}
        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">{t("adminPro.dash.quickActions")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(qa => (
              <Link
                key={qa.to}
                to={qa.to}
                className="group flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 px-4 py-3 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span>{qa.emoji}</span>
                  {qa.label}
                </span>
                <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Group fill rates */}
        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            {t("adminPro.dash.groupFill")}
          </h2>
          {loadingGroups ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-8 rounded-lg bg-secondary/50 animate-pulse" />)}
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">📭 {t("adminPro.dash.noGroups")}</p>
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto pl-1">
              {groups.map(g => {
                const max = g.max_members || 15;
                const current = g.member_count || 0;
                const pct = Math.min(100, Math.round((current / max) * 100));
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-foreground truncate">{g.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t("adminPro.dash.members", { current, max })} · {pct}%
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Subscribers */}
      <div className="bg-card rounded-2xl border border-border/50 p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">{t("adminPro.dash.recentSubscribers")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-right pb-3 font-medium">الاسم</th>
                <th className="text-right pb-3 font-medium">البريد</th>
                <th className="text-right pb-3 font-medium">الوزن</th>
                <th className="text-right pb-3 font-medium">الهدف</th>
                <th className="text-right pb-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.slice(0, 10).map(sub => (
                <tr key={sub.id} className="border-b border-border/50">
                  <td className="py-3 font-medium text-foreground">{sub.full_name}</td>
                  <td className="py-3 text-muted-foreground">{sub.email}</td>
                  <td className="py-3">{sub.current_weight} كغ</td>
                  <td className="py-3">{sub.target_weight} كغ</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[sub.subscription_status] || "bg-muted text-muted-foreground"}`}>
                      {t(`adminPro.status.${sub.subscription_status || "trial"}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loadingSubs && subscribers.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">👥 {t("adminPro.dash.noSubscribers")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
