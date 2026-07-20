import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useT, useLanguage } from "@/i18n";
import { evaluateFoodForProfile } from "@/lib/nutrition/engine";
import { normalizeText, buildEngineProfile, useFoodIndexItems } from "./conditions";

const CATEGORY_EMOJI = {
  rice_main: "🍚",
  sweets: "🍮",
  fast_food: "🍔",
  vegetable: "🥦",
  bread_grain: "🍞",
  packaged_snack: "🍿",
  beverage: "🥤",
  fish_seafood: "🐟",
  meat: "🥩",
  fruit: "🍎",
  dairy: "🧀",
  egg_breakfast: "🍳",
  salad: "🥗",
  soup: "🍲",
  condiment: "🧂",
  nuts_seeds: "🌰",
  legume: "🫘",
  poultry: "🍗",
  oil_fat: "🫒",
};

const MAX_RESULTS = 30;

/**
 * Debounced bilingual search over the bundled slim food index
 * (src/data/food_index.json, 5000+ items). Arabic normalization handles
 * diacritics/tatweel/alef variants/ة-ه. Items that the nutrition engine
 * flags for the subscriber's conditions get a ⚕️ badge.
 *
 * Props: subscriber (Subscriber record), onSelect(item).
 */
export default function FoodItemSelector({ subscriber, onSelect }) {
  const t = useT();
  const { language } = useLanguage();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState(null);
  // The slim index (~2 MB) is loaded as an async chunk on first use so the
  // main bundle stays lean.
  const items = useFoodIndexItems();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(id);
  }, [search]);

  const profile = useMemo(() => buildEngineProfile(subscriber), [subscriber]);

  const categories = useMemo(() => {
    if (!items) return [];
    const counts = new Map();
    for (const it of items) counts.set(it.category, (counts.get(it.category) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [items]);

  const results = useMemo(() => {
    if (!items) return [];
    const q = normalizeText(debounced);
    let pool = items;
    if (category) pool = pool.filter((it) => it.category === category);
    if (q) {
      pool = pool.filter(
        (it) =>
          normalizeText(it.name_ar).includes(q) ||
          normalizeText(it.name_en).includes(q)
      );
    }
    return pool.slice(0, MAX_RESULTS);
  }, [items, debounced, category]);

  if (!items) {
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
          placeholder={t("mealFlow.searchFood")}
          className="ps-9"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !category
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border bg-card text-muted-foreground hover:bg-secondary"
          }`}
        >
          ✨ {t("mealFlow.allCategories")}
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(category === c ? null : c)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              category === c
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {CATEGORY_EMOJI[c] || "🍽️"} {t(`mealFlow.categories.${c}`)}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">
          {t("mealFlow.noMeals")}
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pe-1">
          {results.map((item) => {
            const evalResult = profile
              ? evaluateFoodForProfile(item, profile)
              : { allowed: true, warnings: [] };
            const hasDanger = !evalResult.allowed;
            const hasCaution = evalResult.warnings.length > 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item, evalResult)}
                className="w-full text-start bg-card border border-border rounded-xl p-3 hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-foreground">
                    {language === "ar" ? item.name_ar : item.name_en || item.name_ar}
                  </p>
                  {(hasDanger || hasCaution) && (
                    <span
                      className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        hasDanger
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      ⚕️ {t("mealFlow.warningBadge")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.calories} {t("common.cal")} ·{" "}
                  {language === "ar"
                    ? item.serving_desc_ar || `${item.portion_grams}${t("mealFlow.gram")}`
                    : item.serving_desc_en || `${item.portion_grams}g`}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
