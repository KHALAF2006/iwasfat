import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Wand2 } from 'lucide-react';

export default function ManualMealEntry({ isOpen, onClose, onSubmit }) {
  const [mealDesc, setMealDesc] = useState('');
  const [quantity, setQuantity] = useState('');
  const [cookingMethod, setCookingMethod] = useState('');
  const [manualCalories, setManualCalories] = useState('');

  const estimateCaloriesMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('estimateMealCalories', {
        meal_description: mealDesc,
        quantity: quantity,
        cooking_method: cookingMethod || ''
      });
      return response.data.estimation;
    },
    onSuccess: (data) => {
      setManualCalories(data.calories.toString());
    }
  });

  const handleSubmit = () => {
    if (!mealDesc || !manualCalories) return;
    
    onSubmit({
      meal_name: mealDesc,
      calories: parseInt(manualCalories),
      size_selected: quantity || 'حصة واحدة',
      quantity_details: {
        quantity,
        cooking_method
      }
    });

    setMealDesc('');
    setQuantity('');
    setCookingMethod('');
    setManualCalories('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>إضافة وجبة يدويًا</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">ماذا أكلت؟</label>
            <Textarea
              value={mealDesc}
              onChange={e => setMealDesc(e.target.value)}
              placeholder="مثال: صدر دجاج مع سلطة وخبز أسمر"
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">الكمية</label>
              <Input
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="مثال: 200غ، حصتان"
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">طريقة الطهي</label>
              <select 
                value={cookingMethod}
                onChange={e => setCookingMethod(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-border rounded-md text-sm"
              >
                <option value="">اختر...</option>
                <option value="مشوي">مشوي</option>
                <option value="مسلوق">مسلوق</option>
                <option value="مقلي">مقلي</option>
                <option value="خام">خام</option>
                <option value="مطهي">مطهي</option>
              </select>
            </div>
          </div>

          {/* عرض السعرات المتوقعة */}
          {estimateCaloriesMutation.data && (
            <Card className="bg-accent/10">
              <CardContent className="pt-4">
                <h4 className="font-semibold text-sm mb-2">التقدير الذكي:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">السعرات</p>
                    <p className="text-lg font-bold">{estimateCaloriesMutation.data.calories}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">درجة الثقة</p>
                    <p className="text-sm">
                      {estimateCaloriesMutation.data.confidence === 'high' && '🟢 عالية'}
                      {estimateCaloriesMutation.data.confidence === 'medium' && '🟡 متوسطة'}
                      {estimateCaloriesMutation.data.confidence === 'low' && '🔴 منخفضة'}
                    </p>
                  </div>
                </div>
                {estimateCaloriesMutation.data.notes && (
                  <p className="text-xs text-muted-foreground mt-2">{estimateCaloriesMutation.data.notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* إدخال يدوي للسعرات */}
          <div>
            <label className="text-sm font-medium">السعرات الحرارية</label>
            <div className="flex gap-2 mt-2">
              <Input
                type="number"
                value={manualCalories}
                onChange={e => setManualCalories(e.target.value)}
                placeholder="أدخل السعرات..."
                className="flex-1"
              />
              <Button
                onClick={() => estimateCaloriesMutation.mutate()}
                disabled={!mealDesc || estimateCaloriesMutation.isPending}
                variant="outline"
                className="gap-2"
              >
                {estimateCaloriesMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                تقدير
              </Button>
            </div>
          </div>

          {/* الأزرار */}
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!mealDesc || !manualCalories}
              className="flex-1"
            >
              إضافة الوجبة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}