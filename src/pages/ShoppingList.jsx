import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Share2, Trash2, RefreshCw } from 'lucide-react';
import { format, addDays, startOfWeek, isSameWeek } from 'date-fns';
import { ar } from 'date-fns/locale';

const CATEGORIES = {
  meat_protein: { label: '🥩 اللحوم والبروتين', order: 1 },
  vegetables_fruits: { label: '🥦 الخضروات والفواكه', order: 2 },
  dairy: { label: '🧀 الألبان والأجبان', order: 3 },
  grains_legumes: { label: '🌾 الحبوب والبقوليات', order: 4 },
  oils_spices: { label: '🧴 الزيوت والتوابل', order: 5 },
  drinks: { label: '🥤 المشروبات', order: 6 },
  other: { label: '🛒 أخرى', order: 7 }
};

export default function ShoppingList() {
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ category: 'other', item_name: '', quantity: '' });
  const queryClient = useQueryClient();

  const { data: subscriber } = useQuery({
    queryKey: ['subscriber'],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ 
        created_by: (await base44.auth.me()).email 
      });
      return subs[0] || null;
    },
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 6 }); // أحد
  
  const { data: shoppingList } = useQuery({
    queryKey: ['shoppingList', subscriber?.id],
    queryFn: async () => {
      if (!subscriber) return null;
      const lists = await base44.entities.ShoppingList.filter({
        subscriber_id: subscriber.id,
        is_active: true
      });
      return lists[0] || null;
    },
    enabled: !!subscriber,
  });

  const updateItemMutation = useMutation({
    mutationFn: async (itemUpdate) => {
      if (!shoppingList) return;
      const updatedItems = shoppingList.items.map(item =>
        item.item_name === itemUpdate.item_name ? { ...item, ...itemUpdate } : item
      );
      await base44.entities.ShoppingList.update(shoppingList.id, { items: updatedItems });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemName) => {
      if (!shoppingList) return;
      const updatedItems = shoppingList.items.filter(item => item.item_name !== itemName);
      await base44.entities.ShoppingList.update(shoppingList.id, { items: updatedItems });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!shoppingList || !newItem.item_name || !newItem.quantity) return;
      const updatedItems = [
        ...shoppingList.items,
        {
          category: newItem.category,
          item_name: newItem.item_name,
          quantity: newItem.quantity,
          is_checked: false,
          notes: ''
        }
      ];
      await base44.entities.ShoppingList.update(shoppingList.id, { items: updatedItems });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      setNewItem({ category: 'other', item_name: '', quantity: '' });
      setShowAddItem(false);
    },
  });

  const shareList = () => {
    if (!shoppingList?.items) return;
    const text = shoppingList.items
      .sort((a, b) => (CATEGORIES[a.category]?.order || 999) - (CATEGORIES[b.category]?.order || 999))
      .reduce((acc, item) => {
        const category = CATEGORIES[item.category]?.label || item.category;
        if (!acc[category]) acc[category] = [];
        acc[category].push(`${item.item_name} — ${item.quantity}`);
        return acc;
      }, {});

    const message = Object.entries(text)
      .map(([cat, items]) => `${cat}\n${items.map(i => `□ ${i}`).join('\n')}`)
      .join('\n\n');

    navigator.share?.({
      title: 'قائمة التسوق',
      text: message,
    }) || navigator.clipboard.writeText(message);
  };

  if (!shoppingList) {
    return (
      <div className="flex items-center justify-center h-96 text-center">
        <div>
          <p className="text-muted-foreground">لا توجد قائمة تسوق حالياً</p>
          <p className="text-sm text-muted-foreground mt-2">أضف وجباتك أولاً لإنشاء قائمة تسوق</p>
        </div>
      </div>
    );
  }

  const groupedItems = shoppingList.items.reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedItems).sort(
    (a, b) => (CATEGORIES[a]?.order || 999) - (CATEGORIES[b]?.order || 999)
  );

  const checkedCount = shoppingList.items.filter(i => i.is_checked).length;
  const totalCount = shoppingList.items.length;

  return (
    <div className="px-4 pt-6 pb-20 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">قائمة التسوق</h1>
        <p className="text-muted-foreground text-sm mt-2">
          الأسبوع: {format(weekStart, 'd MMMM', { locale: ar })} — {format(addDays(weekStart, 6), 'd MMMM', { locale: ar })}
        </p>
      </div>

      {/* إحصائيات */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">تم التسوق</p>
              <p className="text-2xl font-bold">{checkedCount} من {totalCount}</p>
            </div>
            <div className="text-right">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <span className="text-xl font-bold">
                  {totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الأزرار */}
      <div className="flex gap-2 mb-6">
        <Button onClick={() => setShowAddItem(true)} className="flex-1 gap-2">
          <Plus className="w-4 h-4" />
          إضافة منتج
        </Button>
        <Button onClick={shareList} variant="outline" className="flex-1 gap-2">
          <Share2 className="w-4 h-4" />
          مشاركة
        </Button>
      </div>

      {/* الفئات والعناصر */}
      <div className="space-y-4">
        {sortedCategories.map(categoryKey => (
          <Card key={categoryKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{CATEGORIES[categoryKey]?.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {groupedItems[categoryKey].map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <Checkbox
                    checked={item.is_checked}
                    onCheckedChange={() => 
                      updateItemMutation.mutate({
                        item_name: item.item_name,
                        is_checked: !item.is_checked
                      })
                    }
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${item.is_checked ? 'line-through text-muted-foreground' : ''}`}>
                      {item.item_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.quantity}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteItemMutation.mutate(item.item_name)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* إضافة منتج جديد */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة منتج جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">الفئة</label>
              <select 
                value={newItem.category}
                onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                className="w-full mt-2 px-3 py-2 border border-border rounded-md"
              >
                {Object.entries(CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">اسم المنتج</label>
              <Input
                value={newItem.item_name}
                onChange={e => setNewItem({ ...newItem, item_name: e.target.value })}
                placeholder="مثل: دجاج مشوي"
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">الكمية</label>
              <Input
                value={newItem.quantity}
                onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                placeholder="مثل: 500غ أو 2 كيس"
                className="mt-2"
              />
            </div>
            <Button 
              onClick={() => addItemMutation.mutate()}
              disabled={addItemMutation.isPending || !newItem.item_name || !newItem.quantity}
              className="w-full"
            >
              إضافة
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}