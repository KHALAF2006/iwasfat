import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Edit2, Trash2, Loader2 } from "lucide-react";

import { useT } from "@/i18n";

export default function AdminGroups() {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", max_members: 20 });
  const [editingId, setEditingId] = useState(null);

  const { data: groups = [] } = useQuery({
    queryKey: ["allGroups"],
    queryFn: () => base44.entities.Group.list(),
  });

  const { data: subscribers = [] } = useQuery({
    queryKey: ["allSubscribers"],
    queryFn: () => base44.entities.Subscriber.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.Group.update(editingId, data)
      : base44.entities.Group.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allGroups"] });
      setOpen(false);
      setForm({ name: "", description: "", max_members: 20 });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Group.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allGroups"] }),
  });

  const handleEdit = (group) => {
    setForm({ name: group.name, description: group.description || "", max_members: group.max_members || 20 });
    setEditingId(group.id);
    setOpen(true);
  };

  const getGroupMemberCount = (groupId) => {
    return subscribers.filter(s => s.group_id === groupId).length;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">{t('admin.titles.groups')}</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm({ name: "", description: "", max_members: 20 }); } }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground gap-1"><Plus className="w-4 h-4" /> مجموعة جديدة</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل المجموعة" : "إنشاء مجموعة جديدة"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>اسم المجموعة</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" placeholder="مثال: مجموعة البداية" />
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1" placeholder="وصف المجموعة..." />
              </div>
              <div>
                <Label>الحد الأقصى للأعضاء</Label>
                <Input type="number" value={form.max_members} onChange={e => setForm(p => ({ ...p, max_members: parseInt(e.target.value) }))} className="mt-1" dir="ltr" />
              </div>
              <Button onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending} className="w-full bg-primary text-primary-foreground">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "تحديث" : "إنشاء"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map(group => (
          <div key={group.id} className="bg-card rounded-2xl border border-border/50 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(group)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(group.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">{group.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{group.description || "بدون وصف"}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{getGroupMemberCount(group.id)} / {group.max_members} عضو</span>
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            لا توجد مجموعات بعد. أنشئ أول مجموعة!
          </div>
        )}
      </div>
    </div>
  );
}