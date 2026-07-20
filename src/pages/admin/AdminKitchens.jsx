import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";

const REGIONS = {
  gulf: "الخليج", levant: "الشام", egypt: "مصر",
  yemen: "اليمن", north_africa: "شمال أفريقيا", iraq: "العراق", palestine: "فلسطين"
};

const emptyForm = { name: "", name_en: "", icon: "🍽️", description: "", region: "gulf", is_active: true, sort_order: 0 };

import { useT } from "@/i18n";

export default function AdminKitchens() {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: kitchens = [] } = useQuery({
    queryKey: ["allKitchens"],
    queryFn: () => base44.entities.Kitchen.list("sort_order"),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.Kitchen.update(editingId, data)
      : base44.entities.Kitchen.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allKitchens"] });
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Kitchen.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allKitchens"] }),
  });

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const handleEdit = (k) => {
    setForm({ name: k.name, name_en: k.name_en || "", icon: k.icon, description: k.description || "", region: k.region || "gulf", is_active: k.is_active !== false, sort_order: k.sort_order || 0 });
    setEditingId(k.id);
    setOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('admin.titles.kitchens')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{kitchens.length} مطبخ مسجل</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground gap-1"><Plus className="w-4 h-4" /> مطبخ جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل المطبخ" : "إضافة مطبخ جديد"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>الأيقونة</Label>
                  <Input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} className="mt-1 text-center text-xl" />
                </div>
                <div className="col-span-2">
                  <Label>اسم المطبخ (عربي)</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" placeholder="مطبخ خليجي" />
                </div>
              </div>
              <div>
                <Label>الاسم بالإنجليزي</Label>
                <Input value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} className="mt-1" dir="ltr" placeholder="Gulf Kitchen" />
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1 h-16" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>المنطقة</Label>
                  <Select value={form.region} onValueChange={v => setForm(p => ({ ...p, region: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(REGIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ترتيب العرض</Label>
                  <Input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="mt-1" dir="ltr" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
                <Label>المطبخ نشط</Label>
              </div>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending} className="w-full bg-primary text-primary-foreground">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "تحديث" : "حفظ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kitchens.map(k => (
          <div key={k.id} className={`bg-card rounded-2xl border p-5 transition-shadow hover:shadow-md ${k.is_active ? "border-border/50" : "border-border/30 opacity-60"}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="text-4xl">{k.icon}</div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(k)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(k.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <h3 className="font-bold text-foreground">{k.name}</h3>
            {k.name_en && <p className="text-xs text-muted-foreground">{k.name_en}</p>}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{REGIONS[k.region]}</span>
              {!k.is_active && <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">غير نشط</span>}
            </div>
          </div>
        ))}
        {kitchens.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            لا توجد مطابخ بعد. أضف أول مطبخ!
          </div>
        )}
      </div>
    </div>
  );
}