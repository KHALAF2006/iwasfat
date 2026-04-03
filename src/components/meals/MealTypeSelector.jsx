import React from 'react';
import { Button } from '@/components/ui/button';

const mealTypes = [
  { value: 'breakfast', label: '🌅 الفطور', arabic: 'breakfast' },
  { value: 'lunch', label: '☀️ الغداء', arabic: 'lunch' },
  { value: 'dinner', label: '🌙 العشاء', arabic: 'dinner' },
  { value: 'snack', label: '🍎 السناك', arabic: 'snack' }
];

export default function MealTypeSelector({ selectedType, onSelect }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-foreground">نوع الوجبة</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {mealTypes.map(type => (
          <Button
            key={type.value}
            onClick={() => onSelect(type.value)}
            variant={selectedType === type.value ? 'default' : 'outline'}
            className={`py-6 ${selectedType === type.value ? 'ring-2 ring-primary' : ''}`}
          >
            {type.label}
          </Button>
        ))}
      </div>
    </div>
  );
}