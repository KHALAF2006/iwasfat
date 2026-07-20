import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import { Home, Utensils, ShoppingCart, Camera, BarChart3, BookOpen, Users, Dumbbell, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useT } from "@/i18n";

const NAV_ICONS = {
  home: Home,
  meals: Utensils,
  shopping: ShoppingCart,
  exercise: Dumbbell,
  progress: BarChart3,
  content: BookOpen,
  group: Users,
  scanner: Camera,
};

const NAV_CONFIG = [
  { path: "/dashboard", key: "home" },
  { path: "/meals", key: "meals" },
  { path: "/shopping", key: "shopping" },
  { path: "/exercise", key: "exercise" },
  { path: "/progress", key: "progress" },
  { path: "/content", key: "content" },
  { path: "/group", key: "group" },
  { path: "/scanner", key: "scanner" },
];

export default function AppLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { subscriber, isAuthenticated, authChecked } = useAuth();
  const t = useT();

  const navItems = NAV_CONFIG.map(item => ({
    ...item,
    icon: NAV_ICONS[item.key],
    label: t(`nav.${item.key}`),
  }));

  // Onboarding gate: authenticated users without a Subscriber record
  // must complete registration before wandering the app.
  if (authChecked && isAuthenticated && subscriber === null) {
    return <Navigate to="/register" replace />;
  }

  // Show first 5 items in bottom bar, rest in drawer
  const bottomItems = navItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Outlet />

      {/* Full screen drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setMenuOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-foreground text-lg">{t("nav.allPages")}</h3>
              <button onClick={() => setMenuOpen(false)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} onClick={() => setMenuOpen(false)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    <item.icon className="w-6 h-6" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </Link>
                );
              })}
              <Link to="/profile" onClick={() => setMenuOpen(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-secondary text-muted-foreground hover:bg-secondary/80 transition-all">
                <span className="text-2xl">👤</span>
                <span className="text-xs font-medium">{t("nav.profile")}</span>
              </Link>
              <Link to="/notifications" onClick={() => setMenuOpen(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-secondary text-muted-foreground hover:bg-secondary/80 transition-all">
                <span className="text-2xl">🔔</span>
                <span className="text-xs font-medium">{t("nav.notifications")}</span>
              </Link>
              <Link to="/settings" onClick={() => setMenuOpen(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-secondary text-muted-foreground hover:bg-secondary/80 transition-all">
                <span className="text-2xl">⚙️</span>
                <span className="text-xs font-medium">{t("nav.settings")}</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Glass Bottom Navigation */}
      <nav className="fixed bottom-4 left-4 right-4 z-40">
        <div className="max-w-lg mx-auto bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl px-2 py-2">
          <div className="flex justify-around items-center">
            {bottomItems.map(item => {
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
            <button
              onClick={() => setMenuOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-all"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t("nav.more")}</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
