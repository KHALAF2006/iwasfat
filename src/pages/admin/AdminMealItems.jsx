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
import { Plus, Utensils, Edit2, Trash2, Loader2, AlertTriangle, Search } from "lucide-react";

const MEAL_TYPES = { breakfast: "فطور", lunch: "غداء", dinner: "عشاء", snack: "سناك" };
const WARNING_LABELS = {
  warning_diabetes: { label: "سكري", color: "bg-yellow-100 text-yellow-700" },
  warning_blood_pressure: { label: "ضغط", color: "bg-red-100 text-red-700" },
  warning_cholesterol: { label: "كوليسترول", color: "bg-orange-100 text-orange-700" },
  warning_kidney_disease: { label: "كلى", color: "bg-purple-100 text-purple-700" },
};

const emptyForm = {
  name: "", name_en: "", kitchen_id: "", meal_type: "lunch", description: "", dietary_notes: "",
  preparation_tips: "", seasons: ["all"], is_active: true,
  warning_diabetes: false, warning_blood_pressure: false, warning_cholesterol: false, warning_kidney_disease: false,
  sizes: [{ size_name: "حصة عادية", calories: 0, protein: 0, carbs: 0, fat: 0, is_default: true }],
};

export default function AdminMealItems() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterKitchen, setFilterKitchen] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const { data: meals = [] } = useQuery({
    queryKey: ["allMealItems"],
    queryFn: () => base44.entities.Meal.list(),
  });

  const { data: kitchens = [] } = useQuery({
    queryKey: ["allKitchens"],
    queryFn: () => base44.entities.Kitchen.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.Meal.update(editingId, data)
      : base44.entities.Meal.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allMealItems"] });
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Meal.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allMealItems"] }),
  });

  const toggleWarning = useMutation({
    mutationFn: ({ id, field, val }) => base44.entities.Meal.update(id, { [field]: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allMealItems"] }),
  });

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const handleEdit = (meal) => {
    setForm({
      name: meal.name, name_en: meal.name_en || "", kitchen_id: meal.kitchen_id, meal_type: meal.meal_type,
      description: meal.description || "", dietary_notes: meal.dietary_notes || "",
      preparation_tips: meal.preparation_tips || "", seasons: meal.seasons || ["all"],
      is_active: meal.is_active !== false,
      warning_diabetes: meal.warning_diabetes || false,
      warning_blood_pressure: meal.warning_blood_pressure || false,
      warning_cholesterol: meal.warning_cholesterol || false,
      warning_kidney_disease: meal.warning_kidney_disease || false,
      sizes: meal.sizes || [{ size_name: "حصة عادية", calories: 0, protein: 0, carbs: 0, fat: 0, is_default: true }],
    });
    setEditingId(meal.id);
    setOpen(true);
  };

  const updateSize = (idx, field, value) => {
    const newSizes = [...form.sizes];
    newSizes[idx] = { ...newSizes[idx], [field]: field === "size_name" ? value : parseFloat(value) || 0 };
    setForm(p => ({ ...p, sizes: newSizes }));
  };

  const addSize = () => setForm(p => ({ ...p, sizes: [...p.sizes, { size_name: "", calories: 0, protein: 0, carbs: 0, fat: 0, is_default: false }] }));
  const removeSize = (idx) => setForm(p => ({ ...p, sizes: p.sizes.filter((_, i) => i !== idx) }));

  const filtered = meals.filter(m => {
    const matchSearch = !search || m.name?.includes(search) || m.name_en?.toLowerCase().includes(search.toLowerCase());
    const matchKitchen = filterKitchen === "all" || m.kitchen_id === filterKitchen;
    const matchType = filterType === "all" || m.meal_type === filterType;
    return matchSearch && matchKitchen && matchType;
  });

  const getKitchenName = (id) => kitchens.find(k => k.id === id)?.name || "—";

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الوجبات</h1>
          <p className="text-muted-foreground text-sm mt-1">{meals.length} وجبة مسجلة</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground gap-1"><Plus className="w-4 h-4" /> وجبة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل الوجبة" : "إضافة وجبة جديدة"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>اسم الوجبة (عربي)</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>الاسم (إنجليزي)</Label>
                  <Input value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} className="mt-1" dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>المطبخ</Label>
                  <Select value={form.kitchen_id} onValueChange={v => setForm(p => ({ ...p, kitchen_id: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="اختر مطبخ" /></SelectTrigger>
                    <SelectContent>
                      {kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.icon} {k.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نوع الوجبة</Label>
                  <Select value={form.meal_type} onValueChange={v => setForm(p => ({ ...p, meal_type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MEAL_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1 h-16" />
              </div>
              <div>
                <Label>ملاحظات غذائية</Label>
                <Input value={form.dietary_notes} onChange={e => setForm(p => ({ ...p, dietary_notes: e.target.value }))} className="mt-1" />
              </div>

              {/* Sizes */}
              <div className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">الأحجام والسعرات</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addSize}><Plus className="w-3 h-3 ml-1" /> إضافة حجم</Button>
                </div>
                {form.sizes.map((size, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2 items-end">
                    <div className="col-span-2">
                      <Label className="text-xs">الحجم</Label>
                      <Input value={size.size_name} onChange={e => updateSize(idx, "size_name", e.target.value)} className="mt-0.5 h-8 text-sm" placeholder="حصة عادية" />
                    </div>
                    <div>
                      <Label className="text-xs">سعرات</Label>
                      <Input type="number" value={size.calories} onChange={e => updateSize(idx, "calories", e.target.value)} className="mt-0.5 h-8 text-sm" dir="ltr" />
                    </div>
                    <div>
                      <Label className="text-xs">بروتين</Label>
                      <Input type="number" value={size.protein} onChange={e => updateSize(idx, "protein", e.target.value)} className="mt-0.5 h-8 text-sm" dir="ltr" />
                    </div>
                    <div>
                      <Label className="text-xs">كارب</Label>
                      <Input type="number" value={size.carbs} onChange={e => updateSize(idx, "carbs", e.target.value)} className="mt-0.5 h-8 text-sm" dir="ltr" />
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <Label className="text-xs">دهون</Label>
                        <Input type="number" value={size.fat} onChange={e => updateSize(idx, "fat", e.target.value)} className="mt-0.5 h-8 text-sm" dir="ltr" />
                      </div>
                      {form.sizes.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeSize(idx)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              <div className="border border-border rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" /> تحذيرات الأمراض المزمنة
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(WARNING_LABELS).map(([field, { label }]) => (
                    <div key={field} className="flex items-center gap-2">
                      <Switch checked={form[field]} onCheckedChange={v => setForm(p => ({ ...p, [field]: v }))} />
                      <Label className="text-sm">تحذير {label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
                <Label>الوجبة نشطة</Label>
              </div>

              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.kitchen_id || saveMutation.isPending} className="w-full bg-primary text-primary-foreground">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "تحديث الوجبة" : "حفظ الوجبة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في الوجبات..." className="pr-9" />
        </div>
        <Select value={filterKitchen} onValueChange={setFilterKitchen}>
          <SelectTrigger className="w-40"><SelectValue placeholder="المطبخ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المطابخ</SelectItem>
            {kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.icon} {k.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {Object.entries(MEAL_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Meals List */}
      <div className="space-y-3">
        {filtered.map(meal => {
          const activeWarnings = Object.entries(WARNING_LABELS).filter(([field]) => meal[field]);
          return (
            <div key={meal.id} className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Utensils className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground">{meal.name}</h3>
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{MEAL_TYPES[meal.meal_type]}</span>
                      <span className="text-xs text-muted-foreground">{getKitchenName(meal.kitchen_id)}</span>
                      {!meal.is_active && <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">غير نشط</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{meal.description || "—"}</p>
                    {/* Sizes summary */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {meal.sizes?.map((s, i) => (
                        <span key={i} className="text-xs bg-secondary rounded-lg px-2 py-1">
                          {s.size_name}: <strong>{s.calories}</strong> سعرة
                        </span>
                      ))}
                    </div>
                    {/* Warnings */}
                    {activeWarnings.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5" />
                        {activeWarnings.map(([field, { label, color }]) => (
                          <span key={field} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(meal)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(meal.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Quick warning toggles */}
              <div className="border-t border-border/50 mt-3 pt-3 flex flex-wrap gap-4">
                {Object.entries(WARNING_LABELS).map(([field, { label }]) => (
                  <div key={field} className="flex items-center gap-1.5 text-xs">
                    <Switch
                      checked={meal[field] || false}
                      onCheckedChange={v => toggleWarning.mutate({ id: meal.id, field, val: v })}
                      className="scale-75"
                    />
                    <span className="text-muted-foreground">تحذير {label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {meals.length === 0 ? "لا توجد وجبات بعد. أضف أول وجبة!" : "لا توجد نتائج للبحث"}
          </div>
        )}
      </div>
    </div>
  );
}