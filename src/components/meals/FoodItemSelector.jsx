import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

export default function FoodItemSelector({ onAddItem, selectedItems = [] }) {
  const [search, setSearch] = useState('');
  const [foodItems, setFoodItems] = useState([]);
  const [showList, setShowList] = useState(false);

  const handleSearch = async (value) => {
    setSearch(value);
    if (value.length > 0) {
      const items = await base44.entities.FoodItem.filter(
        { name_ar: { $regex: value, $options: 'i' } },
        '-updated_date',
        10
      );
      setFoodItems(items);
      setShowList(true);
    } else {
      setShowList(false);
    }
  };

  const handleSelectItem = (item) => {
    if (!selectedItems.find(i => i.id === item.id)) {
      onAddItem(item);
      setSearch('');
      setShowList(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          placeholder="ابحث عن صنف طعام..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pr-4"
        />
        {showList && foodItems.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-card border border-input rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
            {foodItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="w-full text-right px-4 py-2 hover:bg-secondary border-b last:border-b-0 transition-colors"
              >
                <div className="font-medium">{item.name_ar}</div>
                <div className="text-sm text-muted-foreground">{item.calories} سعر حراري</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedItems.length > 0 && (
        <div className="space-y-2">
          {selectedItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between bg-secondary p-3 rounded-md">
              <div>
                <div className="font-medium">{item.name_ar}</div>
                <div className="text-sm text-muted-foreground">
                  {item.calories} سعر | بروتين: {item.protein}g | كربوهيدرات: {item.carbs}g | دهون: {item.fat}g
                </div>
              </div>
              <button
                onClick={() => onAddItem(item, true)}
                className="text-destructive hover:bg-destructive/10 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}