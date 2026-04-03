import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Utensils, Edit2, Trash2, Loader2 } from "lucide-react";

const DAY_NAMES = ["", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const PLAN_TYPES = { beginner: "خطة البداية", moderate: "خطة التخفيف", maintenance: "خطة الصيانة", active_male: "خطة الرجل النشيط" };

export default function AdminMeals() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "", description: "", daily_calorie_target: 1400, plan_type: "beginner", meals: [],
  });
  const [dayForm, setDayForm] = useState({ day: 1, breakfast: "", breakfast_calories: "", lunch: "", lunch_calories: "", dinner: "", dinner_calories: "", snack: "", snack_calories: "" });

  const { data: plans = [] } = useQuery({
    queryKey: ["allMealPlans"],
    queryFn: () => base44.entities.MealPlan.list(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["allGroups"],
    queryFn: () => base44.entities.Group.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId ? base44.entities.MealPlan.update(editingId, data) : base44.entities.MealPlan.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allMealPlans"] });
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MealPlan.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allMealPlans"] }),
  });

  const resetForm = () => {
    setForm({ name: "", description: "", daily_calorie_target: 1400, plan_type: "beginner", meals: [] });
    setEditingId(null);
    setDayForm({ day: 1, breakfast: "", breakfast_calories: "", lunch: "", lunch_calories: "", dinner: "", dinner_calories: "", snack: "", snack_calories: "" });
  };

  const addDayMeal = () => {
    const newMeals = [...form.meals.filter(m => m.day !== dayForm.day), {
      ...dayForm,
      breakfast_calories: parseInt(dayForm.breakfast_calories) || 0,
      lunch_calories: parseInt(dayForm.lunch_calories) || 0,
      dinner_calories: parseInt(dayForm.dinner_calories) || 0,
      snack_calories: parseInt(dayForm.snack_calories) || 0,
    }].sort((a, b) => a.day - b.day);
    setForm(p => ({ ...p, meals: newMeals }));
    setDayForm({ day: (dayForm.day % 7) + 1, breakfast: "", breakfast_calories: "", lunch: "", lunch_calories: "", dinner: "", dinner_calories: "", snack: "", snack_calories: "" });
  };

  const handleEdit = (plan) => {
    setForm({ name: plan.name, description: plan.description || "", daily_calorie_target: plan.daily_calorie_target, plan_type: plan.plan_type || "beginner", meals: plan.meals || [] });
    setEditingId(plan.id);
    setOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">خطط الوجبات</h1>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground gap-1"><Plus className="w-4 h-4" /> خطة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل الخطة" : "إنشاء خطة وجبات جديدة"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>اسم الخطة</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" placeholder="الأسبوع الأول — بداية خفيفة" />
                </div>
                <div>
                  <Label>نوع الخطة</Label>
                  <Select value={form.plan_type} onValueChange={v => setForm(p => ({ ...p, plan_type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLAN_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>هدف السعرات اليومية</Label>
                <Input type="number" value={form.daily_calorie_target} onChange={e => setForm(p => ({ ...p, daily_calorie_target: parseInt(e.target.value) }))} className="mt-1" dir="ltr" />
              </div>

              {/* Day Meal Form */}
              <div className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">إضافة وجبات يوم</h4>
                  <Select value={String(dayForm.day)} onValueChange={v => setDayForm(p => ({ ...p, day: parseInt(v) }))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7].map(d => <SelectItem key={d} value={String(d)}>{DAY_NAMES[d]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {["breakfast", "lunch", "dinner", "snack"].map(type => (
                  <div key={type} className="grid grid-cols-3 gap-2 items-end">
                    <div className="col-span-2">
                      <Label className="text-xs">{{ breakfast: "الفطور", lunch: "الغداء", dinner: "العشاء", snack: "السناك" }[type]}</Label>
                      <Textarea value={dayForm[type]} onChange={e => setDayForm(p => ({ ...p, [type]: e.target.value }))} className="mt-1 h-16 text-sm" placeholder="وصف الوجبة..." />
                    </div>
                    <div>
                      <Label className="text-xs">سعرات</Label>
                      <Input type="number" value={dayForm[`${type}_calories`]} onChange={e => setDayForm(p => ({ ...p, [`${type}_calories`]: e.target.value }))} className="mt-1" dir="ltr" />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addDayMeal} className="w-full">إضافة يوم {DAY_NAMES[dayForm.day]}</Button>
              </div>

              {/* Added Days Preview */}
              {form.meals.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground text-sm">الأيام المضافة:</h4>
                  {form.meals.map(m => (
                    <div key={m.day} className="bg-secondary/50 rounded-lg p-3 text-sm">
                      <span className="font-medium">{DAY_NAMES[m.day]}:</span>
                      <span className="text-muted-foreground mr-2">
                        {m.breakfast_calories + m.lunch_calories + m.dinner_calories + m.snack_calories} سعرة
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={() => saveMutation.mutate({ ...form, is_active: true })} disabled={!form.name || saveMutation.isPending} className="w-full bg-primary text-primary-foreground">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "تحديث الخطة" : "حفظ وتفعيل الخطة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Plans List */}
      <div className="space-y-4">
        {plans.map(plan => (
          <div key={plan.id} className="bg-card rounded-2xl border border-border/50 p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Utensils className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{PLAN_TYPES[plan.plan_type]} — {plan.daily_calorie_target} سعرة/يوم</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(plan)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(plan.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {plan.meals?.map(m => (
                <span key={m.day} className="bg-secondary px-3 py-1 rounded-full text-xs text-muted-foreground">
                  {DAY_NAMES[m.day]}
                </span>
              ))}
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            لا توجد خطط وجبات بعد. أنشئ أول خطة!
          </div>
        )}
      </div>
    </div>
  );
}