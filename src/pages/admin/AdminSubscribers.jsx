import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye, Edit2, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function AdminSubscribers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [editGroup, setEditGroup] = useState("");

  const { data: subscribers = [] } = useQuery({
    queryKey: ["allSubscribers"],
    queryFn: () => base44.entities.Subscriber.list(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["allGroups"],
    queryFn: () => base44.entities.Group.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subscriber.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allSubscribers"] });
      setSelected(null);
    },
  });

  const filtered = subscribers.filter(s => {
    const matchSearch = !search || s.full_name?.includes(search) || s.email?.includes(search);
    const matchStatus = statusFilter === "all" || s.subscription_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-6">إدارة المشتركين</h1>

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
                    <Button variant="ghost" size="icon" onClick={() => { setSelected(sub); setEditGroup(sub.group_id || ""); }}>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}