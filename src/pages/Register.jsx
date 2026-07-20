import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useT } from "@/i18n";
import { useToast } from "@/components/ui/use-toast";

const calculateBMI = (weight, heightCm) => {
  const heightM = heightCm / 100;
  return +(weight / (heightM * heightM)).toFixed(1);
};

// Devine formula — genuinely gender-aware ideal weight range.
const calculateIdealWeight = (heightCm, gender) => {
  const heightM = heightCm / 100;
  const inches = heightCm / 2.54;
  const base = gender === "female" ? 45.5 : 50;
  const devine = inches > 60 ? base + 2.3 * (inches - 60) : base;
  // Blend with the healthy BMI band so the range stays sensible for shorter/taller people.
  const bmiMin = 18.5 * heightM * heightM;
  const bmiMax = 24.9 * heightM * heightM;
  const min = Math.max(bmiMin, devine - 5);
  const max = Math.min(bmiMax, devine + 5);
  return { min: +min.toFixed(1), max: +max.toFixed(1) };
};

// Mifflin-St Jeor TDEE minus a safe deficit, with hard calorie floors.
const calculateDailyCalories = (weight, heightCm, age, gender, activityLevel) => {
  let bmr;
  if (gender === "male") {
    bmr = 10 * weight + 6.25 * heightCm - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * heightCm - 5 * age - 161;
  }
  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  const tdee = bmr * (multipliers[activityLevel] || 1.2);
  const deficit = Math.min(750, Math.max(250, tdee * 0.2)); // cap the deficit between 250–750 kcal
  const floor = gender === "male" ? 1500 : 1200; // never go below a medically safe minimum
  return Math.round(Math.max(floor, tdee - deficit));
};

export default function Register() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth, authChecked, navigateToLogin, refreshSubscriber } = useAuth();
  const { toast } = useToast();
  const t = useT();

  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [existingSubscriber, setExistingSubscriber] = useState(null); // update mode when found
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "",
    gender: "",
    birth_date: "",
    height_cm: "",
    current_weight: "",
    target_weight: "",
    activity_level: "",
    has_chronic_diseases: false,
    chronic_diseases_details: "",
    phone: "",
  });

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // On mount: if the user already has a Subscriber record, enter update mode
  // instead of creating a duplicate row.
  useEffect(() => {
    const loadExisting = async () => {
      if (!isAuthenticated || !user?.email) {
        setCheckingExisting(false);
        return;
      }
      try {
        const subs = await base44.entities.Subscriber.filter({ created_by: user.email });
        const existing = subs[0];
        if (existing) {
          setExistingSubscriber(existing);
          setForm({
            full_name: existing.full_name || "",
            gender: existing.gender || "",
            birth_date: existing.birth_date || "",
            height_cm: existing.height_cm ?? "",
            current_weight: existing.current_weight ?? "",
            target_weight: existing.target_weight ?? "",
            activity_level: existing.activity_level || "",
            has_chronic_diseases: !!existing.has_chronic_diseases,
            chronic_diseases_details: existing.chronic_diseases_details || "",
            phone: existing.phone || "",
          });
        }
      } catch (error) {
        console.error("Failed to load existing subscriber:", error);
        toast({ title: t("register.errorLoad"), variant: "destructive" });
      } finally {
        setCheckingExisting(false);
      }
    };
    if (authChecked && !isLoadingAuth) {
      loadExisting();
    }
     
  }, [authChecked, isLoadingAuth, isAuthenticated, user?.email]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const weight = parseFloat(form.current_weight);
      const height = parseFloat(form.height_cm);
      const birthYear = new Date(form.birth_date).getFullYear();
      const age = new Date().getFullYear() - birthYear;
      const bmi = calculateBMI(weight, height);
      const idealWeight = calculateIdealWeight(height, form.gender);
      const dailyCalories = calculateDailyCalories(weight, height, age, form.gender, form.activity_level);

      const subscriberData = {
        ...form,
        email: user.email, // always the authenticated account's email
        height_cm: height,
        current_weight: weight,
        target_weight: parseFloat(form.target_weight),
        bmi,
        ideal_weight_min: idealWeight.min,
        ideal_weight_max: idealWeight.max,
        daily_calorie_target: dailyCalories,
      };

      if (existingSubscriber) {
        await base44.entities.Subscriber.update(existingSubscriber.id, subscriberData);
      } else {
        // NOTE: 'trial' is a client-side placeholder — server-side billing
        // (Stripe webhooks + sweepTrials) owns the lifecycle from here on.
        // Stamp trial_ends_at so sweepTrials doesn't have to guess for new rows.
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        await base44.entities.Subscriber.create({ ...subscriberData, subscription_status: "trial", trial_ends_at: trialEndsAt });
      }

      // Save subscriber info on the user
      await base44.auth.updateMe({
        subscriber_registered: true,
        subscriber_name: form.full_name,
      });

      await refreshSubscriber();

      toast({ title: existingSubscriber ? t("register.successUpdate") : t("register.successCreate") });
      navigate("/dashboard");
    } catch (error) {
      console.error("Registration failed:", error);
      toast({ title: t("register.errorSave"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Anonymous visitors: friendly prompt to sign in — no unhandled rejections.
  if (authChecked && !isLoadingAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-2xl border border-border/50 p-8 shadow-lg text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <LogIn className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">{t("auth.loginRequiredTitle")}</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">{t("auth.loginRequiredBody")}</p>
          <Button onClick={navigateToLogin} className="w-full bg-accent hover:bg-accent/90 text-white py-5 gap-2">
            {t("auth.loginRequiredCta")}
            <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          </Button>
        </div>
      </div>
    );
  }

  if (!authChecked || isLoadingAuth || checkingExisting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const heightNum = parseFloat(form.height_cm);
  const weightNum = parseFloat(form.current_weight);
  const targetNum = parseFloat(form.target_weight);
  const hasBodyData = !Number.isNaN(heightNum) && !Number.isNaN(weightNum);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {existingSubscriber ? t("register.titleUpdate") : t("register.titleNew")}
          </h1>
          <p className="text-muted-foreground">{t("register.subtitle")}</p>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? 'w-8 bg-primary' : s < step ? 'w-8 bg-primary/40' : 'w-8 bg-border'}`} />
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-8 shadow-lg">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label>{t("register.fullName")}</Label>
                <Input value={form.full_name} onChange={e => updateForm("full_name", e.target.value)} placeholder={t("register.fullNamePlaceholder")} className="mt-1.5" />
              </div>
              <div>
                <Label>{t("register.email")}</Label>
                {/* Email always comes from the authenticated account — read-only */}
                <Input type="email" value={user?.email || ""} readOnly disabled className="mt-1.5 opacity-70" dir="ltr" />
              </div>
              <div>
                <Label>{t("register.phone")}</Label>
                <Input value={form.phone} onChange={e => updateForm("phone", e.target.value)} placeholder={t("register.phonePlaceholder")} className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>{t("register.gender")}</Label>
                <Select value={form.gender} onValueChange={v => updateForm("gender", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder={t("register.genderPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("register.male")}</SelectItem>
                    <SelectItem value="female">{t("register.female")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("register.birthDate")}</Label>
                <Input type="date" value={form.birth_date} onChange={e => updateForm("birth_date", e.target.value)} className="mt-1.5" dir="ltr" />
              </div>
              <Button onClick={() => setStep(2)} className="w-full bg-primary text-primary-foreground py-5 gap-2" disabled={!form.full_name || !form.gender || !form.birth_date}>
                {t("common.next")} <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <Label>{t("register.height")}</Label>
                <Input type="number" value={form.height_cm} onChange={e => updateForm("height_cm", e.target.value)} placeholder="170" className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>{t("register.currentWeight")}</Label>
                <Input type="number" value={form.current_weight} onChange={e => updateForm("current_weight", e.target.value)} placeholder="85" className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>{t("register.targetWeight")}</Label>
                <Input type="number" value={form.target_weight} onChange={e => updateForm("target_weight", e.target.value)} placeholder="70" className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>{t("register.activityLevel")}</Label>
                <Select value={form.activity_level} onValueChange={v => updateForm("activity_level", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder={t("register.activityPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">{t("register.activity.sedentary")}</SelectItem>
                    <SelectItem value="light">{t("register.activity.light")}</SelectItem>
                    <SelectItem value="moderate">{t("register.activity.moderate")}</SelectItem>
                    <SelectItem value="active">{t("register.activity.active")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 py-5">{t("common.previous")}</Button>
                <Button onClick={() => setStep(3)} className="flex-1 bg-primary text-primary-foreground py-5 gap-2" disabled={!form.height_cm || !form.current_weight || !form.target_weight || !form.activity_level}>
                  {t("common.next")} <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <Label>{t("register.chronicQuestion")}</Label>
                <Switch checked={form.has_chronic_diseases} onCheckedChange={v => updateForm("has_chronic_diseases", v)} />
              </div>
              {form.has_chronic_diseases && (
                <div>
                  <Label>{t("register.chronicDetails")}</Label>
                  <Textarea value={form.chronic_diseases_details} onChange={e => updateForm("chronic_diseases_details", e.target.value)} placeholder={t("register.chronicPlaceholder")} className="mt-1.5" />
                </div>
              )}

              {hasBodyData && (
                <div className="bg-secondary/50 rounded-xl p-5 space-y-3">
                  <h3 className="font-semibold text-foreground">{t("register.summary")}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t("register.bmi")}</p>
                      <p className="font-bold text-foreground text-lg">{calculateBMI(weightNum, heightNum)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("register.idealWeight")}</p>
                      <p className="font-bold text-foreground text-lg" dir="ltr">
                        {calculateIdealWeight(heightNum, form.gender).min} - {calculateIdealWeight(heightNum, form.gender).max} {t("common.kg")}
                      </p>
                    </div>
                    {!Number.isNaN(targetNum) && (
                      <>
                        <div>
                          <p className="text-muted-foreground">{t("register.lossGoal")}</p>
                          <p className="font-bold text-accent text-lg">{(weightNum - targetNum).toFixed(1)} {t("common.kg")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("register.approxDuration")}</p>
                          <p className="font-bold text-foreground text-lg">{Math.max(0, Math.ceil((weightNum - targetNum) / 0.75))} {t("common.week")}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Medical disclaimer — guidance, not a prescription */}
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
                <p className="text-sm font-semibold text-foreground mb-1">{t("register.disclaimerTitle")}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t("register.disclaimer")}</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 py-5">{t("common.previous")}</Button>
                <Button onClick={handleSubmit} disabled={loading} className="flex-1 bg-accent hover:bg-accent/90 text-white py-5 gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{existingSubscriber ? t("register.saveChanges") : t("register.createAccount")} <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" /></>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
