import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Droplets, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

const MEALS = [
  { key: "breakfast", label: "الفطور", emoji: "🌅" },
  { key: "lunch", label: "الغداء", emoji: "☀️" },
  { key: "dinner", label: "العشاء", emoji: "🌙" },
];

export default function DailyMealTracker({ subscriberId }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);

  const { data: dailyPlan } = useQuery({
    queryKey: ['dailyPlan', subscriberId, today],
    queryFn: async () => {
      const plans = await base44.entities.DailyMealPlan.filter({ subscriber_id: subscriberId, date: today });
      return plans[0] || null;
    },
    enabled: !!subscriberId,
  });

  const toggleMealMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.DailyMealPlan.update(dailyPlan.id, { [field]: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dailyPlan', subscriberId, today] }),
  });

  const addWaterMutation = useMutation({
    mutationFn: () => base44.entities.DailyMealPlan.update(dailyPlan.id, {
      water_cups_consumed: Math.min((dailyPlan.water_cups_consumed || 0) + 1, dailyPlan.water_cups_goal || 8)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dailyPlan', subscriberId, today] }),
  });

  if (!dailyPlan) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-6 text-center">
        <p className="text-muted-foreground text-sm">لم يتم تعيين خطة وجبات لهذا اليوم بعد</p>
        <p className="text-xs text-muted-foreground mt-1">سيقوم المدير بتعيين خطتك قريباً</p>
      </div>
    );
  }

  const waterConsumed = dailyPlan.water_cups_consumed || 0;
  const waterGoal = dailyPlan.water_cups_goal || 8;
  const totalCal = dailyPlan.total_calories_goal || 1500;
  const consumedCal = (dailyPlan.breakfast_completed ? (dailyPlan.breakfast_calories || 0) : 0)
    + (dailyPlan.lunch_completed ? (dailyPlan.lunch_calories || 0) : 0)
    + (dailyPlan.dinner_completed ? (dailyPlan.dinner_calories || 0) : 0);

  return (
    <div className="space-y-4">
      {/* Progress Summary */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">خطة اليوم</h3>
          <button onClick={() => setShowDetails(!showDetails)} className="text-muted-foreground">
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">السعرات المستهلكة</span>
          <span className="font-medium">{consumedCal} / {totalCal}</span>
        </div>
        <Progress value={Math.min((consumedCal / totalCal) * 100, 100)} className="h-2 mb-4" />

        {/* Meals */}
        <div className="space-y-2">
          {MEALS.map(m => {
            const mealName = dailyPlan[`${m.key}_meal_name`];
            const mealSize = dailyPlan[`${m.key}_size`];
            const mealCal = dailyPlan[`${m.key}_calories`];
            const completed = dailyPlan[`${m.key}_completed`];
            if (!mealName) return null;
            return (
              <div key={m.key} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${completed ? "bg-primary/5" : "bg-secondary/40"}`}>
                <span className="text-lg">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${completed ? "text-primary line-through" : "text-foreground"}`}>{mealName}</p>
                  <p className="text-xs text-muted-foreground">{mealSize && `${mealSize} · `}{mealCal} سعرة</p>
                </div>
                <button
                  onClick={() => toggleMealMutation.mutate({ field: `${m.key}_completed`, value: !completed })}
                  className="shrink-0"
                >
                  {completed
                    ? <CheckCircle2 className="w-6 h-6 text-primary" />
                    : <Circle className="w-6 h-6 text-muted-foreground" />
                  }
                </button>
              </div>
            );
          })}
        </div>

        {showDetails && dailyPlan.notes && (
          <p className="text-xs text-muted-foreground mt-3 bg-secondary/30 rounded-lg p-3">{dailyPlan.notes}</p>
        )}
      </div>

      {/* Water Tracker */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-foreground">الماء</h3>
          </div>
          <span className="text-sm font-medium text-foreground">{waterConsumed}/{waterGoal} أكواب</span>
        </div>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {Array.from({ length: waterGoal }).map((_, i) => (
            <div key={i} className={`w-7 h-7 rounded-full transition-colors ${i < waterConsumed ? "bg-blue-400" : "bg-secondary"}`} />
          ))}
        </div>
        <Button
          onClick={() => addWaterMutation.mutate()}
          disabled={waterConsumed >= waterGoal || addWaterMutation.isPending}
          variant="outline"
          className="w-full text-sm"
          size="sm"
        >
          + أضفت كوب ماء
        </Button>
      </div>
    </div>
  );
}