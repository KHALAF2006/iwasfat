import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Flame, Clock, Trophy, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useT } from '@/i18n';
import { showApiError } from '@/lib/api-error';

const CALORIES_PER_MIN = {
  walking: 4,
  running: 10,
  cycling: 8,
  swimming: 9,
  gym: 7,
  yoga: 3,
  hiit: 12,
  other: 5,
};

const EXERCISE_TYPE_KEYS = Object.keys(CALORIES_PER_MIN);
const INTENSITY_KEYS = ['low', 'medium', 'high'];

const emptyForm = {
  exercise_type: 'walking',
  exercise_name: '',
  duration_minutes: 30,
  intensity: 'medium',
  distance_km: '',
  notes: '',
  mood_after: 3
};

export default function Exercise() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();
  const t = useT();

  const { data: subscriber } = useQuery({
    queryKey: ['subscriber'],
    queryFn: async () => {
      const me = await base44.auth.me();
      const subs = await base44.entities.Subscriber.filter({ created_by: me.email });
      return subs[0] || null;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['exerciseLogs', subscriber?.id, selectedDate],
    queryFn: async () => {
      if (!subscriber) return [];
      return await base44.entities.ExerciseLog.filter({
        subscriber_id: subscriber.id,
        date: selectedDate
      });
    },
    enabled: !!subscriber,
  });

  const { data: weekLogs = [] } = useQuery({
    queryKey: ['exerciseWeekLogs', subscriber?.id],
    queryFn: async () => {
      if (!subscriber) return [];
      return await base44.entities.ExerciseLog.filter({ subscriber_id: subscriber.id });
    },
    enabled: !!subscriber,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const calories = Math.round(
        (CALORIES_PER_MIN[form.exercise_type] || 5) * form.duration_minutes *
        (form.intensity === 'high' ? 1.3 : form.intensity === 'low' ? 0.7 : 1)
      );
      await base44.entities.ExerciseLog.create({
        subscriber_id: subscriber.id,
        date: selectedDate,
        exercise_type: form.exercise_type,
        exercise_name: form.exercise_name || t(`exercise.types.${form.exercise_type}`) || form.exercise_type,
        duration_minutes: Number(form.duration_minutes),
        calories_burned: calories,
        intensity: form.intensity,
        distance_km: form.distance_km ? Number(form.distance_km) : undefined,
        notes: form.notes,
        mood_after: form.mood_after
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exerciseLogs'] });
      queryClient.invalidateQueries({ queryKey: ['exerciseWeekLogs'] });
      setForm(emptyForm);
      setShowForm(false);
    },
    onError: (err) => showApiError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ExerciseLog.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exerciseLogs'] });
      queryClient.invalidateQueries({ queryKey: ['exerciseWeekLogs'] });
    },
    onError: (err) => showApiError(err),
  });

  const totalCaloriesToday = logs.reduce((sum, l) => sum + (l.calories_burned || 0), 0);
  const totalMinutesToday = logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
  const totalCaloriesWeek = weekLogs.reduce((sum, l) => sum + (l.calories_burned || 0), 0);

  const estimatedCalories = Math.round(
    (CALORIES_PER_MIN[form.exercise_type] || 5) * (form.duration_minutes || 0) *
    (form.intensity === 'high' ? 1.3 : form.intensity === 'low' ? 0.7 : 1)
  );

  return (
    <div className="px-4 pt-6 pb-20 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('exercise.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('exercise.subtitle')}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('exercise.addExercise')}
        </Button>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <Flame className="w-6 h-6 text-orange-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{totalCaloriesToday}</p>
            <p className="text-xs text-muted-foreground">{t('exercise.calToday')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Clock className="w-6 h-6 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{totalMinutesToday}</p>
            <p className="text-xs text-muted-foreground">{t('exercise.minToday')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{totalCaloriesWeek}</p>
            <p className="text-xs text-muted-foreground">{t('exercise.calWeek')}</p>
          </CardContent>
        </Card>
      </div>

      {/* اختيار التاريخ */}
      <div className="mb-4">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-border rounded-md bg-background text-sm"
          dir="ltr"
        />
      </div>

      {/* قائمة التمارين */}
      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{t('exercise.empty')}</p>
            <Button variant="outline" onClick={() => setShowForm(true)} className="mt-3 gap-2">
              <Plus className="w-4 h-4" />
              {t('exercise.addFirst')}
            </Button>
          </div>
        ) : (
          logs.map(log => (
            <Card key={log.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{t(`exercise.types.${log.exercise_type}`)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        log.intensity === 'high' ? 'bg-red-100 text-red-700' :
                        log.intensity === 'low' ? 'bg-green-100 text-green-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {t(`exercise.intensities.${log.intensity}`)}
                      </span>
                    </div>
                    {log.exercise_name && (
                      <p className="text-sm text-muted-foreground mt-0.5">{log.exercise_name}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-500" />
                        {log.duration_minutes} {t('common.minute')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-500" />
                        {log.calories_burned} {t('common.cal')}
                      </span>
                      {log.distance_km && (
                        <span>{log.distance_km} {t('common.km')}</span>
                      )}
                    </div>
                    {log.mood_after && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('exercise.mood')} {'😊'.repeat(log.mood_after)}
                      </p>
                    )}
                    {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(log.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* نموذج إضافة تمرين */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('exercise.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('exercise.type')}</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {EXERCISE_TYPE_KEYS.map(key => (
                  <button
                    key={key}
                    onClick={() => setForm({ ...form, exercise_type: key })}
                    className={`p-2 rounded-lg border text-sm text-start transition-colors ${
                      form.exercise_type === key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    {t(`exercise.types.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('exercise.nameLabel')}</label>
              <Input
                value={form.exercise_name}
                onChange={e => setForm({ ...form, exercise_name: e.target.value })}
                placeholder={t('exercise.namePlaceholder')}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('exercise.duration')}</label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
                  className="mt-2"
                  min="1"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('exercise.distance')}</label>
                <Input
                  type="number"
                  value={form.distance_km}
                  onChange={e => setForm({ ...form, distance_km: e.target.value })}
                  className="mt-2"
                  placeholder="0"
                  step="0.1"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('exercise.intensity')}</label>
              <div className="flex gap-2 mt-2">
                {INTENSITY_KEYS.map(key => (
                  <button
                    key={key}
                    onClick={() => setForm({ ...form, intensity: key })}
                    className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${
                      form.intensity === key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    {t(`exercise.intensities.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('exercise.moodAfter')}</label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setForm({ ...form, mood_after: n })}
                    className={`flex-1 py-2 rounded-lg border text-lg transition-colors ${
                      form.mood_after === n ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    {['😞', '😕', '😊', '😄', '🤩'][n - 1]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('exercise.notes')}</label>
              <Input
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder={t('exercise.notesPlaceholder')}
                className="mt-2"
              />
            </div>

            {form.duration_minutes > 0 && (
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <p className="text-sm text-orange-700">
                  {t('exercise.estimated')} <strong>{estimatedCalories} {t('common.cal')}</strong>
                </p>
              </div>
            )}

            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !subscriber}
              className="w-full"
            >
              {createMutation.isPending ? t('exercise.saving') : t('exercise.saveExercise')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
