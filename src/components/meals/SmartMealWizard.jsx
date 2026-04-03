import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import KitchenSelector from './KitchenSelector';
import MealTypeSelector from './MealTypeSelector';
import MealSelector from './MealSelector';
import { format } from 'date-fns';

export default function SmartMealWizard({ open, onClose, subscriberId }) {
  const [step, setStep] = useState(1);
  const [selectedKitchen, setSelectedKitchen] = useState(null);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const queryClient = useQueryClient();

  const addMealMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMeal) return;
      
      const today = format(new Date(), 'yyyy-MM-dd');
      // هنا يتم إضافة الوجبة إلى DailyMealPlan
      // سيتم تحديث هذا في المرحلة القادمة
      
      return selectedMeal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyMealPlan'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setStep(1);
    setSelectedKitchen(null);
    setSelectedMealType(null);
    setSelectedMeal(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'اختر مطبخك'}
            {step === 2 && 'نوع الوجبة'}
            {step === 3 && 'اختر الوجبة والحجم'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 1 && (
            <>
              <KitchenSelector 
                onSelectKitchen={setSelectedKitchen}
                selectedKitchen={selectedKitchen}
              />
              <Button 
                onClick={() => setStep(2)}
                disabled={!selectedKitchen}
                className="w-full"
              >
                التالي
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <MealTypeSelector 
                selectedType={selectedMealType}
                onSelect={setSelectedMealType}
              />
              <div className="flex gap-2">
                <Button 
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1"
                >
                  السابق
                </Button>
                <Button 
                  onClick={() => setStep(3)}
                  disabled={!selectedMealType}
                  className="flex-1"
                >
                  التالي
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <MealSelector 
                kitchenId={selectedKitchen?.id}
                mealType={selectedMealType}
                onSelectMeal={setSelectedMeal}
              />
              <div className="flex gap-2">
                <Button 
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="flex-1"
                >
                  السابق
                </Button>
                <Button 
                  onClick={() => addMealMutation.mutate()}
                  disabled={!selectedMeal}
                  className="flex-1"
                  isLoading={addMealMutation.isPending}
                >
                  إضافة الوجبة
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}