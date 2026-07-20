import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Search, Database, CheckCircle2, FolderTree, Loader2, Rocket, ChevronLeft, ChevronRight } from "lucide-react";
import StatCard from "@/components/admin/StatCard";
import { useToast } from "@/components/ui/use-toast";
import { useT } from "@/i18n";

const BATCH_SIZE = 200;
const PAGE_SIZE = 50;

export default function AdminFoodDatabase() {
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bundle, setBundle] = useState(null); // cached food_db.json module
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState(null); // {created, updated, skipped}

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["allFoodItems"],
    queryFn: () => base44.entities.FoodItem.list("-created_date", 10000),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name_ar?.toLowerCase().includes(q) ||
      i.name_en?.toLowerCase().includes(q) ||
      i.external_id?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeCount = items.filter(i => i.is_active !== false).length;
  const categoriesUsed = new Set(items.map(i => i.category).filter(Boolean)).size;

  const openImportConfirm = async () => {
    // Load the bundled DB lazily so we can show the real item count in the dialog.
    if (!bundle) {
      const mod = await import("@/data/food_db.json");
      setBundle(mod.default);
    }
    setConfirmOpen(true);
  };

  const runImport = async () => {
    setConfirmOpen(false);
    setSummary(null);
    try {
      const mod = bundle || (await import("@/data/food_db.json")).default;
      const all = mod.items || [];
      const batches = [];
      for (let i = 0; i < all.length; i += BATCH_SIZE) batches.push(all.slice(i, i + BATCH_SIZE));

      setImporting(true);
      setProgress({ done: 0, total: all.length });

      const totals = { created: 0, updated: 0, skipped: 0 };
      for (let b = 0; b < batches.length; b++) {
        try {
          // The function expects the raw generator shape (id, protein_g, ...);
          // it maps id→external_id and mirrors legacy fields server-side.
          const res = await base44.functions.invoke("importFoodDatabase", { items: batches[b] });
          const data = res?.data ?? res;
          totals.created += data.created || 0;
          totals.updated += data.updated || 0;
          totals.skipped += data.skipped || 0;
        } catch (err) {
          toast({ title: t("adminPro.foodDb.importFailed", { batch: b + 1 }), variant: "destructive" });
          setImporting(false);
          queryClient.invalidateQueries({ queryKey: ["allFoodItems"] });
          return;
        }
        setProgress({ done: Math.min(all.length, (b + 1) * BATCH_SIZE), total: all.length });
      }
      setSummary(totals);
      toast({ title: t("adminPro.foodDb.result", totals) });
    } finally {
      setImporting(false);
      queryClient.invalidateQueries({ queryKey: ["allFoodItems"] });
    }
  };

  const bundleCount = bundle?.items?.length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("adminPro.foodDb.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("adminPro.foodDb.subtitle")}</p>
        </div>
        <Button onClick={openImportConfirm} disabled={importing} className="gap-2 whitespace-nowrap">
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
          {t("adminPro.foodDb.importBtn")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={Database} label={t("adminPro.foodDb.totalItems")} value={items.length} loading={isLoading} />
        <StatCard icon={CheckCircle2} label={t("adminPro.foodDb.activeItems")} value={activeCount} loading={isLoading} color="bg-emerald-500/10 text-emerald-600" />
        <StatCard icon={FolderTree} label={t("adminPro.foodDb.categoriesUsed")} value={categoriesUsed} loading={isLoading} color="bg-accent/10 text-accent" />
      </div>

      {/* Import progress / summary */}
      {importing && (
        <div className="bg-card rounded-2xl border border-primary/30 p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              {t("adminPro.foodDb.importing")}
            </p>
            <p className="text-sm text-muted-foreground" dir="ltr">
              {t("adminPro.foodDb.progress", { done: progress.done, total: progress.total })}
            </p>
          </div>
          <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} className="h-2.5" />
        </div>
      )}
      {summary && !importing && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-6 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {t("adminPro.foodDb.result", summary)}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={t("adminPro.foodDb.searchPlaceholder")}
          className="pr-9"
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-right p-3 font-medium text-muted-foreground">{t("adminPro.foodDb.name")}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">{t("adminPro.foodDb.category")}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">{t("adminPro.foodDb.portion")}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">{t("adminPro.foodDb.calories")}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">{t("adminPro.foodDb.protein")}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">{t("adminPro.foodDb.carbs")}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">{t("adminPro.foodDb.fat")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td colSpan={7} className="p-3"><Skeleton className="h-5 w-full" /></td>
                    </tr>
                  ))
                : pageItems.map(item => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="p-3">
                        <p className="font-medium text-foreground">{item.name_ar}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{item.name_en}</p>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs" dir="ltr">{item.category || "—"}</td>
                      <td className="p-3 text-muted-foreground text-xs">{item.serving_desc_ar || item.portion || "—"}</td>
                      <td className="p-3 font-medium text-foreground">{item.calories}</td>
                      <td className="p-3">{item.protein_g ?? item.protein ?? "—"}</td>
                      <td className="p-3">{item.carbs_g ?? item.carbs ?? "—"}</td>
                      <td className="p-3">{item.fat_g ?? item.fat ?? "—"}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!isLoading && filtered.length === 0 && (
            <p className="text-center py-12 text-muted-foreground">{t("adminPro.foodDb.empty")}</p>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              {t("adminPro.foodDb.showing", {
                from: (safePage - 1) * PAGE_SIZE + 1,
                to: Math.min(safePage * PAGE_SIZE, filtered.length),
                total: filtered.length,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} className="gap-1">
                <ChevronRight className="w-4 h-4" />
                {t("adminPro.foodDb.prev")}
              </Button>
              <span className="text-xs text-muted-foreground" dir="ltr">{safePage} / {pageCount}</span>
              <Button variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage(p => p + 1)} className="gap-1">
                {t("adminPro.foodDb.next")}
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Import confirm (idempotent upsert) */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminPro.foodDb.importConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("adminPro.foodDb.importConfirmBody", { count: bundleCount ? bundleCount.toLocaleString() : "5,179" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("adminPro.foodDb.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={runImport}>{t("adminPro.foodDb.importStart")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
