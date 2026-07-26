import { Activity, Check, Minus, Plus, Stethoscope } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/i18n";

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const ACTIVITY_KEYS = ["sedentary", "light", "moderate", "active"];

const bmiCategory = (bmi) => {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
};

const BMI_COLORS = {
  underweight: "bg-amber-100 text-amber-800 border-amber-300",
  normal: "bg-emerald-100 text-emerald-800 border-emerald-300",
  overweight: "bg-amber-100 text-amber-800 border-amber-300",
  obese: "bg-red-100 text-red-800 border-red-300",
};

/** Stepper input: − value + with sane bounds and direct typing. */
function StepperInput({ label, value, onChange, min, max, step = 1, unit }) {
  const bump = (dir) => {
    const next = clamp(Math.round(((Number(value) || 0) + dir * step) * 10) / 10, min, max);
    onChange(next);
  };
  const handleType = (raw) => {
    const n = parseFloat(raw);
    if (raw === "" || Number.isNaN(n)) return; // keep last valid value while typing
    onChange(clamp(n, min, max));
  };

  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <div className="mt-1.5 flex items-stretch gap-2" dir="ltr">
        <button
          type="button"
          onClick={() => bump(-1)}
          disabled={Number(value) <= min}
          className="w-12 min-h-[48px] rounded-xl border border-border bg-card hover:bg-secondary disabled:opacity-40 flex items-center justify-center transition-colors"
          aria-label="decrease"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex-1 relative">
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => handleType(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-border bg-card text-center text-lg font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {unit}
          </span>
        </div>
        <button
          type="button"
          onClick={() => bump(1)}
          disabled={Number(value) >= max}
          className="w-12 min-h-[48px] rounded-xl border border-border bg-card hover:bg-secondary disabled:opacity-40 flex items-center justify-center transition-colors"
          aria-label="increase"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Step 3 — identity, body metrics & health.
 * Full name, gender cards, steppers (height / current / target weight) with a
 * live BMI readout, activity level, and a chronic-diseases toggle backed by a
 * doctor-style caution box.
 */
export default function BodyHealthStep({ form, onChange }) {
  const t = useT();

  const height = Number(form.height_cm);
  const weight = Number(form.current_weight);
  const bmi = height >= 100 && weight >= 30 ? +(weight / ((height / 100) ** 2)).toFixed(1) : null;
  const bmiCat = bmi ? bmiCategory(bmi) : null;

  const genderCard = (key, emoji) => {
    const active = form.gender === key;
    return (
      <button
        type="button"
        onClick={() => onChange("gender", key)}
        className={`relative flex-1 min-h-[88px] rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
          active
            ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
            : "border-border bg-card hover:bg-secondary text-foreground"
        }`}
      >
        {active && (
          <span className="absolute top-2 end-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs leading-none flex items-center justify-center">
            ✓
          </span>
        )}
        <span className="text-3xl">{emoji}</span>
        <span className="font-semibold">{t(`onboarding.body.${key}`)}</span>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* Full name */}
      <div>
        <Label className="text-sm">{t("onboarding.body.fullName")}</Label>
        <Input
          value={form.full_name}
          onChange={(e) => onChange("full_name", e.target.value)}
          placeholder={t("onboarding.body.fullNamePlaceholder")}
          className="mt-1.5 min-h-[48px]"
        />
      </div>

      {/* Gender */}
      <div>
        <Label className="text-sm">{t("onboarding.body.gender")}</Label>
        <div className="mt-1.5 flex gap-3">
          {genderCard("male", "👨")}
          {genderCard("female", "👩")}
        </div>
      </div>

      {/* Body metrics */}
      <StepperInput
        label={t("onboarding.body.height")}
        value={form.height_cm}
        onChange={(v) => onChange("height_cm", v)}
        min={100} max={230} step={1}
        unit={t("onboarding.body.cm")}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StepperInput
          label={t("onboarding.body.currentWeight")}
          value={form.current_weight}
          onChange={(v) => onChange("current_weight", v)}
          min={30} max={300} step={0.5}
          unit={t("onboarding.body.kg")}
        />
        <StepperInput
          label={t("onboarding.body.targetWeight")}
          value={form.target_weight}
          onChange={(v) => onChange("target_weight", v)}
          min={30} max={300} step={0.5}
          unit={t("onboarding.body.kg")}
        />
      </div>

      {/* Live BMI */}
      {bmi && (
        <div className="flex items-center justify-between rounded-xl bg-secondary/50 border border-border/50 px-4 py-3">
          <div>
            <p className="text-[11px] text-muted-foreground">{t("onboarding.body.bmi")}</p>
            <p className="text-xl font-bold text-foreground" dir="ltr">{bmi}</p>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${BMI_COLORS[bmiCat]}`}>
            {t(`onboarding.body.bmiCat.${bmiCat}`)}
          </span>
        </div>
      )}

      {/* Activity level */}
      <div>
        <Label className="text-sm flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-muted-foreground" />
          {t("onboarding.body.activity")}
        </Label>
        <div className="mt-1.5 space-y-2">
          {ACTIVITY_KEYS.map((key) => {
            const active = form.activity_level === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange("activity_level", key)}
                className={`relative w-full min-h-[56px] rounded-xl border px-4 py-2.5 text-start transition-all ${
                  active
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-border bg-card hover:bg-secondary"
                }`}
              >
                {active && <Check className="absolute top-1/2 -translate-y-1/2 end-3 w-5 h-5 text-primary" />}
                <p className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>
                  {t(`onboarding.body.activityLevels.${key}`)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 pe-8">
                  {t(`onboarding.body.activityLevels.${key}Desc`)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chronic diseases */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-semibold">{t("onboarding.body.chronicQuestion")}</Label>
          <Switch
            checked={form.has_chronic_diseases}
            onCheckedChange={(v) => onChange("has_chronic_diseases", v)}
          />
        </div>

        {form.has_chronic_diseases && (
          <>
            <div>
              <Label className="text-sm">{t("onboarding.body.chronicDetails")}</Label>
              <Textarea
                value={form.chronic_diseases_details}
                onChange={(e) => onChange("chronic_diseases_details", e.target.value)}
                placeholder={t("onboarding.body.chronicPlaceholder")}
                className="mt-1.5 min-h-[88px]"
              />
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
              <Stethoscope className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{t("onboarding.body.cautionTitle")}</p>
                <p className="text-xs text-amber-700 leading-relaxed mt-0.5">{t("onboarding.body.caution")}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
