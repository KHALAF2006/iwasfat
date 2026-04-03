import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, LogOut, Scale, Target, Calendar, Activity, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function Profile() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
    onSuccess: (data) => {
      if (data) setForm({ height_cm: data.height_cm, target_weight: data.target_weight });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Subscriber.update(subscriber.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriber"] });
      setEditing(false);
    },
  });

  const handleSave = () => {
    const heightCm = parseFloat(form.height_cm);
    const targetWeight = parseFloat(form.target_weight);
    const heightM = heightCm / 100;
    updateMutation.mutate({
      height_cm: heightCm,
      target_weight: targetWeight,
      ideal_weight_min: +(18.5 * heightM * heightM).toFixed(1),
      ideal_weight_max: +(24.9 * heightM * heightM).toFixed(1),
    });
  };

  const handleLogout = () => {
    base44.auth.logout("/");
  };

  const statusLabels = { trial: "تجريبي", active: "نشط", expired: "منتهي", cancelled: "ملغي" };
  const statusColors = { trial: "bg-accent/10 text-accent", active: "bg-primary/10 text-primary", expired: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground" };

  const activityLabels = { sedentary: "خامل", light: "خفيف", moderate: "متوسط", active: "نشيط" };

  if (!subscriber) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto text-center py-20">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon"><ArrowRight className="w-5 h-5" /></Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">الملف الشخصي</h1>
      </div>

      {/* Profile Header */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 mb-4 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <span className="text-primary font-bold text-2xl">{subscriber.full_name?.[0]}</span>
        </div>
        <h2 className="text-xl font-bold text-foreground">{subscriber.full_name}</h2>
        <p className="text-sm text-muted-foreground">{subscriber.email}</p>
        <Badge className={`mt-2 ${statusColors[subscriber.subscription_status]}`}>
          {statusLabels[subscriber.subscription_status]}
        </Badge>
      </div>

      {/* BMI Card */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-4">
        <h3 className="font-semibold text-foreground mb-3">بياناتك الصحية</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">BMI</p>
              <p className="font-bold text-foreground">{subscriber.bmi}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-accent" />
            <div>
              <p className="text-xs text-muted-foreground">الوزن المثالي</p>
              <p className="font-bold text-foreground">{subscriber.ideal_weight_min}-{subscriber.ideal_weight_max} كغ</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">مستوى النشاط</p>
              <p className="font-bold text-foreground">{activityLabels[subscriber.activity_level]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">تاريخ الانضمام</p>
              <p className="font-bold text-foreground">{new Date(subscriber.created_date).toLocaleDateString("ar-SA")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Section */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">تعديل البيانات</h3>
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "إلغاء" : "تعديل"}
          </Button>
        </div>
        {editing && (
          <div className="space-y-3">
            <div>
              <Label>الطول (سم)</Label>
              <Input type="number" value={form.height_cm} onChange={e => setForm(p => ({ ...p, height_cm: e.target.value }))} className="mt-1" dir="ltr" />
            </div>
            <div>
              <Label>الوزن المستهدف (كغ)</Label>
              <Input type="number" value={form.target_weight} onChange={e => setForm(p => ({ ...p, target_weight: e.target.value }))} className="mt-1" dir="ltr" />
            </div>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full bg-primary text-primary-foreground">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
            </Button>
          </div>
        )}
      </div>

      {/* Logout */}
      <Button variant="outline" onClick={handleLogout} className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 gap-2 py-5">
        <LogOut className="w-4 h-4" /> تسجيل الخروج
      </Button>
    </div>
  );
}