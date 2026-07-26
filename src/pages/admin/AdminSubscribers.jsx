import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format, addDays, differenceInYears, differenceInCalendarDays, parseISO } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import StatCard from "@/components/admin/StatCard";
import {
  Search, Loader2, MoreHorizontal, FileSpreadsheet, Users, UserCheck, Hourglass,
  UserX, Mars, Venus, CirclePlay, CalendarPlus, CircleX, Trash2, Phone, Mail,
} from "lucide-react";

import { useT, useLanguage } from "@/i18n";
import { useToast } from "@/components/ui/use-toast";
import { showApiError } from "@/lib/api-error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toDate = (v) => {
  if (!v) return null;
  try {
    const d = typeof v === "string" ? parseISO(v) : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const calcAge = (birthDate) => {
  const d = toDate(birthDate);
  if (!d) return null;
  const age = differenceInYears(new Date(), d);
  return age >= 0 && age < 130 ? age : null;
};

// Country codes we recognize as "already international" (GCC + Arab world).
const KNOWN_CC = [
  "966", "971", "965", "974", "973", "968", "967", "970", "962", "961", "963", "964",
  "218", "216", "213", "212", "249", "252", "253", "269", "222", "20",
];

// Normalize a stored phone (e.g. "0566627555", "+966 56 662 7555", "00966...")
// into international digits without "+" — suitable for https://wa.me/<digits>.
// Bare 0-leading numbers are assumed Saudi (966).
const normalizePhoneDigits = (phone) => {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) {
    digits = "966" + digits.slice(1);
  } else if (!KNOWN_CC.some((cc) => digits.startsWith(cc))) {
    digits = "966" + digits;
  }
  return digits;
};

// Plan row (Plan.jsonc) has no explicit duration field — derive days from the
// billing interval, falling back to matching the plan name.
const planDurationDays = (plan) => {
  if (typeof plan?.duration_days === "number" && plan.duration_days > 0) return plan.duration_days;
  if (typeof plan?.duration === "number" && plan.duration > 0) return plan.duration;
  const interval = String(plan?.interval || "").toLowerCase();
  if (interval === "quarterly") return 90;
  if (interval === "yearly" || interval === "annual") return 365;
  if (interval === "monthly") return 30;
  const name = `${plan?.name_en || ""} ${plan?.name_ar || ""}`.toLowerCase();
  if (name.includes("quarter") || name.includes("ربع")) return 90;
  if (name.includes("year") || name.includes("annual") || name.includes("سنوي") || name.includes("سنة")) return 365;
  return 30;
};

const fmtDate = (d) => (d ? format(d, "yyyy-MM-dd") : null);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminSubscribers() {
  const t = useT();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dateLocale = language === "ar" ? arLocale : enUS;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [activateFor, setActivateFor] = useState(null); // subscriber being activated
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [cancelFor, setCancelFor] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);

  const {
    data: subscribers = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["allSubscribers"],
    queryFn: () => base44.entities.Subscriber.list(),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["adminPlans"],
    queryFn: async () => {
      let rows = [];
      try {
        rows = await base44.entities.Plan.filter({ is_active: true });
      } catch {
        rows = await base44.entities.Plan.list();
      }
      return (rows || [])
        .filter((p) => p.is_active !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.price ?? 0) - (b.price ?? 0));
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["allSubscribers"] });

  // -- Mutations ------------------------------------------------------------

  const activateMutation = useMutation({
    mutationFn: async ({ subscriber, plan }) => {
      const days = planDurationDays(plan);
      const end = addDays(new Date(), days);
      const data = {
        subscription_status: "active",
        subscription_plan: plan.name_ar || plan.name_en || plan.name || "",
        subscription_end_date: fmtDate(end),
      };
      // subscription_start_date / trial_ends_at are being added by another
      // change — only write them when the record already carries the field.
      if ("subscription_start_date" in subscriber) data.subscription_start_date = fmtDate(new Date());
      if ("trial_ends_at" in subscriber) data.trial_ends_at = null;
      await base44.entities.Subscriber.update(subscriber.id, data);
      return { end };
    },
    onSuccess: ({ end }) => {
      invalidate();
      setActivateFor(null);
      setSelectedPlanId(null);
      toast({ title: t("adminSubs.activate.success", { date: fmtDate(end) }) });
    },
    onError: (err) => showApiError(err),
  });

  const extendMutation = useMutation({
    mutationFn: async (subscriber) => {
      const today = new Date();
      const currentEnd = toDate(subscriber.subscription_end_date);
      const base = currentEnd && currentEnd > today ? currentEnd : today;
      const end = addDays(base, 30);
      await base44.entities.Subscriber.update(subscriber.id, {
        subscription_status: "active",
        subscription_end_date: fmtDate(end),
      });
      return { end };
    },
    onSuccess: ({ end }) => {
      invalidate();
      toast({ title: t("adminSubs.extend.success", { date: fmtDate(end) }) });
    },
    onError: (err) => showApiError(err),
  });

  const cancelMutation = useMutation({
    mutationFn: async (subscriber) => {
      await base44.entities.Subscriber.update(subscriber.id, { subscription_status: "cancelled" });
    },
    onSuccess: () => {
      invalidate();
      setCancelFor(null);
      toast({ title: t("adminSubs.cancelSub.success") });
    },
    onError: (err) => showApiError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: async (subscriber) => {
      await base44.entities.Subscriber.delete(subscriber.id);
    },
    onSuccess: () => {
      invalidate();
      setDeleteFor(null);
      toast({ title: t("adminSubs.deleteSub.success") });
    },
    onError: (err) => showApiError(err),
  });

  // -- Derived data -----------------------------------------------------------

  const counts = useMemo(() => {
    const c = { all: subscribers.length, trial: 0, active: 0, expired: 0, cancelled: 0 };
    subscribers.forEach((s) => {
      const st = s.subscription_status || "trial";
      if (c[st] != null) c[st] += 1;
    });
    return c;
  }, [subscribers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscribers
      .filter((s) => {
        const matchSearch =
          !q ||
          s.full_name?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q);
        const matchStatus = statusFilter === "all" || (s.subscription_status || "trial") === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  }, [subscribers, search, statusFilter]);

  // -- Excel export -----------------------------------------------------------

  const exportExcel = () => {
    if (filtered.length === 0) {
      toast({ title: t("adminSubs.export.empty"), variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const H = (k) => t(`adminSubs.excel.headers.${k}`);
      const statusLabel = (st) => t(`adminSubs.status.${st || "trial"}`);
      const genderLabel = (g) => (g === "male" ? t("adminSubs.gender.male") : g === "female" ? t("adminSubs.gender.female") : "—");

      const headers = [
        H("name"), H("age"), H("gender"), H("phone"), H("email"),
        H("registeredAt"), H("status"), H("endDate"),
      ];

      const rows = filtered.map((s) => {
        const digits = normalizePhoneDigits(s.phone);
        const phoneCell = digits
          ? { t: "s", v: `+${digits}`, f: `HYPERLINK("https://wa.me/${digits}","+${digits}")` }
          : "—";
        const emailCell = s.email
          ? { t: "s", v: s.email, f: `HYPERLINK("mailto:${s.email}","${s.email}")` }
          : "—";
        const age = calcAge(s.birth_date);
        return [
          s.full_name || "—",
          age != null ? age : "—",
          genderLabel(s.gender),
          phoneCell,
          emailCell,
          fmtDate(toDate(s.created_date)) || "—",
          statusLabel(s.subscription_status),
          fmtDate(toDate(s.subscription_end_date)) || "—",
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!views"] = [{ RTL: true }];
      ws["!cols"] = [
        { wch: 24 }, // name
        { wch: 8 },  // age
        { wch: 10 }, // gender
        { wch: 20 }, // phone
        { wch: 30 }, // email
        { wch: 14 }, // registered
        { wch: 10 }, // status
        { wch: 20 }, // end date
      ];

      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, ws, "Customers");
      XLSX.writeFile(wb, `iwasfat-customers-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast({ title: t("adminSubs.export.success") });
    } catch (err) {
      console.error("Excel export failed:", err);
      toast({ title: t("adminSubs.export.error"), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // -- Renderers --------------------------------------------------------------

  const statusBadge = (st) => {
    const key = st || "trial";
    const cls = {
      trial: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      expired: "bg-red-500/10 text-red-600 border-red-500/20",
      cancelled: "bg-muted text-muted-foreground border-border",
    }[key] || "bg-muted text-muted-foreground border-border";
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
        {t(`adminSubs.status.${key}`)}
      </span>
    );
  };

  const genderCell = (g) => {
    if (g === "male")
      return (
        <span className="inline-flex items-center gap-1 text-sky-600">
          <Mars className="w-4 h-4" /> {t("adminSubs.gender.male")}
        </span>
      );
    if (g === "female")
      return (
        <span className="inline-flex items-center gap-1 text-pink-600">
          <Venus className="w-4 h-4" /> {t("adminSubs.gender.female")}
        </span>
      );
    return <span className="text-muted-foreground">—</span>;
  };

  const endDateCell = (s) => {
    const end = toDate(s.subscription_end_date);
    if (!end) return <span className="text-muted-foreground text-xs">{t("adminSubs.endDate.none")}</span>;
    const days = differenceInCalendarDays(end, new Date());
    return (
      <div className="leading-tight">
        <span className="block text-foreground" dir="ltr">{format(end, "yyyy-MM-dd")}</span>
        <span className={`block text-[11px] ${days < 0 ? "text-red-500" : days <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>
          {days < 0
            ? t("adminSubs.endDate.expiredSince", { count: Math.abs(days) })
            : t("adminSubs.endDate.daysLeft", { count: days })}
        </span>
      </div>
    );
  };

  const rowActions = (s) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("adminSubs.actions.menu")}>
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="gap-2" onClick={() => { setActivateFor(s); setSelectedPlanId(null); }}>
          <CirclePlay className="w-4 h-4 text-emerald-600" />
          {t("adminSubs.actions.activate")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          disabled={extendMutation.isPending}
          onClick={() => extendMutation.mutate(s)}
        >
          <CalendarPlus className="w-4 h-4 text-primary" />
          {t("adminSubs.actions.extend30")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onClick={() => setCancelFor(s)}>
          <CircleX className="w-4 h-4 text-amber-600" />
          {t("adminSubs.actions.cancel")}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => setDeleteFor(s)}>
          <Trash2 className="w-4 h-4" />
          {t("adminSubs.actions.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const chips = ["all", "trial", "active", "expired", "cancelled"];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("adminSubs.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("adminSubs.subtitle")}</p>
        </div>
        <Button onClick={exportExcel} disabled={exporting || isLoading} className="gap-2 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          {exporting ? t("adminSubs.export.exporting") : t("adminSubs.export.button")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label={t("adminSubs.stats.total")} value={counts.all} color="bg-primary/10 text-primary" loading={isLoading} />
        <StatCard icon={UserCheck} label={t("adminSubs.stats.active")} value={counts.active} color="bg-emerald-500/10 text-emerald-600" loading={isLoading} />
        <StatCard icon={Hourglass} label={t("adminSubs.stats.trial")} value={counts.trial} color="bg-amber-500/10 text-amber-600" loading={isLoading} />
        <StatCard icon={UserX} label={t("adminSubs.stats.expired")} value={counts.expired} color="bg-red-500/10 text-red-600" loading={isLoading} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("adminSubs.search.placeholder")}
            className="pr-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => setStatusFilter(chip)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                statusFilter === chip
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-secondary"
              }`}
            >
              {t(`adminSubs.filters.${chip}`)}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === chip ? "bg-white/20" : "bg-secondary"}`}>
                {counts[chip]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <UserX className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="font-semibold text-foreground">{t("adminSubs.error.title")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("adminSubs.error.subtitle")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-semibold text-foreground">{t("adminSubs.empty.title")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("adminSubs.empty.subtitle")}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-right p-4 font-medium text-muted-foreground">{t("adminSubs.table.name")}</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">{t("adminSubs.table.age")}</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">{t("adminSubs.table.gender")}</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">{t("adminSubs.table.phone")}</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">{t("adminSubs.table.email")}</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">{t("adminSubs.table.registeredAt")}</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">{t("adminSubs.table.status")}</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">{t("adminSubs.table.endDate")}</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">{t("adminSubs.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const age = calcAge(s.birth_date);
                    const registered = toDate(s.created_date);
                    return (
                      <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                        <td className="p-4 font-medium text-foreground">{s.full_name || "—"}</td>
                        <td className="p-4 text-muted-foreground">
                          {age != null ? `${age} ${t("adminSubs.table.yearsUnit")}` : "—"}
                        </td>
                        <td className="p-4">{genderCell(s.gender)}</td>
                        <td className="p-4 text-muted-foreground" dir="ltr">{s.phone || "—"}</td>
                        <td className="p-4 text-muted-foreground" dir="ltr">{s.email || "—"}</td>
                        <td className="p-4 text-muted-foreground whitespace-nowrap">
                          {registered ? format(registered, "d MMM yyyy", { locale: dateLocale }) : "—"}
                        </td>
                        <td className="p-4">{statusBadge(s.subscription_status)}</td>
                        <td className="p-4">{endDateCell(s)}</td>
                        <td className="p-4">{rowActions(s)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile stacked cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((s) => {
              const age = calcAge(s.birth_date);
              const registered = toDate(s.created_date);
              return (
                <div key={s.id} className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{s.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {age != null ? `${age} ${t("adminSubs.table.yearsUnit")}` : "—"} · {genderCell(s.gender)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {statusBadge(s.subscription_status)}
                      {rowActions(s)}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {s.phone && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        <span dir="ltr">{s.phone}</span>
                      </p>
                    )}
                    {s.email && (
                      <p className="flex items-center gap-2 text-muted-foreground break-all">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span dir="ltr">{s.email}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs border-t border-border/50 pt-2.5">
                    <span className="text-muted-foreground">
                      {t("adminSubs.table.registeredAt")}:{" "}
                      {registered ? format(registered, "d MMM yyyy", { locale: dateLocale }) : "—"}
                    </span>
                    {endDateCell(s)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Activate subscription dialog */}
      <Dialog open={!!activateFor} onOpenChange={(open) => { if (!open) { setActivateFor(null); setSelectedPlanId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("adminSubs.activate.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            {t("adminSubs.activate.subtitle", { name: activateFor?.full_name || "" })}
          </p>
          <div className="space-y-2 mt-2">
            <p className="text-xs font-semibold text-muted-foreground">{t("adminSubs.activate.choosePlan")}</p>
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("adminSubs.activate.noPlans")}</p>
            ) : (
              plans.map((plan) => {
                const days = planDurationDays(plan);
                const active = selectedPlanId === plan.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-right rounded-xl border p-3.5 transition-colors flex items-center justify-between gap-3 ${
                      active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">
                        {language === "ar" ? plan.name_ar || plan.name_en : plan.name_en || plan.name_ar}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {t("adminSubs.activate.days", { count: days })}
                      </span>
                    </span>
                    <span className="font-bold text-primary whitespace-nowrap">
                      {plan.price} <span className="text-xs font-medium">{t("adminSubs.activate.currency")}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              className="flex-1"
              disabled={!selectedPlanId || activateMutation.isPending}
              onClick={() => {
                const plan = plans.find((p) => p.id === selectedPlanId);
                if (plan && activateFor) activateMutation.mutate({ subscriber: activateFor, plan });
              }}
            >
              {activateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("adminSubs.activate.confirm")}
            </Button>
            <Button variant="outline" onClick={() => { setActivateFor(null); setSelectedPlanId(null); }}>
              {t("adminSubs.activate.back")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel subscription confirm */}
      <AlertDialog open={!!cancelFor} onOpenChange={(open) => !open && setCancelFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminSubs.cancelSub.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("adminSubs.cancelSub.description", { name: cancelFor?.full_name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("adminSubs.cancelSub.back")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMutation.isPending}
              onClick={(e) => { e.preventDefault(); cancelFor && cancelMutation.mutate(cancelFor); }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("adminSubs.cancelSub.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete subscriber confirm */}
      <AlertDialog open={!!deleteFor} onOpenChange={(open) => !open && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminSubs.deleteSub.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("adminSubs.deleteSub.description", { name: deleteFor?.full_name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("adminSubs.deleteSub.back")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => { e.preventDefault(); deleteFor && deleteMutation.mutate(deleteFor); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("adminSubs.deleteSub.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
