import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Share2, Trash2, Sparkles, Loader2, FileDown, CheckCircle2, Circle } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
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
  const [generating, setGenerating] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const queryClient = useQueryClient();

  const { data: subscriber } = useQuery({
    queryKey: ['subscriber'],
    queryFn: async () => {
      const me = await base44.auth.me();
      const subs = await base44.entities.Subscriber.filter({ created_by: me.email });
      return subs[0] || null;
    },
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 6 });

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

  const toggleItemMutation = useMutation({
    mutationFn: async (itemIndex) => {
      if (!shoppingList) return;
      const updatedItems = shoppingList.items.map((item, idx) =>
        idx === itemIndex ? { ...item, is_checked: !item.is_checked } : item
      );
      await base44.entities.ShoppingList.update(shoppingList.id, { items: updatedItems });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoppingList'] }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemIndex) => {
      if (!shoppingList) return;
      const updatedItems = shoppingList.items.filter((_, idx) => idx !== itemIndex);
      await base44.entities.ShoppingList.update(shoppingList.id, { items: updatedItems });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoppingList'] }),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!shoppingList || !newItem.item_name || !newItem.quantity) return;
      const updatedItems = [
        ...shoppingList.items,
        { category: newItem.category, item_name: newItem.item_name, quantity: newItem.quantity, is_checked: false, notes: '' }
      ];
      await base44.entities.ShoppingList.update(shoppingList.id, { items: updatedItems });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      setNewItem({ category: 'other', item_name: '', quantity: '' });
      setShowAddItem(false);
    },
  });

  const generateList = async () => {
    if (!subscriber) return;
    setGenerating(true);
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    await base44.functions.invoke('generateShoppingList', {
      subscriber_id: subscriber.id,
      week_start_date: weekStartStr
    });
    queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
    setGenerating(false);
  };

  const exportPDF = async () => {
    if (!shoppingList) return;
    setExportingPDF(true);
    const response = await base44.functions.invoke('exportShoppingPDF', {
      shopping_list_id: shoppingList.id
    });
    // response.data is the PDF - but since it's binary we open via URL approach
    // Instead we trigger download via fetch with auth
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `قائمة-التسوق-${shoppingList.week_start_date}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setExportingPDF(false);
  };

  const shareList = () => {
    if (!shoppingList?.items) return;
    const grouped = shoppingList.items.reduce((acc, item) => {
      const cat = CATEGORIES[item.category]?.label || item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(`${item.is_checked ? '✅' : '☐'} ${item.item_name} — ${item.quantity}`);
      return acc;
    }, {});

    const message = Object.entries(grouped)
      .map(([cat, items]) => `${cat}\n${items.join('\n')}`)
      .join('\n\n');

    navigator.clipboard.writeText(message);
    alert('تم نسخ القائمة للحافظة');
  };

  if (!shoppingList) {
    return (
      <div className="px-4 pt-6 pb-20 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">قائمة التسوق</h1>
        </div>
        <div className="flex items-center justify-center h-64 text-center">
          <div>
            <p className="text-muted-foreground mb-4">لا توجد قائمة تسوق حالياً</p>
            <Button onClick={generateList} disabled={generating || !subscriber} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'جارٍ التوليد...' : 'توليد قائمة بالذكاء الاصطناعي'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const groupedItems = shoppingList.items.reduce((acc, item, idx) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ ...item, _index: idx });
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedItems).sort(
    (a, b) => (CATEGORIES[a]?.order || 999) - (CATEGORIES[b]?.order || 999)
  );

  const checkedCount = shoppingList.items.filter(i => i.is_checked).length;
  const totalCount = shoppingList.items.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

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
              <div className="mt-2 w-48 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-secondary">
              <span className="text-xl font-bold">{progress}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الأزرار */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button onClick={() => setShowAddItem(true)} className="flex-1 gap-2 min-w-[120px]">
          <Plus className="w-4 h-4" />
          إضافة منتج
        </Button>
        <Button onClick={generateList} variant="outline" disabled={generating} className="flex-1 gap-2 min-w-[120px]">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'جارٍ التوليد...' : 'تحديث بالذكاء الاصطناعي'}
        </Button>
        <Button onClick={exportPDF} variant="outline" disabled={exportingPDF} size="icon" title="تصدير PDF">
          {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        </Button>
        <Button onClick={shareList} variant="outline" size="icon" title="مشاركة">
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      {/* الفئات والعناصر */}
      <div className="space-y-4">
        {sortedCategories.map(categoryKey => (
          <Card key={categoryKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{CATEGORIES[categoryKey]?.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {groupedItems[categoryKey].map((item) => (
                <div
                  key={item._index}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                    item.is_checked ? 'bg-primary/5' : 'hover:bg-secondary/50'
                  }`}
                  onClick={() => toggleItemMutation.mutate(item._index)}
                >
                  {item.is_checked
                    ? <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.is_checked ? 'line-through text-muted-foreground' : ''}`}>
                      {item.item_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.quantity}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); deleteItemMutation.mutate(item._index); }}
                    className="h-8 w-8 p-0 flex-shrink-0"
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
                className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background"
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
                placeholder="مثل: صدر دجاج"
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">الكمية</label>
              <Input
                value={newItem.quantity}
                onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                placeholder="مثل: 500غ أو 2 كيلو"
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