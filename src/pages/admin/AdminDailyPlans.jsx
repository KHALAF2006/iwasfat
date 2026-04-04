import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Calendar, Loader2, Search, ChevronDown, ChevronUp } from "lucide-react";
import moment from "moment";

const MEAL_TYPES = [
  { key: "breakfast", label: "الفطور", color: "bg-orange-100 text-orange-700" },
  { key: "lunch", label: "الغداء", color: "bg-green-100 text-green-700" },
  { key: "dinner", label: "العشاء", color: "bg-blue-100 text-blue-700" },
];

export default function AdminDailyPlans() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [expandedSub, setExpandedSub] = useState(null);
  const [form, setForm] = useState({
    subscriber_id: "",
    date: moment().format("YYYY-MM-DD"),
    breakfast_meal_id: "",
    breakfast_meal_name: "",
    breakfast_size: "",
    breakfast_calories: 0,
    lunch_meal_id: "",
    lunch_meal_name: "",
    lunch_size: "",
    lunch_calories: 0,
    dinner_meal_id: "",
    dinner_meal_name: "",
    dinner_size: "",
    dinner_calories: 0,
    water_cups_goal: 8,
    total_calories_goal: 1500,
    notes: "",
  });

  const { data: subscribers = [] } = useQuery({
    queryKey: ["allSubscribers"],
    queryFn: () => base44.entities.Subscriber.list(),
  });

  const { data: meals = [] } = useQuery({
    queryKey: ["allActiveMeals"],
    queryFn: () => base44.entities.Meal.filter({ is_active: true }),
  });

  const { data: dailyPlans = [] } = useQuery({
    queryKey: ["allDailyPlans", selectedDate],
    queryFn: () => base44.entities.DailyMealPlan.filter({ date: selectedDate }),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.DailyMealPlan.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allDailyPlans"] });
      setOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setForm({
      subscriber_id: "", date: moment().format("YYYY-MM-DD"),
      breakfast_meal_id: "", breakfast_meal_name: "", breakfast_size: "", breakfast_calories: 0,
      lunch_meal_id: "", lunch_meal_name: "", lunch_size: "", lunch_calories: 0,
      dinner_meal_id: "", dinner_meal_name: "", dinner_size: "", dinner_calories: 0,
      water_cups_goal: 8, total_calories_goal: 1500, notes: "",
    });
  };

  const handleMealSelect = (mealType, mealId) => {
    const meal = meals.find(m => m.id === mealId);
    if (!meal) return;
    const defaultSize = meal.sizes?.find(s => s.is_default) || meal.sizes?.[0];
    setForm(p => ({
      ...p,
      [`${mealType}_meal_id`]: mealId,
      [`${mealType}_meal_name`]: meal.name,
      [`${mealType}_size`]: defaultSize?.size_name || "",
      [`${mealType}_calories`]: defaultSize?.calories || 0,
    }));
  };

  const filteredSubscribers = subscribers.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Group plans by subscriber for selected date
  const plansBySubscriber = dailyPlans.reduce((acc, plan) => {
    acc[plan.subscriber_id] = plan;
    return acc;
  }, {});

  const subscribersWithPlans = subscribers.filter(s => plansBySubscriber[s.id]);
  const subscribersWithoutPlans = subscribers.filter(s => !plansBySubscriber[s.id]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الخطط اليومية</h1>
          <p className="text-muted-foreground text-sm mt-1">تعيين وجبات يومية للمشتركين</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-44"
            dir="ltr"
          />
          <Button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground gap-1 whitespace-nowrap">
            <Plus className="w-4 h-4" /> إضافة خطة
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
          <p className="text-2xl font-bold text-primary">{dailyPlans.length}</p>
          <p className="text-xs text-muted-foreground">خطة مُعيَّنة</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{subscribers.length}</p>
          <p className="text-xs text-muted-foreground">إجمالي المشتركين</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
          <p className="text-2xl font-bold text-accent">{subscribersWithoutPlans.length}</p>
          <p className="text-xs text-muted-foreground">بدون خطة</p>
        </div>
      </div>

      {/* Plans for selected date */}
      <div className="space-y-3 mb-6">
        <h3 className="font-semibold text-foreground">
          المشتركون الذين لهم خطة — {moment(selectedDate).format("DD/MM/YYYY")}
        </h3>
        {subscribersWithPlans.length === 0 && (
          <div className="bg-card rounded-2xl border border-border/50 p-8 text-center text-muted-foreground">
            لا توجد خطط لهذا اليوم
          </div>
        )}
        {subscribersWithPlans.map(sub => {
          const plan = plansBySubscriber[sub.id];
          const isExpanded = expandedSub === sub.id;
          return (
            <div key={sub.id} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                onClick={() => setExpandedSub(isExpanded ? null : sub.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-sm">{sub.full_name?.[0]}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground text-sm">{sub.full_name}</p>
                    <p className="text-xs text-muted-foreground">{plan.total_calories_goal} سعرة مستهدفة</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex gap-1">
                    {MEAL_TYPES.map(mt => (
                      plan[`${mt.key}_meal_name`] && (
                        <span key={mt.key} className={`text-xs px-2 py-0.5 rounded-full ${mt.color}`}>
                          {mt.label}
                        </span>
                      )
                    ))}
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-border/50 px-4 pb-4">
                  <div className="grid sm:grid-cols-3 gap-3 mt-3">
                    {MEAL_TYPES.map(mt => (
                      <div key={mt.key} className="bg-secondary/40 rounded-xl p-3">
                        <p className={`text-xs font-medium mb-1 px-2 py-0.5 rounded-full inline-block ${mt.color}`}>{mt.label}</p>
                        <p className="text-sm font-semibold text-foreground">{plan[`${mt.key}_meal_name`] || "—"}</p>
                        {plan[`${mt.key}_size`] && <p className="text-xs text-muted-foreground">{plan[`${mt.key}_size`]}</p>}
                        {plan[`${mt.key}_calories`] > 0 && <p className="text-xs text-primary font-medium">{plan[`${mt.key}_calories`]} سعرة</p>}
                      </div>
                    ))}
                  </div>
                  {plan.notes && (
                    <p className="text-sm text-muted-foreground mt-3 bg-secondary/30 rounded-lg p-3">{plan.notes}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Subscribers without plans */}
      {subscribersWithoutPlans.length > 0 && (
        <div>
          <h3 className="font-semibold text-foreground mb-3 text-destructive/70">
            مشتركون بدون خطة ({subscribersWithoutPlans.length})
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subscribersWithoutPlans.map(sub => (
              <div key={sub.id} className="bg-card rounded-2xl border border-border/50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-muted-foreground font-medium text-xs">{sub.full_name?.[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{sub.full_name}</p>
                    <p className="text-xs text-muted-foreground">{sub.daily_calorie_target} سعرة</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => {
                    setForm(p => ({ ...p, subscriber_id: sub.id, total_calories_goal: sub.daily_calorie_target || 1500 }));
                    setOpen(true);
                  }}
                >
                  + خطة
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة خطة وجبات يومية</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Subscriber + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>المشترك</Label>
                <Select value={form.subscriber_id} onValueChange={v => {
                  const sub = subscribers.find(s => s.id === v);
                  setForm(p => ({ ...p, subscriber_id: v, total_calories_goal: sub?.daily_calorie_target || 1500 }));
                }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="اختر المشترك" /></SelectTrigger>
                  <SelectContent>
                    {subscribers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>التاريخ</Label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="mt-1" dir="ltr" />
              </div>
            </div>

            {/* Meals */}
            {MEAL_TYPES.map(mt => (
              <div key={mt.key} className="border border-border rounded-xl p-4 space-y-2">
                <h4 className="font-semibold text-foreground text-sm">{mt.label}</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">اختر الوجبة</Label>
                    <Select
                      value={form[`${mt.key}_meal_id`]}
                      onValueChange={v => handleMealSelect(mt.key, v)}
                    >
                      <SelectTrigger className="mt-1 text-sm h-9"><SelectValue placeholder="اختر وجبة..." /></SelectTrigger>
                      <SelectContent>
                        {meals
                          .filter(m => m.meal_type === mt.key || m.meal_type === "snack")
                          .map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">الحجم</Label>
                    {form[`${mt.key}_meal_id`] && meals.find(m => m.id === form[`${mt.key}_meal_id`])?.sizes?.length > 0 ? (
                      <Select
                        value={form[`${mt.key}_size`]}
                        onValueChange={v => {
                          const meal = meals.find(m => m.id === form[`${mt.key}_meal_id`]);
                          const size = meal?.sizes?.find(s => s.size_name === v);
                          setForm(p => ({ ...p, [`${mt.key}_size`]: v, [`${mt.key}_calories`]: size?.calories || 0 }));
                        }}
                      >
                        <SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {meals.find(m => m.id === form[`${mt.key}_meal_id`])?.sizes?.map(s => (
                            <SelectItem key={s.size_name} value={s.size_name}>{s.size_name} ({s.calories} سعرة)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="الحجم"
                        value={form[`${mt.key}_size`]}
                        onChange={e => setForm(p => ({ ...p, [`${mt.key}_size`]: e.target.value }))}
                        className="mt-1 h-9 text-sm"
                      />
                    )}
                  </div>
                </div>
                {form[`${mt.key}_meal_name`] && (
                  <p className="text-xs text-primary">✓ {form[`${mt.key}_meal_name`]} — {form[`${mt.key}_calories`]} سعرة</p>
                )}
              </div>
            ))}

            {/* Goals */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>هدف السعرات</Label>
                <Input type="number" value={form.total_calories_goal} onChange={e => setForm(p => ({ ...p, total_calories_goal: parseInt(e.target.value) }))} className="mt-1" dir="ltr" />
              </div>
              <div>
                <Label>هدف الماء (أكواب)</Label>
                <Input type="number" value={form.water_cups_goal} onChange={e => setForm(p => ({ ...p, water_cups_goal: parseInt(e.target.value) }))} className="mt-1" dir="ltr" />
              </div>
            </div>

            <div>
              <Label>ملاحظات</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="mt-1" placeholder="ملاحظات اختيارية للمشترك..." />
            </div>

            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.subscriber_id || saveMutation.isPending}
              className="w-full bg-primary text-primary-foreground"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ الخطة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}