import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Plus, Droplet } from 'lucide-react';
import { format } from 'date-fns';

export default function DailyMealTracker({ subscriberId }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const queryClient = useQueryClient();
  const [showAddMeal, setShowAddMeal] = useState(false);

  const { data: dailyPlan } = useQuery({
    queryKey: ['dailyPlan', subscriberId, today],
    queryFn: async () => {
      const plans = await base44.entities.DailyMealPlan.filter({
        subscriber_id: subscriberId,
        date: today
      });
      return plans[0] || null;
    },
  });

  const { data: subscriber } = useQuery({
    queryKey: ['subscriber', subscriberId],
    queryFn: () => base44.entities.Subscriber.filter({ id: subscriberId }),
  });

  const addWaterMutation = useMutation({
    mutationFn: async () => {
      if (!dailyPlan) return;
      const newWaterAmount = (dailyPlan.water_consumed || 0) + 1;
      await base44.entities.DailyMealPlan.update(dailyPlan.id, {
        water_consumed: newWaterAmount
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyPlan', subscriberId, today] });
    },
  });

  const calorieTarget = subscriber?.[0]?.daily_calorie_target || 1400;
  const totalCalories = dailyPlan?.total_calories || 0;
  const waterConsumed = dailyPlan?.water_consumed || 0;
  const waterTarget = dailyPlan?.water_target || 8;
  
  const caloriePercentage = (totalCalories / calorieTarget) * 100;
  const waterPercentage = (waterConsumed / waterTarget) * 100;

  return (
    <div className="space-y-4">
      {/* السعرات الحرارية */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">السعرات الحرارية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>{totalCalories}</span>
              <span className="text-muted-foreground">من {calorieTarget}</span>
            </div>
            <Progress value={Math.min(caloriePercentage, 100)} className="h-2" />
          </div>
          <div className="text-sm text-muted-foreground">
            {totalCalories < calorieTarget 
              ? `متبقي: ${calorieTarget - totalCalories} سعرة`
              : `تجاوزت بـ: ${totalCalories - calorieTarget} سعرة ⚠️`
            }
          </div>
        </CardContent>
      </Card>

      {/* الماء */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Droplet className="w-5 h-5" />
            شرب الماء
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>{waterConsumed} أكواب</span>
              <span className="text-muted-foreground">من {waterTarget}</span>
            </div>
            <Progress value={Math.min(waterPercentage, 100)} className="h-2" />
          </div>
          <Button 
            onClick={() => addWaterMutation.mutate()}
            disabled={waterConsumed >= waterTarget}
            className="w-full"
          >
            ✓ أضفت كوب ماء
          </Button>
        </CardContent>
      </Card>

      {/* الوجبات المسجلة */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">وجباتك اليوم</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dailyPlan && ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'].map(mealSlot => {
            const meal = dailyPlan[mealSlot];
            if (!meal?.meal_name) return null;
            return (
              <div key={mealSlot} className="p-2 bg-secondary/50 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span>{meal.meal_name} ({meal.size_selected})</span>
                  <span className="font-semibold">{meal.calories} سعرة</span>
                </div>
              </div>
            );
          })}
          
          <Button 
            onClick={() => setShowAddMeal(true)}
            variant="outline"
            className="w-full mt-3"
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة وجبة
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}