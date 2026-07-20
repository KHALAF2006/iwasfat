import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SmartMealWizard from "@/components/meals/SmartMealWizard";
import DailyMealTracker from "@/components/meals/DailyMealTracker";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useT, useLanguage } from "@/i18n";

const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

export default function Meals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [initialMealType, setInitialMealType] = useState("");
  const t = useT();
  const { language } = useLanguage();

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
  });

  // Deep link: /meals?log=<meal_type> auto-opens the wizard for that meal type.
  useEffect(() => {
    const logType = searchParams.get("log");
    if (logType && VALID_MEAL_TYPES.includes(logType)) {
      setInitialMealType(logType);
      setWizardOpen(true);
      // Consume the param so a refresh doesn't re-open the wizard.
      searchParams.delete("log");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleWizardClose = () => {
    setWizardOpen(false);
    setInitialMealType("");
  };

  return (
    <div className="px-4 pt-6 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("meals.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), 'EEEE، d MMMM', { locale: language === "ar" ? ar : enUS })}
          </p>
        </div>
        <Button
          onClick={() => setWizardOpen(true)}
          className="gap-2"
        >
          <Plus className="w-5 h-5" />
          {t("meals.newMeal")}
        </Button>
      </div>

      {subscriber && (
        <DailyMealTracker subscriber={subscriber} />
      )}

      <SmartMealWizard
        open={wizardOpen}
        onClose={handleWizardClose}
        subscriber={subscriber}
        initialMealType={initialMealType}
      />
    </div>
  );
}
