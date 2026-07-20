import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useT, useLanguage } from "@/i18n";
import { normalizeText } from "./conditions";

/**
 * Step-3 picker: searchable list of catalog Meal records (already filtered
 * by meal type + kitchen by the parent). Shows calories for each available
 * size and a badge on the meal that comes from today's plan.
 */
export default function MealSelector({ meals = [], isLoading, planMealId, onSelect }) {
  const t = useT();
  const { language } = useLanguage();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return meals;
    return meals.filter(
      (m) =>
        normalizeText(m.name).includes(q) ||
        normalizeText(m.name_en).includes(q)
    );
  }, [meals, search]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("mealFlow.searchMeals")}
          className="ps-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">
          {t("mealFlow.noMeals")}
        </p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
          {filtered.map((meal) => {
            const sizes = meal.sizes || [];
            const minCal = sizes.length
              ? Math.min(...sizes.map((s) => s.calories || 0))
              : null;
            const maxCal = sizes.length
              ? Math.max(...sizes.map((s) => s.calories || 0))
              : null;
            const isPlanMeal = planMealId && meal.id === planMealId;
            return (
              <button
                key={meal.id}
                type="button"
                onClick={() => onSelect(meal)}
                className="w-full text-start bg-card border border-border rounded-xl p-3 hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-foreground">
                    {language === "ar" ? meal.name : meal.name_en || meal.name}
                  </p>
                  {isPlanMeal && (
                    <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      {t("mealFlow.fromPlan")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sizes.length > 0 && (
                    <>
                      {minCal === maxCal ? minCal : `${minCal}–${maxCal}`}{" "}
                      {t("common.cal")} · {sizes.map((s) => s.size_name).join(" / ")}
                    </>
                  )}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
