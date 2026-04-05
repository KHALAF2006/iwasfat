import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, User, Target, Activity, Save, Loader2, LogOut } from "lucide-react";

export default function Settings() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const subs = await base44.entities.Subscriber.filter({ created_by: me.email });
      return subs[0] || null;
    },
  });

  const [form, setForm] = useState(null);

  // Sync form when subscriber loads
  if (subscriber && !form) {
    setForm({
      target_weight: subscriber.target_weight || "",
      activity_level: subscriber.activity_level || "moderate",
      daily_calorie_target: subscriber.daily_calorie_target || "",
      phone: subscriber.phone || "",
    });
  }

  const updateMutation = useMutation({
    mutationFn: () => base44.entities.Subscriber.update(subscriber.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriber"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleLogout = () => {
    base44.auth.logout("/");
  };

  if (!subscriber || !form) {
    return (
      <div className="px-4 pt-6 pb-24 max-w-lg mx-auto flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-muted-foreground text-sm">إدارة حسابك وتفضيلاتك</p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> معلومات الحساب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {subscriber.full_name?.[0] || "م"}
            </div>
            <div>
              <p className="font-medium text-foreground">{subscriber.full_name}</p>
              <p className="text-sm text-muted-foreground">{subscriber.email}</p>
            </div>
          </div>
          <div>
            <Label>رقم الجوال</Label>
            <Input
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="05xxxxxxxx"
              className="mt-1.5"
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" /> الأهداف الصحية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">الوزن الحالي</p>
              <p className="font-bold text-foreground text-lg">{subscriber.current_weight} كغ</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">الطول</p>
              <p className="font-bold text-foreground text-lg">{subscriber.height_cm} سم</p>
            </div>
          </div>
          <div>
            <Label>الوزن المستهدف (كغ)</Label>
            <Input
              type="number"
              value={form.target_weight}
              onChange={e => setForm(p => ({ ...p, target_weight: parseFloat(e.target.value) }))}
              className="mt-1.5"
              dir="ltr"
            />
          </div>
          <div>
            <Label>هدف السعرات اليومي</Label>
            <Input
              type="number"
              value={form.daily_calorie_target}
              onChange={e => setForm(p => ({ ...p, daily_calorie_target: parseInt(e.target.value) }))}
              className="mt-1.5"
              dir="ltr"
            />
          </div>
          <div>
            <Label>مستوى النشاط</Label>
            <Select value={form.activity_level} onValueChange={v => setForm(p => ({ ...p, activity_level: v }))}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">قليل الحركة</SelectItem>
                <SelectItem value="light">خفيف النشاط</SelectItem>
                <SelectItem value="moderate">متوسط النشاط</SelectItem>
                <SelectItem value="active">نشيط جداً</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> معلومات الاشتراك
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
            <span className="text-sm text-muted-foreground">حالة الاشتراك</span>
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${
              subscriber.subscription_status === "active" ? "bg-primary/10 text-primary" :
              subscriber.subscription_status === "trial" ? "bg-accent/10 text-accent" :
              "bg-destructive/10 text-destructive"
            }`}>
              {subscriber.subscription_status === "active" ? "نشط" :
               subscriber.subscription_status === "trial" ? "تجريبي" :
               subscriber.subscription_status === "expired" ? "منتهي" : "ملغي"}
            </span>
          </div>
          {subscriber.subscription_end_date && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              ينتهي في: {subscriber.subscription_end_date}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={() => updateMutation.mutate()}
        disabled={updateMutation.isPending}
        className="w-full gap-2 py-5"
      >
        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
         saved ? "✓ تم الحفظ!" : <><Save className="w-4 h-4" /> حفظ التغييرات</>}
      </Button>

      {/* Logout */}
      <Button variant="outline" onClick={handleLogout} className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5">
        <LogOut className="w-4 h-4" />
        تسجيل الخروج
      </Button>
    </div>
  );
}