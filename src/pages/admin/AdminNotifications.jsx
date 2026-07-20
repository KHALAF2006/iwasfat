import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Bell, Send, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';

const NOTIFICATION_TYPES = {
  meal_reminder: 'تذكير بالوجبة',
  water_reminder: 'تذكير بالماء',
  weight_checkin: 'تسجيل الوزن',
  admin_broadcast: 'إشعار عام',
  motivation: 'رسالة تحفيزية',
  shopping_reminder: 'تذكير التسوق'
};

const emptyForm = {
  title: '',
  message: '',
  type: 'admin_broadcast',
  target_all: true,
  group_id: ''
};

import { useT } from "@/i18n";

export default function AdminNotifications() {
  const t = useT();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 50),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.filter({ is_active: true }),
  });

  const { data: subscribers = [] } = useQuery({
    queryKey: ['subscribers'],
    queryFn: () => base44.entities.Subscriber.list(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (form.target_all) {
        // إرسال لجميع المشتركين
        for (const sub of subscribers) {
          await base44.entities.Notification.create({
            subscriber_id: sub.id,
            title: form.title,
            message: form.message,
            type: form.type,
            target_all: true,
            sent_at: new Date().toISOString()
          });
        }
      } else if (form.group_id) {
        const groupSubs = subscribers.filter(s => s.group_id === form.group_id);
        for (const sub of groupSubs) {
          await base44.entities.Notification.create({
            subscriber_id: sub.id,
            title: form.title,
            message: form.message,
            type: form.type,
            group_id: form.group_id,
            sent_at: new Date().toISOString()
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setForm(emptyForm);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // تجميع الإشعارات بدون تكرار (فريدة بالعنوان والوقت)
  const uniqueNotifications = notifications.reduce((acc, n) => {
    const key = `${n.title}-${n.created_date?.substring(0, 16)}`;
    if (!acc.find(x => `${x.title}-${x.created_date?.substring(0, 16)}` === key)) {
      acc.push(n);
    }
    return acc;
  }, []);

  const sentToday = notifications.filter(n =>
    n.created_date?.startsWith(new Date().toISOString().split('T')[0])
  ).length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.titles.notifications')}</h1>
          <p className="text-muted-foreground text-sm mt-1">إرسال إشعارات للمشتركين</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          إشعار جديد
        </Button>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <Bell className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{uniqueNotifications.length}</p>
            <p className="text-xs text-muted-foreground">إجمالي الإشعارات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Send className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{sentToday}</p>
            <p className="text-xs text-muted-foreground">أُرسل اليوم</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="w-6 h-6 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{subscribers.length}</p>
            <p className="text-xs text-muted-foreground">مشترك</p>
          </CardContent>
        </Card>
      </div>

      {/* قائمة الإشعارات */}
      <div className="space-y-3">
        {uniqueNotifications.map(n => (
          <Card key={n.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <p className="font-medium">{n.title}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {NOTIFICATION_TYPES[n.type] || n.type}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {n.created_date ? format(new Date(n.created_date), 'dd/MM/yyyy HH:mm') : ''}
                    {n.target_all && ' • للجميع'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(n.id)}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {uniqueNotifications.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            لا توجد إشعارات بعد
          </div>
        )}
      </div>

      {/* نموذج إرسال إشعار */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إرسال إشعار جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">نوع الإشعار</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background"
              >
                {Object.entries(NOTIFICATION_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">العنوان</label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="عنوان الإشعار"
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">الرسالة</label>
              <textarea
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="نص الإشعار..."
                rows={3}
                className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background text-sm resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium">المستهدف</label>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setForm({ ...form, target_all: true, group_id: '' })}
                  className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${
                    form.target_all ? 'border-primary bg-primary/10 text-primary' : 'border-border'
                  }`}
                >
                  👥 جميع المشتركين
                </button>
                <button
                  onClick={() => setForm({ ...form, target_all: false })}
                  className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${
                    !form.target_all ? 'border-primary bg-primary/10 text-primary' : 'border-border'
                  }`}
                >
                  🎯 مجموعة معينة
                </button>
              </div>
            </div>

            {!form.target_all && (
              <div>
                <label className="text-sm font-medium">اختر المجموعة</label>
                <select
                  value={form.group_id}
                  onChange={e => setForm({ ...form, group_id: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="">اختر مجموعة...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-secondary/50 rounded-lg p-3 text-sm text-muted-foreground">
              سيتم الإرسال إلى:{' '}
              <strong className="text-foreground">
                {form.target_all
                  ? `${subscribers.length} مشترك`
                  : form.group_id
                    ? `${subscribers.filter(s => s.group_id === form.group_id).length} مشترك في المجموعة`
                    : 'اختر مجموعة'}
              </strong>
            </div>

            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.title || !form.message}
              className="w-full gap-2"
            >
              <Send className="w-4 h-4" />
              {createMutation.isPending ? 'جارٍ الإرسال...' : 'إرسال الإشعار'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}