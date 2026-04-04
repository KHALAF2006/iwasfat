import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MealWarnings from './MealWarnings';

export default function MealSelector({ kitchenId, mealType, onSelectMeal }) {
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [showSizeInfo, setShowSizeInfo] = useState(false);

  const { data: meals, isLoading } = useQuery({
    queryKey: ['meals', kitchenId, mealType],
    queryFn: () => base44.entities.Meal.filter({ 
      kitchen_id: kitchenId, 
      meal_type: mealType,
      is_active: true 
    }),
    enabled: !!kitchenId && !!mealType,
  });

  const handleSizeSelect = (size) => {
    setSelectedSize(size);
    if (selectedMeal) {
      onSelectMeal({
        meal: selectedMeal,
        size: size,
        calories: size.calories,
        protein: size.protein,
        carbs: size.carbs,
        fat: size.fat
      });
    }
  };

  if (isLoading) return <div className="text-center py-4">جاري البحث عن الوجبات...</div>;
  if (!meals?.length) return <div className="text-center py-4 text-muted-foreground">لا توجد وجبات متاحة</div>;

  if (!selectedMeal) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-foreground">اختر الوجبة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {meals.map(meal => (
            <Card 
              key={meal.id} 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedMeal(meal)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{meal.name}</CardTitle>
                {meal.dietary_notes && (
                  <p className="text-xs text-muted-foreground">{meal.dietary_notes}</p>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button 
        variant="outline" 
        onClick={() => setSelectedMeal(null)}
        className="w-full"
      >
        ← اختر وجبة مختلفة
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{selectedMeal.name}</CardTitle>
          {selectedMeal.description && (
            <p className="text-sm text-muted-foreground mt-2">{selectedMeal.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">اختر الحجم</h4>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowSizeInfo(true)}
                className="h-8 w-8 p-0"
              >
                <Info className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {selectedMeal.sizes.map((size, idx) => (
                <Button
                  key={idx}
                  onClick={() => handleSizeSelect(size)}
                  variant={selectedSize?.size_name === size.size_name ? 'default' : 'outline'}
                  className="w-full justify-between text-right"
                >
                  <span className="text-muted-foreground text-sm">{size.calories} سعرة</span>
                  <span>{size.size_name}</span>
                </Button>
              ))}
            </div>

            {selectedSize && (
              <div className="bg-accent/10 p-3 rounded-lg space-y-2">
                <h5 className="font-semibold text-sm">المعلومات الغذائية</h5>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>🔥 سعرات: {selectedSize.calories}</div>
                  <div>💪 بروتين: {selectedSize.protein || 'غ.م'}غ</div>
                  <div>🌾 كربوهيدرات: {selectedSize.carbs || 'غ.م'}غ</div>
                  <div>🥑 دهون: {selectedSize.fat || 'غ.م'}غ</div>
                </div>
              </div>
            )}
            <MealWarnings meal={selectedMeal} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSizeInfo} onOpenChange={setShowSizeInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🤔 كيف تعرف الحجم؟</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold mb-1">100غ دجاج</p>
              <p className="text-muted-foreground">حجم كف يدك (بدون أصابع)</p>
            </div>
            <div>
              <p className="font-semibold mb-1">200غ دجاج</p>
              <p className="text-muted-foreground">حجم قبضتك كاملة</p>
            </div>
            <div>
              <p className="font-semibold mb-1">كوب رز مطبوخ</p>
              <p className="text-muted-foreground">حجم قبضة مغلقة</p>
            </div>
            <div>
              <p className="font-semibold mb-1">صحن صغير</p>
              <p className="text-muted-foreground">نصف طبق الأكل العادي</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}