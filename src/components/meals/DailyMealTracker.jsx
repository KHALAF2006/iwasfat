import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Droplets, CheckCircle2, Circle, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useT } from "@/i18n";
import { calculateWaterGoal } from "@/lib/nutrition/engine";
import { buildEngineProfile } from "./conditions";
import { showApiError } from "@/lib/api-error";

// Main meals: entity-native fields including *_completed.
const MEAL_SLOTS = [
  { key: "breakfast", emoji: "🍳", type: "breakfast", labelKey: "mealFlow.types.breakfast" },
  { key: "lunch", emoji: "🍽️", type: "lunch", labelKey: "mealFlow.types.lunch" },
  { key: "dinner", emoji: "🌙", type: "dinner", labelKey: "mealFlow.types.dinner" },
];

// Snacks & drinks: the entity stores names/macros but no completed flags;
// we persist a custom `*_completed` boolean plus a matching FoodLog.
const EXTRA_SLOTS = [
  { key: "morning_snack", emoji: "🍎", type: "snack", labelKey: "mealFlow.morningSnack", hasMacros: true },
  { key: "afternoon_snack", emoji: "🍪", type: "snack", labelKey: "mealFlow.afternoonSnack", hasMacros: true },
  { key: "morning_drink", emoji: "☕", type: "snack", labelKey: "mealFlow.morningDrink", hasMacros: false },
  { key: "afternoon_drink", emoji: "🥤", type: "snack", labelKey: "mealFlow.afternoonDrink", hasMacros: false },
];

/**
 * Today's plan tracker: main meals + morning/afternoon snacks + drinks,
 * each with its own completion checkbox. Completing writes both the
 * DailyMealPlan slot AND a matching FoodLog (followed_plan:true);
 * un-completing removes that FoodLog. Water is tracked solely on
 * DailyMealPlan.water_cups_consumed (row created on first use).
 */
export default function DailyMealTracker({ subscriber }) {
  const subscriberId = subscriber?.id;
  const today = format(new Date(), "yyyy-MM-dd");
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);
  const t = useT();

  const { data: dailyPlan } = useQuery({
    queryKey: ["dailyPlan", subscriberId, today],
    queryFn: async () => {
      const plans = await base44.entities.DailyMealPlan.filter({ subscriber_id: subscriberId, date: today });
      return plans[0] || null;
    },
    enabled: !!subscriberId,
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ["foodLogs", today, subscriberId],
    queryFn: () => base44.entities.FoodLog.filter({ date: today, subscriber_id: subscriberId }),
    enabled: !!subscriberId,
  });

  const profile = buildEngineProfile(subscriber);
  const engineWaterCups = profile ? calculateWaterGoal(profile).cups : null;
  const waterGoal = engineWaterCups || dailyPlan?.water_cups_goal || 8;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dailyPlan", subscriberId, today] });
    queryClient.invalidateQueries({ queryKey: ["dailyPlan"] });
    queryClient.invalidateQueries({ queryKey: ["foodLogs"] });
  };

  // Find the FoodLog this tracker created for a slot.
  const findSlotLog = (slot, name) =>
    todayLogs.find(
      (l) =>
        l.meal_type === slot.type &&
        l.followed_plan === true &&
        typeof l.actual_food === "string" &&
        name &&
        l.actual_food.startsWith(name)
    );

  const toggleSlotMutation = useMutation({
    mutationFn: async ({ slot, name, complete }) => {
      if (!dailyPlan) return;
      if (complete) {
        const isMain = !!slot.isMain;
        const size = isMain ? dailyPlan[`${slot.key}_size`] : null;
        await base44.entities.FoodLog.create({
          subscriber_id: subscriberId,
          date: today,
          meal_type: slot.type,
          followed_plan: true,
          actual_food: size ? `${name} (${size})` : name,
          calories: dailyPlan[`${slot.key}_calories`] || 0,
          protein: dailyPlan[`${slot.key}_protein`] ?? null,
          carbs: dailyPlan[`${slot.key}_carbs`] ?? null,
          fat: dailyPlan[`${slot.key}_fat`] ?? null,
        });
        await base44.entities.DailyMealPlan.update(dailyPlan.id, {
          [`${slot.key}_completed`]: true,
        });
      } else {
        const log = findSlotLog(slot, name);
        if (log) await base44.entities.FoodLog.delete(log.id);
        await base44.entities.DailyMealPlan.update(dailyPlan.id, {
          [`${slot.key}_completed`]: false,
        });
      }
    },
    onSuccess: invalidate,
    onError: (err) => showApiError(err),
  });

  const waterMutation = useMutation({
    mutationFn: async (delta) => {
      if (!dailyPlan) {
        // Single source of truth: create today's plan row on first use.
        await base44.entities.DailyMealPlan.create({
          subscriber_id: subscriberId,
          date: today,
          water_cups_goal: waterGoal,
          water_cups_consumed: Math.max(0, delta),
        });
        return;
      }
      const nextVal = Math.max(0, Math.min((dailyPlan.water_cups_consumed || 0) + delta, waterGoal));
      await base44.entities.DailyMealPlan.update(dailyPlan.id, { water_cups_consumed: nextVal });
    },
    onSuccess: invalidate,
    onError: (err) => showApiError(err),
  });

  const renderSlot = (slot, isMain) => {
    const nameKey = isMain ? `${slot.key}_meal_name` : `${slot.key}_name`;
    const name = dailyPlan?.[nameKey];
    if (!name) return null;
    const size = isMain ? dailyPlan[`${slot.key}_size`] : null;
    const cal = slot.hasMacros !== false ? dailyPlan?.[`${slot.key}_calories`] : null;
    const completed =
      dailyPlan?.[`${slot.key}_completed`] === true || !!findSlotLog(slot, name);
    return (
      <div
        key={slot.key}
        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${completed ? "bg-primary/5" : "bg-secondary/40"}`}
      >
        <span className="text-lg">{slot.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${completed ? "text-primary line-through" : "text-foreground"}`}>
            {name}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(slot.labelKey)}
            {size && ` · ${size}`}
            {cal != null && cal > 0 && ` · ${cal} ${t("common.cal")}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            toggleSlotMutation.mutate({ slot: { ...slot, isMain }, name, complete: !completed })
          }
          className="shrink-0"
          disabled={toggleSlotMutation.isPending}
        >
          {completed ? (
            <CheckCircle2 className="w-6 h-6 text-primary" />
          ) : (
            <Circle className="w-6 h-6 text-muted-foreground" />
          )}
        </button>
      </div>
    );
  };

  const waterConsumed = dailyPlan?.water_cups_consumed || 0;
  const totalCal = dailyPlan?.total_calories_goal || 1500;
  const consumedCal = dailyPlan
    ? MEAL_SLOTS.concat(EXTRA_SLOTS).reduce((sum, s) => {
        const done = dailyPlan[`${s.key}_completed`];
        return sum + (done ? dailyPlan[`${s.key}_calories`] || 0 : 0);
      }, 0)
    : 0;

  const hasAnyMeal =
    dailyPlan &&
    (MEAL_SLOTS.some((s) => dailyPlan[`${s.key}_meal_name`]) ||
      EXTRA_SLOTS.some((s) => dailyPlan[`${s.key}_name`]));

  return (
    <div className="space-y-4">
      {/* Progress Summary */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">{t("components.tracker.planToday")}</h3>
          {dailyPlan?.notes && (
            <button type="button" onClick={() => setShowDetails(!showDetails)} className="text-muted-foreground">
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        {hasAnyMeal ? (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">{t("components.tracker.consumedCal")}</span>
              <span className="font-medium text-foreground">
                {consumedCal} / {totalCal}
              </span>
            </div>
            <Progress value={Math.min((consumedCal / totalCal) * 100, 100)} className="h-2 mb-4" />
            <div className="space-y-2">
              {MEAL_SLOTS.map((s) => renderSlot(s, true))}
              {EXTRA_SLOTS.map((s) => renderSlot(s, false))}
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-muted-foreground text-sm">{t("components.tracker.noPlan")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("components.tracker.noPlanHint")}</p>
          </div>
        )}

        {showDetails && dailyPlan?.notes && (
          <p className="text-xs text-muted-foreground mt-3 bg-secondary/30 rounded-lg p-3">{dailyPlan.notes}</p>
        )}
      </div>

      {/* Water Tracker — single source of truth: DailyMealPlan.water_cups_consumed */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-foreground">{t("components.tracker.water")}</h3>
          </div>
          <span className="text-sm font-medium text-foreground">
            {waterConsumed}/{waterGoal} {t("components.tracker.cups")}
          </span>
        </div>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {Array.from({ length: waterGoal }).map((_, i) => (
            <div key={i} className={`w-6 h-6 rounded-full transition-colors ${i < waterConsumed ? "bg-blue-400" : "bg-secondary"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => waterMutation.mutate(1)}
            disabled={waterConsumed >= waterGoal || waterMutation.isPending}
            variant="outline"
            className="flex-1 text-sm gap-1"
            size="sm"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("components.tracker.addWater")}
          </Button>
          <Button
            type="button"
            onClick={() => waterMutation.mutate(-1)}
            disabled={waterConsumed <= 0 || waterMutation.isPending}
            variant="ghost"
            size="sm"
            className="text-sm"
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
