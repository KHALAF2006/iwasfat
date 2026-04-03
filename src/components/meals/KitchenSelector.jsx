import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

const kitchenEmojis = {
  gulf: '🫕',
  levant: '🥙',
  egypt: '🍽️',
  yemen: '🫘',
  north_africa: '🥘',
  iraq: '🐟',
  palestine: '🍋'
};

export default function KitchenSelector({ onSelectKitchen, selectedKitchen }) {
  const { data: kitchens, isLoading } = useQuery({
    queryKey: ['kitchens'],
    queryFn: () => base44.entities.Kitchen.filter({ is_active: true }),
  });

  if (isLoading) return <div className="text-center py-4">جاري التحميل...</div>;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-foreground">اختر مطبخك المفضل</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {kitchens?.map(kitchen => (
          <Button
            key={kitchen.id}
            onClick={() => onSelectKitchen(kitchen)}
            variant={selectedKitchen?.id === kitchen.id ? 'default' : 'outline'}
            className={`flex flex-col items-center justify-center h-24 rounded-lg gap-1 transition-all ${
              selectedKitchen?.id === kitchen.id ? 'ring-2 ring-primary' : ''
            }`}
          >
            <span className="text-3xl">{kitchen.icon}</span>
            <span className="text-xs text-center leading-tight">{kitchen.name}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}