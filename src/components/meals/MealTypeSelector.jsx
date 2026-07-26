import { useT, useLanguage } from "@/i18n";

const MEAL_TYPES = [
  { value: "breakfast", emoji: "🍳" },
  { value: "lunch", emoji: "🍽️" },
  { value: "dinner", emoji: "🌙" },
  { value: "snack", emoji: "🍎" },
];

/** Step-1 picker: فطار / غداء / عشاء / سناك with emoji. */
export default function MealTypeSelector({ selectedType, onSelect }) {
  const t = useT();
  const { language } = useLanguage();

  return (
    <div className="grid grid-cols-2 gap-3">
      {MEAL_TYPES.map((type) => {
        const active = selectedType === type.value;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onSelect(type.value)}
            className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border text-sm font-medium transition-all ${
              active
                ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/30"
                : "border-border bg-card hover:bg-secondary text-foreground"
            }`}
          >
            {active && (
              <span className="absolute top-1.5 end-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] leading-none flex items-center justify-center">
                ✓
              </span>
            )}
            <span className="text-3xl">{type.emoji}</span>
            <span>{t(`mealFlow.types.${type.value}`)}</span>
          </button>
        );
      })}
    </div>
  );
}