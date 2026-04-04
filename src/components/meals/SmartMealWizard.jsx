import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const MEAL_TYPES = [
  { value: "breakfast", label: "🌅 الفطور" },
  { value: "lunch", label: "☀️ الغداء" },
  { value: "dinner", label: "🌙 العشاء" },
  { value: "snack", label: "🍎 سناك" },
];

export default function SmartMealWizard({ open, onClose, subscriberId }) {
  const [mealType, setMealType] = useState("");
  const [selectedMealId, setSelectedMealId] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: meals = [] } = useQuery({
    queryKey: ['activeMeals'],
    queryFn: () => base44.entities.Meal.filter({ is_active: true }),
    enabled: open,
  });

  const filteredMeals = meals.filter(m => !mealType || m.meal_type === mealType || m.meal_type === "snack");
  const selectedMeal = meals.find(m => m.id === selectedMealId);
  const selectedSizeData = selectedMeal?.sizes?.find(s => s.size_name === selectedSize);

  const logMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.FoodLog.create({
        subscriber_id: subscriberId,
        date: today,
        meal_type: mealType,
        followed_plan: false,
        actual_food: `${selectedMeal.name} (${selectedSize})`,
        calories: selectedSizeData?.calories || 0,
        protein: selectedSizeData?.protein || 0,
        carbs: selectedSizeData?.carbs || 0,
        fat: selectedSizeData?.fat || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foodLogs'] });
      queryClient.invalidateQueries({ queryKey: ['dailyPlan'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setMealType("");
    setSelectedMealId("");
    setSelectedSize("");
    onClose();
  };

  const canSubmit = mealType && selectedMealId && selectedSize;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تسجيل وجبة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Meal Type */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">نوع الوجبة</label>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map(mt => (
                <button
                  key={mt.value}
                  onClick={() => { setMealType(mt.value); setSelectedMealId(""); setSelectedSize(""); }}
                  className={`p-3 rounded-xl border text-sm font-medium transition-colors ${
                    mealType === mt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  {mt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Meal */}
          {mealType && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الوجبة</label>
              <Select value={selectedMealId} onValueChange={v => { setSelectedMealId(v); setSelectedSize(""); }}>
                <SelectTrigger><SelectValue placeholder="اختر وجبة..." /></SelectTrigger>
                <SelectContent>
                  {filteredMeals.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Size */}
          {selectedMeal?.sizes?.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الحجم</label>
              <div className="grid grid-cols-2 gap-2">
                {selectedMeal.sizes.map(s => (
                  <button
                    key={s.size_name}
                    onClick={() => setSelectedSize(s.size_name)}
                    className={`p-3 rounded-xl border text-sm transition-colors ${
                      selectedSize === s.size_name
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <p className="font-medium">{s.size_name}</p>
                    <p className="text-xs text-muted-foreground">{s.calories} سعرة</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {selectedSizeData && (
            <div className="bg-primary/5 rounded-xl p-4">
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div><p className="text-lg font-bold text-primary">{selectedSizeData.calories}</p><p className="text-xs text-muted-foreground">سعرة</p></div>
                <div><p className="text-lg font-bold text-foreground">{selectedSizeData.protein || 0}g</p><p className="text-xs text-muted-foreground">بروتين</p></div>
                <div><p className="text-lg font-bold text-foreground">{selectedSizeData.carbs || 0}g</p><p className="text-xs text-muted-foreground">كارب</p></div>
                <div><p className="text-lg font-bold text-foreground">{selectedSizeData.fat || 0}g</p><p className="text-xs text-muted-foreground">دهون</p></div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">إلغاء</Button>
            <Button
              onClick={() => logMutation.mutate()}
              disabled={!canSubmit || logMutation.isPending}
              className="flex-1 bg-primary text-primary-foreground"
            >
              {logMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "تسجيل الوجبة"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}