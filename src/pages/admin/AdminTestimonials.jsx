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
import { Plus, Star, Edit2, Trash2, Loader2, TrendingDown } from "lucide-react";

export default function AdminTestimonials() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "", name_en: "", gender: "female", age: "", start_weight: "", current_weight: "",
    weight_lost: "", duration_weeks: "", kitchen_preference: "", quote: "", quote_en: "",
    rating: 5, is_featured: false, is_published: true,
  });

  const { data: testimonials = [] } = useQuery({
    queryKey: ["allTestimonials"],
    queryFn: () => base44.entities.Testimonial.list("-created_date"),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.Testimonial.update(editingId, data)
      : base44.entities.Testimonial.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allTestimonials"] });
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Testimonial.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allTestimonials"] }),
  });

  const toggleFeatured = useMutation({
    mutationFn: ({ id, val }) => base44.entities.Testimonial.update(id, { is_featured: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allTestimonials"] }),
  });

  const togglePublished = useMutation({
    mutationFn: ({ id, val }) => base44.entities.Testimonial.update(id, { is_published: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allTestimonials"] }),
  });

  const resetForm = () => {
    setForm({ name: "", name_en: "", gender: "female", age: "", start_weight: "", current_weight: "", weight_lost: "", duration_weeks: "", kitchen_preference: "", quote: "", quote_en: "", rating: 5, is_featured: false, is_published: true });
    setEditingId(null);
  };

  const handleEdit = (t) => {
    setForm({ name: t.name, name_en: t.name_en || "", gender: t.gender || "female", age: t.age || "", start_weight: t.start_weight || "", current_weight: t.current_weight || "", weight_lost: t.weight_lost || "", duration_weeks: t.duration_weeks || "", kitchen_preference: t.kitchen_preference || "", quote: t.quote, quote_en: t.quote_en || "", rating: t.rating || 5, is_featured: t.is_featured || false, is_published: t.is_published !== false });
    setEditingId(t.id);
    setOpen(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      age: form.age ? parseInt(form.age) : undefined,
      start_weight: form.start_weight ? parseFloat(form.start_weight) : undefined,
      current_weight: form.current_weight ? parseFloat(form.current_weight) : undefined,
      weight_lost: form.weight_lost ? parseFloat(form.weight_lost) : undefined,
      duration_weeks: form.duration_weeks ? parseInt(form.duration_weeks) : undefined,
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">قصص النجاح</h1>
          <p className="text-muted-foreground text-sm mt-1">{testimonials.filter(t => t.is_published).length} منشور · {testimonials.filter(t => t.is_featured).length} مميز</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground gap-1"><Plus className="w-4 h-4" /> إضافة قصة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل القصة" : "إضافة قصة نجاح جديدة"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الاسم بالعربي</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" placeholder="سارة م." />
                </div>
                <div>
                  <Label>الاسم بالإنجليزي</Label>
                  <Input value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} className="mt-1" placeholder="Sara M." dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>الجنس</Label>
                  <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">أنثى</SelectItem>
                      <SelectItem value="male">ذكر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>العمر</Label>
                  <Input type="number" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} className="mt-1" dir="ltr" placeholder="29" />
                </div>
                <div>
                  <Label>مدة البرنامج (أسبوع)</Label>
                  <Input type="number" value={form.duration_weeks} onChange={e => setForm(p => ({ ...p, duration_weeks: e.target.value }))} className="mt-1" dir="ltr" placeholder="12" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>الوزن البدائي (كغ)</Label>
                  <Input type="number" value={form.start_weight} onChange={e => setForm(p => ({ ...p, start_weight: e.target.value }))} className="mt-1" dir="ltr" />
                </div>
                <div>
                  <Label>الوزن الحالي (كغ)</Label>
                  <Input type="number" value={form.current_weight} onChange={e => setForm(p => ({ ...p, current_weight: e.target.value }))} className="mt-1" dir="ltr" />
                </div>
                <div>
                  <Label>الوزن المفقود (كغ)</Label>
                  <Input type="number" value={form.weight_lost} onChange={e => setForm(p => ({ ...p, weight_lost: e.target.value }))} className="mt-1" dir="ltr" />
                </div>
              </div>
              <div>
                <Label>تفضيل المطبخ</Label>
                <Input value={form.kitchen_preference} onChange={e => setForm(p => ({ ...p, kitchen_preference: e.target.value }))} className="mt-1" placeholder="مطبخ خليجي" />
              </div>
              <div>
                <Label>الاقتباس بالعربي</Label>
                <Textarea value={form.quote} onChange={e => setForm(p => ({ ...p, quote: e.target.value }))} className="mt-1" rows={3} placeholder="تجربتي مع التطبيق..." />
              </div>
              <div>
                <Label>الاقتباس بالإنجليزي</Label>
                <Textarea value={form.quote_en} onChange={e => setForm(p => ({ ...p, quote_en: e.target.value }))} className="mt-1" rows={3} dir="ltr" />
              </div>
              <div>
                <Label>التقييم</Label>
                <div className="flex gap-2 mt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setForm(p => ({ ...p, rating: n }))}>
                      <Star className={`w-6 h-6 ${n <= form.rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_featured} onCheckedChange={v => setForm(p => ({ ...p, is_featured: v }))} />
                  <Label>مميز (يظهر في الصفحة الرئيسية)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_published} onCheckedChange={v => setForm(p => ({ ...p, is_published: v }))} />
                  <Label>منشور</Label>
                </div>
              </div>
              <Button onClick={handleSave} disabled={!form.name || !form.quote || saveMutation.isPending} className="w-full bg-primary text-primary-foreground">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "تحديث" : "حفظ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map(t => (
          <div key={t.id} className="bg-card rounded-2xl border border-border/50 p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground">{t.name}</p>
                  {t.is_featured && <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">مميز</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t.kitchen_preference} · {t.duration_weeks} أسبوع</p>
              </div>
              <div className="flex items-center gap-1 bg-accent/10 rounded-lg px-2 py-1">
                <TrendingDown className="w-3 h-3 text-accent" />
                <span className="text-sm font-bold text-accent">-{t.weight_lost} كغ</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.quote}"</p>

            <div className="flex gap-1 mb-1">
              {Array.from({ length: t.rating || 5 }).map((_, j) => (
                <Star key={j} className="w-3 h-3 fill-accent text-accent" />
              ))}
            </div>

            <div className="border-t border-border/50 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Switch
                    checked={t.is_featured || false}
                    onCheckedChange={v => toggleFeatured.mutate({ id: t.id, val: v })}
                    className="scale-75"
                  />
                  <span>مميز</span>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={t.is_published !== false}
                    onCheckedChange={v => togglePublished.mutate({ id: t.id, val: v })}
                    className="scale-75"
                  />
                  <span>منشور</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {testimonials.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            لا توجد قصص نجاح بعد. أضف أول قصة!
          </div>
        )}
      </div>
    </div>
  );
}