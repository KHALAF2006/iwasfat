import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ChevronRight, ChevronLeft, PenLine } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { useT, useLanguage } from "@/i18n";
import { evaluateFoodForProfile } from "@/lib/nutrition/engine";
import MealTypeSelector from "./MealTypeSelector";
import KitchenSelector from "./KitchenSelector";
import MealSelector from "./MealSelector";
import FoodItemSelector from "./FoodItemSelector";
import MealWarnings from "./MealWarnings";
import ManualMealEntry from "./ManualMealEntry";
import { buildEngineProfile, evaluateMealForSubscriber, useFoodIndexItems } from "./conditions";
import { showApiError } from "@/lib/api-error";

const TOTAL_STEPS = 6;
const PORTION_MULTIPLIERS = [0.5, 1, 1.5, 2];

/**
 * Genuine 6-step meal logging wizard:
 *  1) meal type  2) kitchen filter  3) meal picker (catalog / food DB / manual)
 *  4) size/portion  5) medical check  6) confirm & save.
 *
 * Saving writes a FoodLog (followed_plan=true when the meal is today's
 * planned meal) and completes the matching DailyMealPlan slot.
 */
export default function SmartMealWizard({ open, onClose, subscriber, initialMealType = "" }) {
  const t = useT();
  const { language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const subscriberId = subscriber?.id;

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [mealType, setMealType] = useState("");
  const [kitchenId, setKitchenId] = useState(null);
  const [kitchenTouched, setKitchenTouched] = useState(false);
  const [selection, setSelection] = useState(null); // {kind:'meal'|'food'|'manual', ...}
  const [portionMult, setPortionMult] = useState(1);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  // ── data ────────────────────────────────────────────────────────────────
  const { data: dailyPlan } = useQuery({
    queryKey: ["dailyPlan", subscriberId, today],
    queryFn: async () => {
      const plans = await base44.entities.DailyMealPlan.filter({ subscriber_id: subscriberId, date: today });
      return plans[0] || null;
    },
    enabled: open && !!subscriberId,
  });

  const { data: allMeals = [], isLoading: mealsLoading } = useQuery({
    queryKey: ["activeMeals"],
    queryFn: () => base44.entities.Meal.filter({ is_active: true }),
    enabled: open,
  });

  // ── reset / deep-link ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setDirection(1);
    setMealType(initialMealType || "");
    setKitchenId(null);
    setKitchenTouched(false);
    setSelection(null);
    setPortionMult(1);
    setOverrideConfirmed(false);
  }, [open, initialMealType]);

  const planMealId = mealType && dailyPlan ? dailyPlan[`${mealType}_meal_id`] : null;

  // Default the kitchen filter to the kitchen of today's planned meal (the
  // group plan's kitchen) once, unless the user changed it manually.
  useEffect(() => {
    if (kitchenTouched || kitchenId || !planMealId || !allMeals.length) return;
    const planMeal = allMeals.find((m) => m.id === planMealId);
    if (planMeal?.kitchen_id) setKitchenId(planMeal.kitchen_id);
  }, [planMealId, allMeals, kitchenId, kitchenTouched]);

  // Strict filter by type (+kitchen). Snacks no longer leak into other types.
  const filteredMeals = useMemo(
    () =>
      allMeals.filter(
        (m) => m.meal_type === mealType && (!kitchenId || m.kitchen_id === kitchenId)
      ),
    [allMeals, mealType, kitchenId]
  );

  // ── evaluation (step 5) ─────────────────────────────────────────────────
  const profile = useMemo(() => buildEngineProfile(subscriber), [subscriber]);
  const indexItems = useFoodIndexItems();

  const evaluation = useMemo(() => {
    if (!selection || !profile) return { allowed: true, warnings: [] };
    if (selection.kind === "meal") {
      const withSize = { ...selection.meal, __size: selection.size };
      return evaluateMealForSubscriber(withSize, subscriber, indexItems);
    }
    if (selection.kind === "food") {
      const it = selection.item;
      return evaluateFoodForProfile(
        {
          name_ar: it.name_ar,
          name_en: it.name_en,
          sugar_g: (it.sugar_g || 0) * portionMult,
          sodium_mg: (it.sodium_mg || 0) * portionMult,
          tags: it.tags || [],
        },
        profile
      );
    }
    return { allowed: true, warnings: [] }; // manual entries carry no tags
  }, [selection, profile, subscriber, portionMult, indexItems]);

  // ── save ────────────────────────────────────────────────────────────────
  const followedPlan =
    selection?.kind === "meal" && planMealId && selection.meal.id === planMealId;

  const logMutation = useMutation({
    mutationFn: async () => {
      const s = selection;
      const payload = {
        subscriber_id: subscriberId,
        date: today,
        meal_type: mealType,
        followed_plan: !!followedPlan,
        actual_food:
          s.kind === "meal"
            ? `${s.meal.name} (${s.size.size_name})`
            : s.kind === "food"
              ? `${s.item.name_ar} (${Math.round((s.item.portion_grams || 0) * portionMult)}غ)`
              : `${s.name} (${s.sizeLabel})`,
        calories: Math.round(
          s.kind === "meal"
            ? s.size.calories || 0
            : s.kind === "food"
              ? (s.item.calories || 0) * portionMult
              : s.calories
        ),
        protein:
          s.kind === "meal" ? s.size.protein ?? null
          : s.kind === "food" ? Math.round((s.item.protein_g || 0) * portionMult * 10) / 10
          : s.protein,
        carbs:
          s.kind === "meal" ? s.size.carbs ?? null
          : s.kind === "food" ? Math.round((s.item.carbs_g || 0) * portionMult * 10) / 10
          : s.carbs,
        fat:
          s.kind === "meal" ? s.size.fat ?? null
          : s.kind === "food" ? Math.round((s.item.fat_g || 0) * portionMult * 10) / 10
          : s.fat,
      };
      await base44.entities.FoodLog.create(payload);
      if (followedPlan && dailyPlan) {
        await base44.entities.DailyMealPlan.update(dailyPlan.id, {
          [`${mealType}_completed`]: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foodLogs"] });
      queryClient.invalidateQueries({ queryKey: ["dailyPlan"] });
      onClose();
    },
    // Keep the wizard open so the user can retry; only toast the failure.
    onError: (err) => showApiError(err),
  });

  // ── navigation ──────────────────────────────────────────────────────────
  const goTo = (next) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };
  const next = () => goTo(Math.min(step + 1, TOTAL_STEPS));
  const back = () => goTo(Math.max(step - 1, 1));

  const handleManualSubmit = ({ meal_name, calories, protein, carbs, fat, size_selected }) => {
    setSelection({ kind: "manual", name: meal_name, calories, protein, carbs, fat, sizeLabel: size_selected });
    goTo(6);
  };

  const canNext =
    step === 1 ? !!mealType
    : step === 2 ? true
    : step === 3 ? !!selection
    : step === 4 ? selection?.kind !== "meal" || !!selection?.size
    : step === 5 ? evaluation.allowed || overrideConfirmed
    : false;

  const stepTitles = [
    t("mealFlow.steps.type"),
    t("mealFlow.steps.kitchen"),
    t("mealFlow.steps.pick"),
    t("mealFlow.steps.size"),
    t("mealFlow.steps.check"),
    t("mealFlow.steps.confirm"),
  ];

  const slide = {
    initial: (dir) => ({ opacity: 0, x: (isRTL ? -1 : 1) * dir * 40 }),
    animate: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: (isRTL ? -1 : 1) * dir * -40 }),
  };

  const BackIcon = isRTL ? ChevronLeft : ChevronRight;
  const NextIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("mealFlow.title")}</DialogTitle>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex gap-1 flex-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < step ? "bg-primary" : "bg-secondary"
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {t("mealFlow.stepOf", { step, total: TOTAL_STEPS })}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground mb-3">
            {stepTitles[step - 1]}
          </p>

          <div className="min-h-[280px]">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={step}
                custom={direction}
                variants={slide}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {step === 1 && (
                  <MealTypeSelector
                    selectedType={mealType}
                    onSelect={(v) => {
                      setMealType(v);
                      setSelection(null);
                      setKitchenId(null);
                      setKitchenTouched(false);
                    }}
                  />
                )}

                {step === 2 && (
                  <KitchenSelector
                    selectedKitchenId={kitchenId}
                    onSelect={(id) => {
                      setKitchenId(id);
                      setKitchenTouched(true);
                      setSelection(null);
                    }}
                  />
                )}

                {step === 3 && (
                  <div className="space-y-3">
                    <Tabs defaultValue="catalog">
                      <TabsList className="w-full">
                        <TabsTrigger value="catalog" className="flex-1">
                          {t("mealFlow.tabPlan")}
                        </TabsTrigger>
                        <TabsTrigger value="db" className="flex-1">
                          {t("mealFlow.tabDb")}
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="catalog" className="pt-3">
                        <MealSelector
                          meals={filteredMeals}
                          isLoading={mealsLoading}
                          planMealId={planMealId}
                          onSelect={(meal) => {
                            const def = meal.sizes?.find((s) => s.is_default) || meal.sizes?.[0] || null;
                            setSelection({ kind: "meal", meal, size: def });
                            setTimeout(next, 120);
                          }}
                        />
                      </TabsContent>
                      <TabsContent value="db" className="pt-3">
                        <p className="text-[11px] text-muted-foreground mb-2">
                          {t("mealFlow.dbCount")}
                        </p>
                        <FoodItemSelector
                          subscriber={subscriber}
                          onSelect={(item) => {
                            setSelection({ kind: "food", item });
                            setPortionMult(1);
                            setTimeout(next, 120);
                          }}
                        />
                      </TabsContent>
                    </Tabs>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setManualOpen(true)}
                    >
                      <PenLine className="w-4 h-4" />
                      {t("mealFlow.manualEntry")}
                    </Button>
                  </div>
                )}

                {step === 4 && selection?.kind === "meal" && (
                  <div className="grid grid-cols-1 gap-2">
                    {(selection.meal.sizes || []).map((s) => {
                      const active = selection.size?.size_name === s.size_name;
                      return (
                        <button
                          key={s.size_name}
                          type="button"
                          onClick={() => setSelection({ ...selection, size: s })}
                          className={`flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${
                            active
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border bg-card hover:bg-secondary text-foreground"
                          }`}
                        >
                          <span className="font-medium">{s.size_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {s.calories} {t("common.cal")}
                            {s.protein != null && ` · 💪${s.protein}g`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {step === 4 && selection?.kind === "food" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? selection.item.name_ar : selection.item.name_en || selection.item.name_ar}
                      {" · "}
                      {language === "ar"
                        ? selection.item.serving_desc_ar || `${selection.item.portion_grams}${t("mealFlow.gram")}`
                        : selection.item.serving_desc_en || `${selection.item.portion_grams}g`}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {PORTION_MULTIPLIERS.map((m) => {
                        const active = portionMult === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPortionMult(m)}
                            className={`p-3 rounded-xl border text-center transition-all ${
                              active
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border bg-card hover:bg-secondary text-foreground"
                            }`}
                          >
                            <p className="font-bold text-sm">×{m}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {Math.round((selection.item.calories || 0) * m)} {t("common.cal")}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-3">
                    <MealWarnings warnings={evaluation.warnings} />
                    {!evaluation.allowed && (
                      <label className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={overrideConfirmed}
                          onChange={(e) => setOverrideConfirmed(e.target.checked)}
                          className="mt-1 accent-red-600"
                        />
                        <span>{t("mealFlow.override")}</span>
                      </label>
                    )}
                  </div>
                )}

                {step === 6 && selection && (
                  <div className="space-y-3">
                    <div className="bg-primary/5 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">
                          {selection.kind === "meal"
                            ? language === "ar" ? selection.meal.name : selection.meal.name_en || selection.meal.name
                            : selection.kind === "food"
                              ? language === "ar" ? selection.item.name_ar : selection.item.name_en || selection.item.name_ar
                              : selection.name}
                        </p>
                        {followedPlan && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {t("mealFlow.fromPlan")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(`mealFlow.types.${mealType}`)} ·{" "}
                        {selection.kind === "meal"
                          ? selection.size?.size_name
                          : selection.kind === "food"
                            ? `${Math.round((selection.item.portion_grams || 0) * portionMult)}${t("mealFlow.gram")}`
                            : selection.sizeLabel}
                      </p>
                      <div className="grid grid-cols-4 gap-2 text-center text-sm pt-1">
                        {(() => {
                          const cal = selection.kind === "meal" ? selection.size?.calories
                            : selection.kind === "food" ? (selection.item.calories || 0) * portionMult
                            : selection.calories;
                          const p = selection.kind === "meal" ? selection.size?.protein
                            : selection.kind === "food" ? (selection.item.protein_g || 0) * portionMult
                            : selection.protein;
                          const c = selection.kind === "meal" ? selection.size?.carbs
                            : selection.kind === "food" ? (selection.item.carbs_g || 0) * portionMult
                            : selection.carbs;
                          const f = selection.kind === "meal" ? selection.size?.fat
                            : selection.kind === "food" ? (selection.item.fat_g || 0) * portionMult
                            : selection.fat;
                          return (
                            <>
                              <div><p className="text-lg font-bold text-primary">{Math.round(cal || 0)}</p><p className="text-xs text-muted-foreground">{t("common.cal")}</p></div>
                              <div><p className="text-lg font-bold text-foreground">{p != null ? Math.round(p) : "—"}g</p><p className="text-xs text-muted-foreground">{t("wizard.protein")}</p></div>
                              <div><p className="text-lg font-bold text-foreground">{c != null ? Math.round(c) : "—"}g</p><p className="text-xs text-muted-foreground">{t("wizard.carbs")}</p></div>
                              <div><p className="text-lg font-bold text-foreground">{f != null ? Math.round(f) : "—"}g</p><p className="text-xs text-muted-foreground">{t("wizard.fat")}</p></div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      ⚕️ {t("mealFlow.disclaimer")}
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer navigation */}
          <div className="flex gap-2 pt-2">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={back} className="gap-1">
                <BackIcon className="w-4 h-4" />
                {t("mealFlow.back")}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
            )}
            {step < TOTAL_STEPS ? (
              <Button type="button" onClick={next} disabled={!canNext} className="flex-1 gap-1">
                {t("mealFlow.next")}
                <NextIcon className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => logMutation.mutate()}
                disabled={!selection || logMutation.isPending}
                className="flex-1 bg-primary text-primary-foreground"
              >
                {logMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("mealFlow.save")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ManualMealEntry
        isOpen={manualOpen}
        onClose={() => setManualOpen(false)}
        onSubmit={handleManualSubmit}
      />
    </>
  );
}
