import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Utensils, Video, Users, BarChart3, Droplets, ArrowLeft, Bell, ShoppingCart, Dumbbell, Settings, Camera } from "lucide-react";
import CalorieRing from "../components/app/CalorieRing";
import StatsPanel from "../components/app/StatsPanel";
import moment from "moment";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

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
  const totalWater = todayLogs.reduce((sum, log) => sum + (log.water_cups || 0), 0);
  const calorieTarget = subscriber?.daily_calorie_target || 1500;
  const currentWeight = latestWeight?.weight || subscriber?.current_weight;

  const dayName = new Intl.DateTimeFormat("ar-SA", { weekday: "long" }).format(new Date());
  const dateStr = new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long" }).format(new Date());

  const quickLinks = [
    { icon: Utensils, label: "خطة وجباتي", path: "/meals", color: "bg-primary/10 text-primary" },
    { icon: ShoppingCart, label: "قائمة التسوق", path: "/shopping", color: "bg-accent/10 text-accent" },
    { icon: Dumbbell, label: "تسجيل تمرين", path: "/exercise", color: "bg-primary/10 text-primary" },
    { icon: BarChart3, label: "تتبع التقدم", path: "/progress", color: "bg-accent/10 text-accent" },
    { icon: Video, label: "المحتوى", path: "/content", color: "bg-primary/10 text-primary" },
    { icon: Users, label: "مجموعتي", path: "/group", color: "bg-accent/10 text-accent" },
    { icon: Camera, label: "تحليل وجبة", path: "/scanner", color: "bg-primary/10 text-primary" },
    { icon: Settings, label: "الإعدادات", path: "/settings", color: "bg-accent/10 text-accent" },
  ];

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            أهلاً {subscriber?.full_name?.split(" ")[0] || "بك"} 👋
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
                {subscriber?.full_name?.[0] || "م"}
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
            <p className="text-xs text-muted-foreground">المتبقي</p>
            <p className="font-bold text-primary">{Math.max(0, calorieTarget - totalCalories)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">الهدف</p>
            <p className="font-bold text-foreground">{calorieTarget}</p>
          </div>
          <div className="text-center flex items-center gap-1">
            <Droplets className="w-3 h-3 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">ماء</p>
              <p className="font-bold text-foreground">{totalWater} كوب</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Meal Plan */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">خطة وجبات اليوم</h3>
          <Link to="/meals" className="text-sm text-primary flex items-center gap-1">
            التفاصيل <ArrowLeft className="w-3 h-3" />
          </Link>
        </div>
        {dailyPlan ? (
          <div className="space-y-2">
            {[
              { key: "breakfast", label: "🌅 فطور", name: dailyPlan.breakfast_meal_name, cal: dailyPlan.breakfast_calories, done: dailyPlan.breakfast_completed },
              { key: "lunch", label: "☀️ غداء", name: dailyPlan.lunch_meal_name, cal: dailyPlan.lunch_calories, done: dailyPlan.lunch_completed },
              { key: "dinner", label: "🌙 عشاء", name: dailyPlan.dinner_meal_name, cal: dailyPlan.dinner_calories, done: dailyPlan.dinner_completed },
            ].filter(m => m.name).map(m => (
              <div key={m.key} className={`flex items-center justify-between p-3 rounded-xl ${m.done ? "bg-primary/5" : "bg-secondary/40"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{m.label.split(" ")[0]}</span>
                  <div>
                    <p className={`text-sm font-medium ${m.done ? "text-primary line-through" : "text-foreground"}`}>{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.cal} سعرة</p>
                  </div>
                </div>
                {m.done && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">✓ تم</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {["breakfast", "lunch", "dinner", "snack"].map(type => {
              const logged = todayLogs.find(l => l.meal_type === type);
              const labels = { breakfast: "فطور", lunch: "غداء", dinner: "عشاء", snack: "سناك" };
              return (
                <Link key={type} to={`/meals?log=${type}`} className="text-center">
                  <div className={`w-12 h-12 rounded-xl mx-auto flex items-center justify-center mb-1 ${logged ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    <Utensils className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-muted-foreground">{labels[type]}</p>
                  {logged && <p className="text-[10px] text-primary font-medium">{logged.calories} سعرة</p>}
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