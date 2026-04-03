import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Utensils, ShoppingCart, Camera, BarChart3, BookOpen, Users } from "lucide-react";

const navItems = [
  { path: "/dashboard", icon: Home, label: "الرئيسية" },
  { path: "/meals", icon: Utensils, label: "الوجبات" },
  { path: "/shopping", icon: ShoppingCart, label: "التسوق" },
  { path: "/scanner", icon: Camera, label: "المسح" },
  { path: "/progress", icon: BarChart3, label: "التقدم" },
  { path: "/content", icon: BookOpen, label: "المحتوى" },
  { path: "/group", icon: Users, label: "مجموعتي" },
];

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />

      {/* Glass Bottom Navigation */}
      <nav className="fixed bottom-4 left-4 right-4 z-50">
        <div className="max-w-lg mx-auto bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl px-2 py-2">
          <div className="flex justify-around items-center">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}