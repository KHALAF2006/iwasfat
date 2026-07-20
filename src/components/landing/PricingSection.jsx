import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useT, useLanguage } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

// Live pricing: plans are rendered from the Plan entity. The CTA starts a
// Stripe Checkout Session (server-side plan lookup — the price is never
// trusted from the client). Anonymous visitors are sent to /register first.
export default function PricingSection() {
  const t = useT();
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [checkoutPlanId, setCheckoutPlanId] = useState(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans-public"],
    queryFn: async () => {
      const rows = await base44.entities.Plan.filter({ is_active: true });
      return rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
  });

  const startCheckout = async (plan) => {
    setCheckoutPlanId(plan.id);
    try {
      const res = await base44.functions.invoke("createCheckoutSession", { plan_id: plan.id });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error("no url");
      }
    } catch {
      toast({ title: t("billing.checkoutError"), variant: "destructive" });
      setCheckoutPlanId(null);
    }
  };

  return (
    <section id="pricing" className="py-24 px-6 bg-background">
      <div className="max-w-5xl mx-auto text-center">
        <div className="mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t("landing.pricing.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            {t("landing.pricing.subtitle")}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <p className="text-muted-foreground">{t("billing.noPlans")}</p>
        ) : (
          <div className={`grid gap-6 max-w-4xl mx-auto ${
            plans.length >= 3 ? "md:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2" : ""
          }`}>
            {plans.map((plan, idx) => {
              const name = language === "ar" ? plan.name_ar : plan.name_en;
              const features = (language === "ar" ? plan.features_ar : plan.features_en) || [];
              const isPopular = plans.length > 1 && idx === Math.floor(plans.length / 2);
              return (
                <div
                  key={plan.id}
                  className={`bg-card rounded-3xl border shadow-xl overflow-hidden flex flex-col ${
                    isPopular ? "border-accent/60 ring-2 ring-accent/20" : "border-border/50"
                  }`}
                >
                  <div className="bg-primary p-8 relative">
                    {isPopular && (
                      <span className="absolute top-3 start-3 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
                        {t("billing.mostPopular")}
                      </span>
                    )}
                    <p className="text-primary-foreground/70 text-sm mb-2">{name}</p>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-bold text-primary-foreground">{plan.price}</span>
                      <span className="text-primary-foreground/70">
                        {t("billing.sar")} / {t(`billing.${plan.interval}`)}
                      </span>
                    </div>
                    {plan.trial_days > 0 && (
                      <p className="text-primary-foreground/60 text-sm mt-2">
                        🎁 {t("billing.freeTrialBadge", { days: plan.trial_days })}
                      </p>
                    )}
                  </div>

                  <div className="p-8 flex flex-col flex-1">
                    <ul className="space-y-4 text-start mb-8 flex-1">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {isAuthenticated ? (
                      <Button
                        size="lg"
                        onClick={() => startCheckout(plan)}
                        disabled={checkoutPlanId === plan.id}
                        className="w-full bg-accent hover:bg-accent/90 text-white text-lg py-6 rounded-xl gap-2"
                      >
                        {checkoutPlanId === plan.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            {t("billing.subscribeCta")}
                            <ArrowLeft className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <Link to="/register">
                        <Button size="lg" className="w-full bg-accent hover:bg-accent/90 text-white text-lg py-6 rounded-xl gap-2">
                          {t("billing.subscribeCta")}
                          <ArrowLeft className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
                        </Button>
                      </Link>
                    )}
                    <p className="text-xs text-muted-foreground mt-4">
                      {t("landing.pricing.cancelNote")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
