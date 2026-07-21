import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Share2, Trash2, Sparkles, Loader2, FileDown, CheckCircle2, Circle } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useT, useLanguage } from '@/i18n';
import { useToast } from '@/components/ui/use-toast';
import { showApiError } from '@/lib/api-error';

const CATEGORY_ORDER = {
  meat_protein: 1,
  vegetables_fruits: 2,
  dairy: 3,
  grains_legumes: 4,
  oils_spices: 5,
  drinks: 6,
  other: 7,
};

export default function ShoppingList() {
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ category: 'other', item_name: '', quantity: '' });
  const [generating, setGenerating] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const queryClient = useQueryClient();
  const t = useT();
  const { language } = useLanguage();
  const { toast } = useToast();

  const dateLocale = language === 'ar' ? ar : enUS;

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
    onError: (err) => showApiError(err),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemIndex) => {
      if (!shoppingList) return;
      const updatedItems = shoppingList.items.filter((_, idx) => idx !== itemIndex);
      await base44.entities.ShoppingList.update(shoppingList.id, { items: updatedItems });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoppingList'] }),
    onError: (err) => showApiError(err),
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
    onError: (err) => showApiError(err),
  });

  const generateList = async () => {
    if (!subscriber) return;
    setGenerating(true);
    try {
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      await base44.functions.invoke('generateShoppingList', {
        subscriber_id: subscriber.id,
        week_start_date: weekStartStr
      });
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
    } catch (err) {
      showApiError(err);
    } finally {
      setGenerating(false);
    }
  };

  const exportPDF = async () => {
    if (!shoppingList) return;
    setExportingPDF(true);
    try {
      const response = await base44.functions.invoke('exportShoppingPDF', {
        shopping_list_id: shoppingList.id
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('shopping.filePrefix')}-${shoppingList.week_start_date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingPDF(false);
    }
  };

  const shareList = () => {
    if (!shoppingList?.items) return;
    const grouped = shoppingList.items.reduce((acc, item) => {
      const cat = t(`shopping.categories.${item.category}`);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(`${item.is_checked ? '✅' : '☐'} ${item.item_name} — ${item.quantity}`);
      return acc;
    }, {});

    const message = Object.entries(grouped)
      .map(([cat, items]) => `${cat}\n${items.join('\n')}`)
      .join('\n\n');

    navigator.clipboard.writeText(message);
    toast({ title: t('shopping.copied') });
  };

  if (!shoppingList) {
    return (
      <div className="px-4 pt-6 pb-20 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">{t('shopping.title')}</h1>
        </div>
        <div className="flex items-center justify-center h-64 text-center">
          <div>
            <p className="text-muted-foreground mb-4">{t('shopping.empty')}</p>
            <Button onClick={generateList} disabled={generating || !subscriber} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? t('shopping.generating') : t('shopping.generate')}
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
    (a, b) => (CATEGORY_ORDER[a] || 999) - (CATEGORY_ORDER[b] || 999)
  );

  const checkedCount = shoppingList.items.filter(i => i.is_checked).length;
  const totalCount = shoppingList.items.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  return (
    <div className="px-4 pt-6 pb-20 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">{t('shopping.title')}</h1>
        <p className="text-muted-foreground text-sm mt-2">
          {t('shopping.weekLabel')} {format(weekStart, 'd MMMM', { locale: dateLocale })} — {format(addDays(weekStart, 6), 'd MMMM', { locale: dateLocale })}
        </p>
      </div>

      {/* إحصائيات */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('shopping.shopped')}</p>
              <p className="text-2xl font-bold">{checkedCount} {t('shopping.of')} {totalCount}</p>
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
          {t('shopping.addProduct')}
        </Button>
        <Button onClick={generateList} variant="outline" disabled={generating} className="flex-1 gap-2 min-w-[120px]">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? t('shopping.generating') : t('shopping.refreshAI')}
        </Button>
        <Button onClick={exportPDF} variant="outline" disabled={exportingPDF} size="icon" title={t('shopping.exportPDF')}>
          {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        </Button>
        <Button onClick={shareList} variant="outline" size="icon" title={t('shopping.share')}>
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      {/* الفئات والعناصر */}
      <div className="space-y-4">
        {sortedCategories.map(categoryKey => (
          <Card key={categoryKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t(`shopping.categories.${categoryKey}`)}</CardTitle>
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
            <DialogTitle>{t('shopping.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('shopping.category')}</label>
              <select
                value={newItem.category}
                onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background"
              >
                {Object.keys(CATEGORY_ORDER).map(key => (
                  <option key={key} value={key}>{t(`shopping.categories.${key}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('shopping.itemName')}</label>
              <Input
                value={newItem.item_name}
                onChange={e => setNewItem({ ...newItem, item_name: e.target.value })}
                placeholder={t('shopping.itemNamePlaceholder')}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('shopping.quantity')}</label>
              <Input
                value={newItem.quantity}
                onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                placeholder={t('shopping.quantityPlaceholder')}
                className="mt-2"
              />
            </div>
            <Button
              onClick={() => addItemMutation.mutate()}
              disabled={addItemMutation.isPending || !newItem.item_name || !newItem.quantity}
              className="w-full"
            >
              {t('common.add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
