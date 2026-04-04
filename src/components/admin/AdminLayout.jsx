import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, FolderOpen, Utensils, Video, Star, ChefHat, UtensilsCrossed } from "lucide-react";

const navItems = [
  { path: "/admin", icon: LayoutDashboard, label: "لوحة التحكم" },
  { path: "/admin/subscribers", icon: Users, label: "المشتركون" },
  { path: "/admin/groups", icon: FolderOpen, label: "المجموعات" },
  { path: "/admin/kitchens", icon: UtensilsCrossed, label: "المطابخ" },
  { path: "/admin/meal-items", icon: ChefHat, label: "الوجبات" },
  { path: "/admin/meals", icon: Utensils, label: "خطط الوجبات" },
  { path: "/admin/content", icon: Video, label: "المحتوى" },
  { path: "/admin/testimonials", icon: Star, label: "قصص النجاح" },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-64 bg-card border-l border-border flex-col p-4 shrink-0">
        <div className="mb-8 px-3">
          <h2 className="text-xl font-bold text-foreground">I Was Fat</h2>
          <p className="text-xs text-muted-foreground">لوحة تحكم المدير</p>
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link to="/dashboard" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← العودة للتطبيق
        </Link>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-foreground">لوحة التحكم</h2>
          <Link to="/dashboard" className="text-sm text-primary">التطبيق ←</Link>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                <item.icon className="w-3 h-3" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:p-8 p-4 pt-24 md:pt-8">
        <Outlet />
      </main>
    </div>
  );
}