import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Target, Save, Loader2, LogOut, Globe } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useT, useLanguage } from "@/i18n";
import { showApiError } from "@/lib/api-error";
import EntitlementGate from "@/components/subscription/EntitlementGate";
import SubscriptionCard from "@/components/subscription/SubscriptionCard";
import TelegramCard from "@/components/telegram/TelegramCard";

export default function Settings() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [saved, setSaved] = useState(false);
  const t = useT();
  const { language, setLanguage } = useLanguage();

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
    onError: (err) => showApiError(err),
  });

  if (!subscriber || !form) {
    return (
      <div className="px-4 pt-6 pb-24 max-w-lg mx-auto flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <EntitlementGate subscriber={subscriber}>
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("settings.subtitle")}</p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> {t("settings.accountInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {subscriber.full_name?.[0] || "👤"}
            </div>
            <div>
              <p className="font-medium text-foreground">{subscriber.full_name}</p>
              <p className="text-sm text-muted-foreground" dir="ltr">{subscriber.email}</p>
            </div>
          </div>
          <div>
            <Label>{t("settings.phone")}</Label>
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

      {/* Language */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> {t("language.label")} 🌐
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {["ar", "en"].map(lang => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`py-3 rounded-xl border text-sm font-medium transition-colors ${
                  language === lang
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {lang === "ar" ? "العربية" : "English"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" /> {t("settings.goals")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">{t("settings.currentWeight")}</p>
              <p className="font-bold text-foreground text-lg">{subscriber.current_weight} {t("common.kg")}</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">{t("settings.height")}</p>
              <p className="font-bold text-foreground text-lg">{subscriber.height_cm} {t("common.cm")}</p>
            </div>
          </div>
          <div>
            <Label>{t("settings.targetWeight")}</Label>
            <Input
              type="number"
              value={form.target_weight}
              onChange={e => setForm(p => ({ ...p, target_weight: parseFloat(e.target.value) }))}
              className="mt-1.5"
              dir="ltr"
            />
          </div>
          <div>
            <Label>{t("settings.dailyCalorie")}</Label>
            <Input
              type="number"
              value={form.daily_calorie_target}
              onChange={e => setForm(p => ({ ...p, daily_calorie_target: parseInt(e.target.value) }))}
              className="mt-1.5"
              dir="ltr"
            />
          </div>
          <div>
            <Label>{t("settings.activityLevel")}</Label>
            <Select value={form.activity_level} onValueChange={v => setForm(p => ({ ...p, activity_level: v }))}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">{t("settings.activity.sedentary")}</SelectItem>
                <SelectItem value="light">{t("settings.activity.light")}</SelectItem>
                <SelectItem value="moderate">{t("settings.activity.moderate")}</SelectItem>
                <SelectItem value="active">{t("settings.activity.active")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subscription (real Stripe-backed status) */}
      <SubscriptionCard subscriber={subscriber} />

      {/* Telegram notifications */}
      <TelegramCard subscriber={subscriber} />

      {/* Save Button */}
      <Button
        onClick={() => updateMutation.mutate()}
        disabled={updateMutation.isPending}
        className="w-full gap-2 py-5"
      >
        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
         saved ? t("settings.saved") : <><Save className="w-4 h-4" /> {t("settings.saveChanges")}</>}
      </Button>

      {/* Logout */}
      <Button variant="outline" onClick={() => logout("/")} className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5">
        <LogOut className="w-4 h-4" />
        {t("auth.logout")}
      </Button>
    </div>
    </EntitlementGate>
  );
}
