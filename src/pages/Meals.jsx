import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Utensils, Plus, Camera, Check, Loader2 } from "lucide-react";
import moment from "moment";

const MEAL_LABELS = { breakfast: "الفطور", lunch: "الغداء", dinner: "العشاء", snack: "السناك" };
const MEAL_TIMES = { breakfast: "٨:٠٠ ص", lunch: "١٢:٣٠ م", dinner: "٧:٠٠ م", snack: "٤:٠٠ م" };

export default function Meals() {
  const queryClient = useQueryClient();
  const [logDialog, setLogDialog] = useState(null);
  const [logForm, setLogForm] = useState({ followed_plan: true, actual_food: "", calories: "", water_cups: "", notes: "" });
  const today = moment().format("YYYY-MM-DD");

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ["foodLogs", today],
    queryFn: () => base44.entities.FoodLog.filter({ date: today, subscriber_id: subscriber?.id }),
    enabled: !!subscriber,
  });

  const { data: mealPlans = [] } = useQuery({
    queryKey: ["mealPlans"],
    queryFn: () => base44.entities.MealPlan.filter({ is_active: true }),
  });

  const currentPlan = mealPlans[0];
  const dayOfWeek = new Date().getDay() || 7;
  const todayMeals = currentPlan?.meals?.find(m => m.day === dayOfWeek) || {};

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.FoodLog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foodLogs"] });
      setLogDialog(null);
    },
  });

  const handleSaveLog = () => {
    saveMutation.mutate({
      subscriber_id: subscriber?.id,
      date: today,
      meal_type: logDialog,
      followed_plan: logForm.followed_plan,
      actual_food: logForm.actual_food,
      calories: parseFloat(logForm.calories) || 0,
      water_cups: parseFloat(logForm.water_cups) || 0,
      notes: logForm.notes,
    });
  };

  const mealTypes = ["breakfast", "lunch", "dinner", "snack"];

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">خطة وجباتي اليوم</h1>
      <p className="text-muted-foreground text-sm mb-6">
        {currentPlan ? currentPlan.name : "لا توجد خطة وجبات حالياً"}
      </p>

      <div className="space-y-4">
        {mealTypes.map(type => {
          const logged = todayLogs.find(l => l.meal_type === type);
          const plannedMeal = todayMeals[type] || "";
          const plannedCalories = todayMeals[`${type}_calories`] || 0;

          return (
            <div key={type} className={`bg-card rounded-2xl border ${logged ? "border-primary/30" : "border-border/50"} p-5 transition-all`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${logged ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    {logged ? <Check className="w-5 h-5" /> : <Utensils className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{MEAL_LABELS[type]}</h3>
                    <p className="text-xs text-muted-foreground">{MEAL_TIMES[type]}</p>
                  </div>
                </div>
                {plannedCalories > 0 && (
                  <span className="text-xs bg-secondary px-2 py-1 rounded-full text-muted-foreground">{plannedCalories} سعرة</span>
                )}
              </div>

              {plannedMeal && (
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{plannedMeal}</p>
              )}

              {logged ? (
                <div className="bg-primary/5 rounded-lg p-3 text-sm">
                  <p className="text-foreground">{logged.actual_food || "اتبعت الخطة"}</p>
                  <p className="text-primary font-medium mt-1">{logged.calories} سعرة</p>
                </div>
              ) : (
                <Button
                  onClick={() => {
                    setLogForm({ followed_plan: true, actual_food: plannedMeal, calories: String(plannedCalories || ""), water_cups: "", notes: "" });
                    setLogDialog(type);
                  }}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Plus className="w-4 h-4" /> سجّل وجبتي
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Log Dialog */}
      <Dialog open={!!logDialog} onOpenChange={() => setLogDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل {MEAL_LABELS[logDialog]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>اتبعت الخطة المقترحة؟</Label>
              <Switch checked={logForm.followed_plan} onCheckedChange={v => setLogForm(p => ({ ...p, followed_plan: v }))} />
            </div>
            <div>
              <Label>ماذا أكلت فعلاً؟</Label>
              <Textarea value={logForm.actual_food} onChange={e => setLogForm(p => ({ ...p, actual_food: e.target.value }))} className="mt-1.5" placeholder="اكتب ما أكلته..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>السعرات</Label>
                <Input type="number" value={logForm.calories} onChange={e => setLogForm(p => ({ ...p, calories: e.target.value }))} className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>أكواب الماء</Label>
                <Input type="number" value={logForm.water_cups} onChange={e => setLogForm(p => ({ ...p, water_cups: e.target.value }))} className="mt-1.5" dir="ltr" />
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Input value={logForm.notes} onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} className="mt-1.5" />
            </div>
            <Button onClick={handleSaveLog} disabled={saveMutation.isPending} className="w-full bg-primary text-primary-foreground py-5 gap-2">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ الوجبة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}