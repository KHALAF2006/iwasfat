import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useT, useLanguage } from "@/i18n";
import { useToast } from "@/components/ui/use-toast";
import PhoneStep from "@/components/onboarding/PhoneStep";
import BirthDateStep, { computeAge } from "@/components/onboarding/BirthDateStep";
import BodyHealthStep from "@/components/onboarding/BodyHealthStep";
import SuccessScreen from "@/components/onboarding/SuccessScreen";
import { DEFAULT_COUNTRY, composeE164, parseE164, validateNational } from "@/components/onboarding/countries";

const TOTAL_STEPS = 3;

const pad2 = (n) => String(n).padStart(2, "0");

const DEFAULT_BODY = {
  full_name: "",
  gender: "",
  height_cm: 170,
  current_weight: 85,
  target_weight: 75,
  activity_level: "",
  has_chronic_diseases: false,
  chronic_diseases_details: "",
};

/**
 * Profile onboarding wizard (route /register).
 *
 * Step 1: Gulf & Arab phone capture with per-country validation (E.164).
 * Step 2: custom year-first birth-date picker with live age / age-group.
 * Step 3: name, gender, body metrics (steppers + live BMI), activity, chronic.
 *
 * Submission ALWAYS goes through the backend function `completeOnboarding`
 * (upsert + 7-day trial + group auto-assignment live server-side). Returning
 * users are prefilled from their existing Subscriber row and submit through
 * the same function.
 */
export default function Register() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth, authChecked, navigateToLogin, refreshSubscriber } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const { isRTL } = useLanguage();

  const [checkingExisting, setCheckingExisting] = useState(true);
  const [existingSubscriber, setExistingSubscriber] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { group_name, trial_ends_at } on success

  const [step, setStep] = useState(1);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [national, setNational] = useState("");
  const [birth, setBirth] = useState({ year: null, month: null, day: null });
  const [body, setBody] = useState(DEFAULT_BODY);

  const updateBody = (key, value) => setBody((prev) => ({ ...prev, [key]: value }));

  // Returning users: prefill from the existing Subscriber row. Updates still
  // go through completeOnboarding (it upserts; no new trial is granted).
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
          setBody({
            full_name: existing.full_name || "",
            gender: existing.gender || "",
            height_cm: existing.height_cm ?? DEFAULT_BODY.height_cm,
            current_weight: existing.current_weight ?? DEFAULT_BODY.current_weight,
            target_weight: existing.target_weight ?? DEFAULT_BODY.target_weight,
            activity_level: existing.activity_level || "",
            has_chronic_diseases: !!existing.has_chronic_diseases,
            chronic_diseases_details: existing.chronic_diseases_details || "",
          });
          const parsed = parseE164(existing.phone);
          if (parsed) {
            setCountry(parsed.country);
            setNational(parsed.national);
          } else if (existing.phone) {
            setNational(String(existing.phone).replace(/\D/g, "").replace(/^0+/, ""));
          }
          if (existing.birth_date) {
            const [y, m, d] = String(existing.birth_date).split("-").map(Number);
            if (y && m && d) setBirth({ year: y, month: m, day: d });
          }
        }
      } catch (error) {
        console.error("Failed to load existing subscriber:", error);
        toast({ title: t("onboarding.errors.loadFailed"), variant: "destructive" });
      } finally {
        setCheckingExisting(false);
      }
    };
    if (authChecked && !isLoadingAuth) {
      loadExisting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, isLoadingAuth, isAuthenticated, user?.email]);

  // ── per-step validation ─────────────────────────────────────────────────
  const phoneCheck = validateNational(country, national);
  const birthComplete = !!(birth.year && birth.month && birth.day);
  const age = birthComplete ? computeAge(birth.year, birth.month, birth.day) : null;
  const birthValid = birthComplete && age >= 10 && age <= 100;
  const bodyValid =
    body.full_name.trim().length >= 2 &&
    !!body.gender &&
    !!body.activity_level &&
    Number(body.height_cm) >= 100 &&
    Number(body.current_weight) >= 30 &&
    Number(body.target_weight) >= 30;

  const canNext = step === 1 ? phoneCheck.ok : step === 2 ? birthValid : bodyValid;

  // ── submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canNext || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        full_name: body.full_name.trim(),
        gender: body.gender,
        birth_date: `${birth.year}-${pad2(birth.month)}-${pad2(birth.day)}`,
        height_cm: Number(body.height_cm),
        current_weight: Number(body.current_weight),
        target_weight: Number(body.target_weight),
        activity_level: body.activity_level,
        has_chronic_diseases: !!body.has_chronic_diseases,
        chronic_diseases_details: body.has_chronic_diseases ? body.chronic_diseases_details.trim() : "",
        phone: composeE164(country, national),
      };

      const res = await base44.functions.invoke("completeOnboarding", payload);
      const out = res?.data && typeof res.data === "object" && "ok" in res.data ? res.data : res;

      if (!out || out.ok !== true) {
        const code = out?.code;
        const message =
          code === "INVALID_PHONE"
            ? t("onboarding.errors.invalidPhone")
            : code === "INVALID_DATA"
              ? t("onboarding.errors.invalidData")
              : t("onboarding.errors.serverError");
        toast({ title: message, variant: "destructive" });
        return;
      }

      // Mirror the registration flag on the user record (best effort — the
      // backend function already owns the Subscriber row itself).
      try {
        await base44.auth.updateMe({
          subscriber_registered: true,
          subscriber_name: payload.full_name,
        });
      } catch (error) {
        console.warn("updateMe after onboarding failed:", error);
      }
      await refreshSubscriber();

      setResult({ group_name: out.group_name ?? null, trial_ends_at: out.trial_ends_at ?? null });
    } catch (error) {
      console.error("Onboarding failed:", error);
      toast({ title: t("onboarding.errors.serverError"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── anonymous visitors ──────────────────────────────────────────────────
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

  // ── success screen ──────────────────────────────────────────────────────
  if (result) {
    return (
      <SuccessScreen
        groupName={result.group_name}
        trialEndsAt={result.trial_ends_at}
        onContinue={() => navigate("/dashboard")}
      />
    );
  }

  const stepTitles = [
    t("onboarding.steps.phone"),
    t("onboarding.steps.birth"),
    t("onboarding.steps.body"),
  ];
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Sticky header: wizard title, progress indicator, step title */}
      <header className="shrink-0 border-b border-border/50 bg-background">
        <div className="w-full max-w-lg mx-auto px-4 pt-5 pb-4">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-foreground">
              {existingSubscriber ? t("onboarding.titleUpdate") : t("onboarding.title")}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">{t("onboarding.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1.5 flex-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? "bg-primary" : "bg-secondary"}`}
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {t("onboarding.stepOf", { step, total: TOTAL_STEPS })}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">{stepTitles[step - 1]}</p>
        </div>
      </header>

      {/* Scrollable body. Plain keyed div per step — no enter/exit animations
          gating visibility (paused animations can hide content). */}
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="w-full max-w-lg mx-auto px-4 py-6">
          <div key={step}>
            {step === 1 && (
              <PhoneStep
                country={country}
                onCountryChange={setCountry}
                national={national}
                onNationalChange={setNational}
              />
            )}
            {step === 2 && <BirthDateStep value={birth} onChange={setBirth} />}
            {step === 3 && <BodyHealthStep form={body} onChange={updateBody} />}
          </div>
        </div>
      </main>

      {/* Sticky footer: back / next (or submit) — always visible */}
      <footer className="shrink-0 border-t border-border bg-background">
        <div className="w-full max-w-lg mx-auto px-4 py-3 flex gap-2">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={submitting}
              className="gap-1 min-h-[48px]"
            >
              <BackIcon className="w-4 h-4" />
              {t("onboarding.back")}
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              disabled={!canNext}
              className="flex-1 gap-1 min-h-[48px]"
            >
              {t("onboarding.next")}
              <NextIcon className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canNext || submitting}
              className="flex-1 gap-1 min-h-[48px] bg-accent hover:bg-accent/90 text-white"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {existingSubscriber ? t("onboarding.updateSubmit") : t("onboarding.submit")}
                  <NextIcon className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
