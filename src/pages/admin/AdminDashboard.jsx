import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Users, FolderOpen, DollarSign, TrendingUp, Activity } from "lucide-react";

export default function AdminDashboard() {
  const { data: subscribers = [] } = useQuery({
    queryKey: ["allSubscribers"],
    queryFn: () => base44.entities.Subscriber.list(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["allGroups"],
    queryFn: () => base44.entities.Group.list(),
  });

  const activeCount = subscribers.filter(s => s.subscription_status === "active" || s.subscription_status === "trial").length;
  const revenue = activeCount * 199;

  const stats = [
    { icon: Users, label: "المشتركون", value: subscribers.length, color: "bg-primary/10 text-primary" },
    { icon: FolderOpen, label: "المجموعات", value: groups.length, color: "bg-accent/10 text-accent" },
    { icon: DollarSign, label: "الإيراد الشهري", value: `${revenue} ر.س`, color: "bg-primary/10 text-primary" },
    { icon: Activity, label: "نشط", value: activeCount, color: "bg-accent/10 text-accent" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-8">مرحباً بك 👋</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card rounded-2xl border border-border/50 p-5">
            <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Subscribers */}
      <div className="bg-card rounded-2xl border border-border/50 p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">أحدث المشتركين</h2>
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
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      sub.subscription_status === "active" ? "bg-primary/10 text-primary" :
                      sub.subscription_status === "trial" ? "bg-accent/10 text-accent" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {{ trial: "تجريبي", active: "نشط", expired: "منتهي", cancelled: "ملغي" }[sub.subscription_status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {subscribers.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">لا يوجد مشتركون بعد</p>
          )}
        </div>
      </div>
    </div>
  );
}