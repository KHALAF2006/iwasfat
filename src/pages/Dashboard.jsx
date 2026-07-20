import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Utensils, Video, Users, BarChart3, Droplets, ArrowLeft, Bell, ShoppingCart, Dumbbell, Settings, Camera, Plus } from "lucide-react";
import CalorieRing from "../components/app/CalorieRing";
import StatsPanel from "../components/app/StatsPanel";
import moment from "moment";
import { useT, useLanguage } from "@/i18n";
import { suggestDailyTargets, calculateWaterGoal } from "@/lib/nutrition/engine";
import { buildEngineProfile } from "../components/meals/conditions";

export default function Dashboard() {
  const t = useT();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
  });

  const { data: unreadNotifs = [] } = useQuery({
    queryKey: ["unreadNotifs", subscriber?.id],
    queryFn: () => base44.entities.Notification.filter({ subscriber_id: subscriber?.id, is_read: false }),
    enabled: !!subscriber,
  });

  const today = moment().format("YYYY-MM-DD");

  const { data: todayLogs = [] } = useQuery({
    queryKey: ["foodLogs", today],
    queryFn: () => base44.entities.FoodLog.filter({ date: today, subscriber_id: subscriber?.id }),
    enabled: !!subscriber,
  });

  const { data: latestWeight } = useQuery({
    queryKey: ["latestWeight"],
    queryFn: async () => {
      const logs = await base44.entities.WeightLog.filter({ subscriber_id: subscriber?.id }, "-date", 1);
      return logs[0] || null;
    },
    enabled: !!subscriber,
  });

  const { data: dailyPlan } = useQuery({
    queryKey: ["dailyPlan", subscriber?.id, today],
    queryFn: () => base44.entities.DailyMealPlan.filter({ subscriber_id: subscriber?.id, date: today }).then(r => r[0] || null),
    enabled: !!subscriber,
  });

  const totalCalories = todayLogs.reduce((sum, log) => sum + (log.calories || 0), 0);

  // Engine-driven targets (safe floors, activity, chronic conditions),
  // falling back to the values stored on the subscriber / plan entities.
  const profile = buildEngineProfile(subscriber);
  const engineTargets = profile ? suggestDailyTargets(profile) : null;
  const calorieTarget =
    engineTargets?.target_calories || subscriber?.daily_calorie_target || 1500;
  const waterGoal =
    (profile ? calculateWaterGoal(profile).cups : null) ||
    dailyPlan?.water_cups_goal ||
    8;
  // Single source of truth for water: DailyMealPlan.water_cups_consumed.
  const totalWater = dailyPlan?.water_cups_consumed || 0;
  const currentWeight = latestWeight?.weight || subscriber?.current_weight;

  const addWaterMutation = useMutation({
    mutationFn: async () => {
      if (!dailyPlan) {
        await base44.entities.DailyMealPlan.create({
          subscriber_id: subscriber.id,
          date: today,
          water_cups_goal: waterGoal,
          water_cups_consumed: 1,
        });
        return;
      }
      await base44.entities.DailyMealPlan.update(dailyPlan.id, {
        water_cups_consumed: Math.min(totalWater + 1, waterGoal),
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dailyPlan", subscriber?.id, today] }),
  });

  const locale = language === "ar" ? "ar-SA" : "en-US";
  const dayName = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date());
  const dateStr = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date());

  const firstName = subscriber?.full_name?.split(" ")[0];

  const quickLinks = [
    { icon: Utensils, label: t("dashboard.quickLinks.meals"), path: "/meals", color: "bg-primary/10 text-primary" },
    { icon: ShoppingCart, label: t("dashboard.quickLinks.shopping"), path: "/shopping", color: "bg-accent/10 text-accent" },
    { icon: Dumbbell, label: t("dashboard.quickLinks.exercise"), path: "/exercise", color: "bg-primary/10 text-primary" },
    { icon: BarChart3, label: t("dashboard.quickLinks.progress"), path: "/progress", color: "bg-accent/10 text-accent" },
    { icon: Video, label: t("dashboard.quickLinks.content"), path: "/content", color: "bg-primary/10 text-primary" },
    { icon: Users, label: t("dashboard.quickLinks.group"), path: "/group", color: "bg-accent/10 text-accent" },
    { icon: Camera, label: t("dashboard.quickLinks.scanner"), path: "/scanner", color: "bg-primary/10 text-primary" },
    { icon: Settings, label: t("dashboard.quickLinks.settings"), path: "/settings", color: "bg-accent/10 text-accent" },
  ];

  const planMeals = dailyPlan ? [
    { key: "breakfast", emoji: "🌅", name: dailyPlan.breakfast_meal_name, cal: dailyPlan.breakfast_calories, done: dailyPlan.breakfast_completed },
    { key: "lunch", emoji: "☀️", name: dailyPlan.lunch_meal_name, cal: dailyPlan.lunch_calories, done: dailyPlan.lunch_completed },
    { key: "dinner", emoji: "🌙", name: dailyPlan.dinner_meal_name, cal: dailyPlan.dinner_calories, done: dailyPlan.dinner_completed },
  ].filter(m => m.name) : [];

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {firstName ? t("dashboard.greeting", { name: firstName }) : t("dashboard.greetingFallback")}
          </h1>
          <p className="text-muted-foreground text-sm">{dayName}، {dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/notifications" className="relative">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </div>
            {unreadNotifs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadNotifs.length > 9 ? "9+" : unreadNotifs.length}
              </span>
            )}
          </Link>
          <Link to="/profile">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">
                {subscriber?.full_name?.[0] || "👤"}
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Calorie Ring */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 mb-6 flex flex-col items-center">
        <CalorieRing consumed={totalCalories} target={calorieTarget} weight={currentWeight} />
        <div className="flex gap-8 mt-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t("dashboard.remaining")}</p>
            <p className="font-bold text-primary">{Math.max(0, calorieTarget - totalCalories)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t("dashboard.goal")}</p>
            <p className="font-bold text-foreground">{calorieTarget}</p>
          </div>
          <button
            type="button"
            onClick={() => subscriber && addWaterMutation.mutate()}
            disabled={!subscriber || addWaterMutation.isPending || totalWater >= waterGoal}
            className="text-center flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-secondary transition-colors disabled:opacity-60"
            title={t("components.tracker.addWater")}
          >
            <Droplets className="w-3 h-3 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.water")}</p>
              <p className="font-bold text-foreground flex items-center gap-1">
                {totalWater}/{waterGoal} {t("common.cup")}
                <Plus className="w-3 h-3 text-blue-500" />
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Daily Meal Plan */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{t("dashboard.todaysPlan")}</h3>
          <Link to="/meals" className="text-sm text-primary flex items-center gap-1">
            {t("dashboard.details")} <ArrowLeft className="w-3 h-3 rtl:rotate-0 ltr:rotate-180" />
          </Link>
        </div>
        {dailyPlan ? (
          <div className="space-y-2">
            {planMeals.map(m => (
              <Link key={m.key} to={`/meals?log=${m.key}`} className="block">
                <div className={`flex items-center justify-between p-3 rounded-xl transition-colors hover:ring-1 hover:ring-primary/40 ${m.done ? "bg-primary/5" : "bg-secondary/40"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{m.emoji}</span>
                    <div>
                      <p className={`text-sm font-medium ${m.done ? "text-primary line-through" : "text-foreground"}`}>{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.cal} {t("common.cal")}</p>
                    </div>
                  </div>
                  {m.done && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t("dashboard.done")}</span>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {["breakfast", "lunch", "dinner", "snack"].map(type => {
              const logged = todayLogs.find(l => l.meal_type === type);
              return (
                <Link key={type} to={`/meals?log=${type}`} className="text-center">
                  <div className={`w-12 h-12 rounded-xl mx-auto flex items-center justify-center mb-1 ${logged ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    <Utensils className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-muted-foreground">{t(`dashboard.mealTypes.${type}`)}</p>
                  {logged && <p className="text-[10px] text-primary font-medium">{logged.calories} {t("common.cal")}</p>}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Panel */}
      {subscriber && <StatsPanel subscriberId={subscriber.id} />}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        {quickLinks.map((link, i) => (
          <Link key={i} to={link.path}>
            <div className="bg-card rounded-2xl border border-border/50 p-5 hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-xl ${link.color} flex items-center justify-center mb-3`}>
                <link.icon className="w-5 h-5" />
              </div>
              <p className="font-medium text-foreground text-sm">{link.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
