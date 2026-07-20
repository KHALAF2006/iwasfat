import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Edit2, Loader2, UserPlus, Download } from "lucide-react";
import { Label } from "@/components/ui/label";

import { useT } from "@/i18n";

export default function AdminSubscribers() {
  const t = useT();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [editGroup, setEditGroup] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const exportPDF = async () => {
    setExportingPDF(true);
    const response = await base44.functions.invoke('exportSubscribersPDF', {});
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscribers-report-${new Date().toISOString().split('T')[0]}-en.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setExportingPDF(false);
  };

  const { data: subscribers = [] } = useQuery({
    queryKey: ["allSubscribers"],
    queryFn: () => base44.entities.Subscriber.list(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["allGroups"],
    queryFn: () => base44.entities.Group.list(),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.Subscriber.update(id, data);
      // Audit trail: record admin status changes
      if (data.subscription_status && data.subscription_status !== selected?.subscription_status_original) {
        try {
          const me = await base44.auth.me();
          await base44.entities.AuditLog.create({
            actor_email: me?.email || "admin",
            action: "subscriber.status_change",
            target_type: "Subscriber",
            target_id: id,
            meta: {
              from: selected?.subscription_status_original,
              to: data.subscription_status,
            },
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error("Audit log failed:", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allSubscribers"] });
      queryClient.invalidateQueries({ queryKey: ["auditLog"] });
      setSelected(null);
    },
  });

  // Latest 20 audit events for the subscriber open in the edit dialog
  const { data: auditEvents = [] } = useQuery({
    queryKey: ["auditLog", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const rows = await base44.entities.AuditLog.filter({ target_id: selected.id });
      return rows
        .sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date))
        .slice(0, 20);
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviteLoading(true);
    await base44.users.inviteUser(inviteEmail, "user");
    setInviteEmail("");
    setInviteLoading(false);
  };

  const filtered = subscribers.filter(s => {
    const matchSearch = !search || s.full_name?.includes(search) || s.email?.includes(search);
    const matchStatus = statusFilter === "all" || s.subscription_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-3xl font-bold text-foreground">{t('admin.titles.subscribers')}</h1>
        <div className="flex gap-2">
          <Button onClick={exportPDF} disabled={exportingPDF} variant="outline" className="gap-2 whitespace-nowrap">
            {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            تصدير PDF (إنجليزي)
          </Button>
          <Input
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="ايميل المشترك الجديد"
            className="w-52"
            dir="ltr"
            onKeyDown={e => e.key === "Enter" && handleInvite()}
          />
          <Button onClick={handleInvite} disabled={inviteLoading || !inviteEmail} className="gap-1 whitespace-nowrap">
            {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            دعوة
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو البريد..." className="pr-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="trial">تجريبي</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="expired">منتهي</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-right p-4 font-medium text-muted-foreground">الاسم</th>
                <th className="text-right p-4 font-medium text-muted-foreground">البريد</th>
                <th className="text-right p-4 font-medium text-muted-foreground">الوزن</th>
                <th className="text-right p-4 font-medium text-muted-foreground">BMI</th>
                <th className="text-right p-4 font-medium text-muted-foreground">المجموعة</th>
                <th className="text-right p-4 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right p-4 font-medium text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => (
                <tr key={sub.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="p-4 font-medium text-foreground">{sub.full_name}</td>
                  <td className="p-4 text-muted-foreground">{sub.email}</td>
                  <td className="p-4">{sub.current_weight} → {sub.target_weight} كغ</td>
                  <td className="p-4">{sub.bmi}</td>
                  <td className="p-4 text-muted-foreground">{groups.find(g => g.id === sub.group_id)?.name || "—"}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      sub.subscription_status === "active" ? "bg-primary/10 text-primary" :
                      sub.subscription_status === "trial" ? "bg-accent/10 text-accent" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {{ trial: "تجريبي", active: "نشط", expired: "منتهي", cancelled: "ملغي" }[sub.subscription_status]}
                    </span>
                  </td>
                  <td className="p-4">
                    <Button variant="ghost" size="icon" onClick={() => { setSelected({ ...sub, subscription_status_original: sub.subscription_status }); setEditGroup(sub.group_id || ""); }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل مشترك: {selected?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الحالة</Label>
              <Select value={selected?.subscription_status} onValueChange={v => setSelected(p => ({ ...p, subscription_status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">تجريبي</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="expired">منتهي</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المجموعة</Label>
              <Select value={editGroup} onValueChange={setEditGroup}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر مجموعة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مجموعة</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => updateMutation.mutate({ id: selected.id, data: { subscription_status: selected.subscription_status, group_id: editGroup === "none" ? "" : editGroup } })}
              disabled={updateMutation.isPending}
              className="w-full bg-primary text-primary-foreground"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
            </Button>

            {/* Audit trail — latest 20 events for this subscriber */}
            <div className="border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground mb-2">سجل الأحداث (آخر 20)</p>
              {auditEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد أحداث مسجلة بعد</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {auditEvents.map((ev) => (
                    <div key={ev.id} className="text-xs bg-secondary/40 rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{ev.action}</span>
                        <span className="text-muted-foreground whitespace-nowrap" dir="ltr">
                          {ev.created_at ? new Date(ev.created_at).toLocaleString("ar-SA") : ""}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5" dir="ltr">{ev.actor_email}</p>
                      {ev.meta && Object.keys(ev.meta).length > 0 && (
                        <p className="text-muted-foreground mt-0.5 break-all" dir="ltr">
                          {JSON.stringify(ev.meta)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}