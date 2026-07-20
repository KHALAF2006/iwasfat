import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useT } from "@/i18n";

const COLUMNS = [
  { id: "trial", dot: "bg-amber-400" },
  { id: "active", dot: "bg-emerald-500" },
  { id: "expired", dot: "bg-orange-500" },
  { id: "cancelled", dot: "bg-slate-400" },
];

function daysRemaining(sub) {
  if (!sub.subscription_end_date) return null;
  return moment(sub.subscription_end_date).startOf("day").diff(moment().startOf("day"), "days");
}

export default function AdminPipeline() {
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Pending drop to "cancelled" awaiting confirmation: { sub, fromStatus }
  const [pendingCancel, setPendingCancel] = useState(null);

  const { data: subscribers = [], isLoading } = useQuery({
    queryKey: ["allSubscribers"],
    queryFn: () => base44.entities.Subscriber.list(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["allGroups"],
    queryFn: () => base44.entities.Group.list(),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Subscriber.update(id, { subscription_status: status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["allSubscribers"] });
      const previous = queryClient.getQueryData(["allSubscribers"]);
      queryClient.setQueryData(["allSubscribers"], (old = []) =>
        old.map(s => (s.id === id ? { ...s, subscription_status: status } : s))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["allSubscribers"], ctx.previous);
      toast({ title: t("adminPro.pipeline.moveFailed"), variant: "destructive" });
    },
    onSuccess: (_data, { id, status }) => {
      const sub = subscribers.find(s => s.id === id);
      toast({ title: t("adminPro.pipeline.moved", { name: sub?.full_name || "", status: t(`adminPro.status.${status}`) }) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["allSubscribers"] }),
  });

  const handleMove = (subId, _from, to) => {
    const sub = subscribers.find(s => s.id === subId);
    if (!sub || sub.subscription_status === to) return;
    // Moving TO cancelled is revenue-relevant → confirm first.
    if (to === "cancelled") {
      setPendingCancel({ sub, fromStatus: sub.subscription_status });
      return;
    }
    moveMutation.mutate({ id: subId, status: to });
  };

  const renderCard = (sub) => {
    const group = groups.find(g => g.id === sub.group_id);
    const days = daysRemaining(sub);
    return (
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-xs">
            {sub.full_name?.[0] || "؟"}
          </span>
          <p className="font-semibold text-sm text-foreground truncate">{sub.full_name}</p>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{group?.name || t("adminPro.pipeline.noGroup")}</span>
          <span className={`shrink-0 font-medium ${days != null && days < 0 ? "text-destructive" : days != null && days <= 7 ? "text-amber-600" : ""}`}>
            {days == null
              ? t("adminPro.pipeline.noEndDate")
              : days >= 0
                ? t("adminPro.pipeline.daysLeft", { days })
                : t("adminPro.pipeline.overdue", { days: Math.abs(days) })}
          </span>
        </div>
      </div>
    );
  };

  const columns = COLUMNS.map(col => ({
    ...col,
    title: t(`adminPro.status.${col.id}`),
    items: subscribers.filter(s => (s.subscription_status || "trial") === col.id),
  }));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">🧲 {t("adminPro.pipeline.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("adminPro.pipeline.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : (
        <KanbanBoard
          columns={columns}
          onMove={handleMove}
          renderCard={renderCard}
          getId={(s) => s.id}
          emptyText={t("adminPro.pipeline.empty")}
        />
      )}

      {/* Confirm moving a subscriber to cancelled */}
      <AlertDialog open={!!pendingCancel} onOpenChange={(v) => !v && setPendingCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminPro.pipeline.confirmCancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("adminPro.pipeline.confirmCancelBody", { name: pendingCancel?.sub?.full_name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("adminPro.pipeline.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingCancel) moveMutation.mutate({ id: pendingCancel.sub.id, status: "cancelled" });
                setPendingCancel(null);
              }}
            >
              {t("adminPro.pipeline.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
