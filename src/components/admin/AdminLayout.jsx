import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Users, FolderOpen, Utensils, Video, Star, ChefHat,
  UtensilsCrossed, CalendarDays, Bell, Search, PanelRightClose, PanelRightOpen,
  ChevronLeft, Apple, Columns3,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useT } from "@/i18n";
import { useToast } from "@/components/ui/use-toast";

// Emoji + lucide per nav key (emojis requested by owner for new pages)
const NAV_ICONS = {
  dashboard: LayoutDashboard,
  pipeline: Columns3,
  subscribers: Users,
  groups: FolderOpen,
  dailyPlans: CalendarDays,
  kitchens: UtensilsCrossed,
  mealItems: ChefHat,
  meals: Utensils,
  content: Video,
  testimonials: Star,
  foodDatabase: Apple,
  notifications: Bell,
};

// Sidebar sections: نظرة عامة / العمليات / المحتوى / النظام
const NAV_SECTIONS = [
  { sectionKey: "overview", items: [
    { path: "/admin", key: "dashboard" },
  ]},
  { sectionKey: "operations", items: [
    { path: "/admin/pipeline", key: "pipeline", emoji: "🧲", labelKey: "adminPro.nav.pipeline" },
    { path: "/admin/subscribers", key: "subscribers" },
    { path: "/admin/groups", key: "groups" },
    { path: "/admin/daily-plans", key: "dailyPlans" },
  ]},
  { sectionKey: "content", items: [
    { path: "/admin/content", key: "content" },
    { path: "/admin/meals", key: "meals" },
    { path: "/admin/meal-items", key: "mealItems" },
    { path: "/admin/kitchens", key: "kitchens" },
    { path: "/admin/testimonials", key: "testimonials" },
  ]},
  { sectionKey: "system", items: [
    { path: "/admin/food-database", key: "foodDatabase", emoji: "🍎", labelKey: "adminPro.nav.foodDatabase" },
    { path: "/admin/notifications", key: "notifications" },
  ]},
];

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useT();

  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const isAdmin = user?.role === "admin";

  // Role gate: non-admins are bounced back to the app with an explanation.
  useEffect(() => {
    if (user && !isAdmin) {
      toast({ title: t("admin.noAccess"), variant: "destructive" });
      navigate("/dashboard", { replace: true });
    }
  }, [user, isAdmin, navigate, toast, t]);

  // Global subscriber search (shared react-query cache with admin pages)
  const { data: subscribers = [] } = useQuery({
    queryKey: ["allSubscribers"],
    queryFn: () => base44.entities.Subscriber.list(),
    enabled: isAdmin,
  });

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return subscribers
      .filter(s =>
        s.full_name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search, subscribers]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Close mobile search dropdown on navigation
  useEffect(() => { setSearchOpen(false); setSearch(""); }, [location.pathname]);

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const resolveItem = (item) => ({
    ...item,
    icon: NAV_ICONS[item.key],
    label: item.labelKey ? t(item.labelKey) : t(`admin.nav.${item.key}`),
  });

  const currentItem = ALL_ITEMS.find(i => i.path === location.pathname)
    || (location.pathname !== "/admin" && ALL_ITEMS.find(i => i.path !== "/admin" && location.pathname.startsWith(i.path)));
  const currentLabel = currentItem ? resolveItem(currentItem).label : null;

  const renderNavItem = (rawItem, compact) => {
    const item = resolveItem(rawItem);
    const isActive = item.path === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        title={compact ? item.label : undefined}
        className={`flex items-center gap-3 ${compact ? "justify-center px-0" : "px-3"} py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {!compact && (
          <span className="truncate">
            {item.emoji && <span className="ml-1">{item.emoji}</span>}
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar — desktop */}
      <aside className={`hidden md:flex ${collapsed ? "w-[72px]" : "w-64"} bg-card border-l border-border flex-col p-3 shrink-0 transition-all duration-200 sticky top-0 h-screen`}>
        <div className={`mb-5 flex items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
          {!collapsed && (
            <div>
              <h2 className="text-lg font-bold text-foreground leading-tight">I Was Fat</h2>
              <p className="text-[11px] text-muted-foreground">{t("admin.panelTitle")}</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title={collapsed ? t("adminPro.expand") : t("adminPro.collapse")}
          >
            {collapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-4">
          {NAV_SECTIONS.map(section => (
            <div key={section.sectionKey}>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold text-muted-foreground/70">
                  {t(`adminPro.sections.${section.sectionKey}`)}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(item => renderNavItem(item, collapsed))}
              </div>
            </div>
          ))}
        </nav>

        <Link to="/dashboard" className={`mt-2 flex items-center gap-2 ${collapsed ? "justify-center" : "px-3"} py-2 text-sm text-muted-foreground hover:text-foreground transition-colors`}>
          <ChevronLeft className="w-4 h-4 rotate-180" />
          {!collapsed && t("admin.backToApp")}
        </Link>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-foreground">{t("admin.panelTitle")}</h2>
          <Link to="/dashboard" className="text-sm text-primary">{t("admin.backToApp")} ←</Link>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {ALL_ITEMS.map(rawItem => {
            const item = resolveItem(rawItem);
            const isActive = item.path === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                <item.icon className="w-3 h-3" />
                {item.emoji} {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header: breadcrumb + global search (desktop) */}
        <header className="hidden md:flex items-center justify-between gap-4 px-8 pt-5 pb-2">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link to="/admin" className="hover:text-foreground transition-colors font-medium">
              {t("adminPro.breadcrumbHome")}
            </Link>
            {currentLabel && location.pathname !== "/admin" && (
              <>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="text-foreground font-semibold">{currentLabel}</span>
              </>
            )}
          </nav>

          {/* Global subscriber search */}
          <div className="relative w-80" ref={searchRef}>
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder={t("adminPro.search.placeholder")}
              className="w-full h-9 rounded-xl border border-border bg-card pr-9 pl-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchOpen && search.trim() && (
              <div className="absolute top-11 left-0 right-0 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-40">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("adminPro.search.noResults")}</p>
                ) : (
                  <>
                    {searchResults.map(s => (
                      <button
                        key={s.id}
                        onClick={() => navigate("/admin/subscribers")}
                        className="w-full text-right px-4 py-2.5 hover:bg-secondary/60 transition-colors flex items-center gap-3"
                      >
                        <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-xs">
                          {s.full_name?.[0] || "؟"}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground truncate">{s.full_name}</span>
                          <span className="block text-xs text-muted-foreground truncate" dir="ltr">{s.email}{s.phone ? ` · ${s.phone}` : ""}</span>
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => navigate("/admin/subscribers")}
                      className="w-full text-center text-xs font-medium text-primary py-2 border-t border-border/60 hover:bg-secondary/60 transition-colors"
                    >
                      {t("adminPro.search.viewAll")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto md:p-8 md:pt-4 p-4 pt-28">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
