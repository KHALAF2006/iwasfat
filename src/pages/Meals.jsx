import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import SmartMealWizard from "@/components/meals/SmartMealWizard";
import DailyMealTracker from "@/components/meals/DailyMealTracker";
import { Utensils, Plus } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function Meals() {
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
  });

  return (
    <div className="px-4 pt-6 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">وجباتي</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), 'EEEE، d MMMM', { locale: ar })}
          </p>
        </div>
        <Button 
          onClick={() => setWizardOpen(true)}
          className="gap-2"
        >
          <Plus className="w-5 h-5" />
          وجبة جديدة
        </Button>
      </div>

      {subscriber && (
        <DailyMealTracker subscriberId={subscriber.id} />
      )}

      <SmartMealWizard 
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        subscriberId={subscriber?.id}
      />
    </div>
  );
}