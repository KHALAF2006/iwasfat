import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useT, useLanguage } from "@/i18n";

/**
 * Step-2 picker: cuisine filter from the Kitchen entity. `null` selection
 * means "all kitchens". `defaultKitchenId` (e.g. derived from the
 * subscriber's group plan) is pre-selected by the parent.
 */
export default function KitchenSelector({ selectedKitchenId, onSelect }) {
  const t = useT();
  const { language } = useLanguage();

  const { data: kitchens = [], isLoading } = useQuery({
    queryKey: ["kitchens"],
    queryFn: () => base44.entities.Kitchen.filter({ is_active: true }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const sorted = [...kitchens].sort(
    (a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)
  );

  const renderButton = (id, icon, label) => {
    const active = (selectedKitchenId ?? null) === id;
    return (
      <button
        key={id ?? "all"}
        type="button"
        onClick={() => onSelect(id)}
        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all ${
          active
            ? "border-primary bg-primary/5 text-primary shadow-sm scale-[1.02]"
            : "border-border bg-card hover:bg-secondary text-foreground"
        }`}
      >
        <span className="text-2xl">{icon}</span>
        <span className="text-center leading-tight">{label}</span>
      </button>
    );
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {renderButton(null, "🌍", t("mealFlow.allKitchens"))}
      {sorted.map((k) =>
        renderButton(
          k.id,
          k.icon || "🍽️",
          language === "ar" ? k.name : k.name_en || k.name
        )
      )}
    </div>
  );
}
