import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LogOut, Scale, Target, Calendar, Activity, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useT, useLanguage } from "@/i18n";
import { showApiError } from "@/lib/api-error";

export default function Profile() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const t = useT();
  const { language } = useLanguage();

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
  });



  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Subscriber.update(subscriber.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriber"] });
      setEditing(false);
    },
    onError: (err) => showApiError(err),
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

  const statusColors = { trial: "bg-accent/10 text-accent", active: "bg-primary/10 text-primary", expired: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground" };

  if (!subscriber) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto text-center py-20">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">{t("profile.title")}</h1>

      {/* Profile Header */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 mb-4 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <span className="text-primary font-bold text-2xl">{subscriber.full_name?.[0]}</span>
        </div>
        <h2 className="text-xl font-bold text-foreground">{subscriber.full_name}</h2>
        <p className="text-sm text-muted-foreground" dir="ltr">{subscriber.email}</p>
        <Badge className={`mt-2 ${statusColors[subscriber.subscription_status]}`}>
          {t(`profile.statuses.${subscriber.subscription_status}`)}
        </Badge>
      </div>

      {/* BMI Card */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-4">
        <h3 className="font-semibold text-foreground mb-3">{t("profile.healthData")}</h3>
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
              <p className="text-xs text-muted-foreground">{t("profile.idealWeight")}</p>
              <p className="font-bold text-foreground">{subscriber.ideal_weight_min}-{subscriber.ideal_weight_max} {t("common.kg")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t("profile.activityLevel")}</p>
              <p className="font-bold text-foreground">{t(`profile.activity.${subscriber.activity_level}`)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{t("profile.joinDate")}</p>
              <p className="font-bold text-foreground">{new Date(subscriber.created_date).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Section */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">{t("profile.editData")}</h3>
          <Button variant="ghost" size="sm" onClick={() => {
            if (!editing) setForm({ height_cm: subscriber.height_cm, target_weight: subscriber.target_weight });
            setEditing(!editing);
          }}>
            {editing ? t("common.cancel") : t("common.edit")}
          </Button>
        </div>
        {editing && form && (
          <div className="space-y-3">
            <div>
              <Label>{t("profile.height")}</Label>
              <Input type="number" value={form.height_cm} onChange={e => setForm(p => ({ ...p, height_cm: e.target.value }))} className="mt-1" dir="ltr" />
            </div>
            <div>
              <Label>{t("profile.targetWeight")}</Label>
              <Input type="number" value={form.target_weight} onChange={e => setForm(p => ({ ...p, target_weight: e.target.value }))} className="mt-1" dir="ltr" />
            </div>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full bg-primary text-primary-foreground">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
            </Button>
          </div>
        )}
      </div>

      {/* Logout */}
      <Button variant="outline" onClick={() => logout("/")} className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 gap-2 py-5">
        <LogOut className="w-4 h-4" /> {t("auth.logout")}
      </Button>
    </div>
  );
}
