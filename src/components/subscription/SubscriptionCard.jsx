import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, ExternalLink } from "lucide-react";
import { useT, useLanguage } from "@/i18n";
import { useToast } from "@/components/ui/use-toast";

// Real subscription status card for Settings: plan name, status, renewal
// date, trial countdown, grace warning, and the Stripe billing-portal CTA.
export default function SubscriptionCard({ subscriber }) {
  const t = useT();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: () => base44.entities.Plan.list(),
  });

  const plan = plans.find((p) => p.id === subscriber.plan_id);
  const planName = plan ? (language === "ar" ? plan.name_ar : plan.name_en) : null;

  const status = subscriber.subscription_status;
  const trialDaysLeft = subscriber.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscriber.trial_ends_at) - Date.now()) / 86400000))
    : null;
  const inGrace = status === "expired" && subscriber.grace_ends_at && new Date(subscriber.grace_ends_at) > new Date();

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(language === "ar" ? "ar-SA" : "en-GB") : null);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await base44.functions.invoke("createPortalSession", {});
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error("no url");
      }
    } catch {
      toast({ title: t("billing.portalError"), variant: "destructive" });
      setPortalLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" /> {t("billing.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
          <span className="text-sm text-muted-foreground">{t("billing.status")}</span>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${
            status === "active" ? "bg-primary/10 text-primary" :
            status === "trial" ? "bg-accent/10 text-accent" :
            "bg-destructive/10 text-destructive"
          }`}>
            {t(`billing.statuses.${status}`)}
          </span>
        </div>

        {planName && (
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
            <span className="text-sm text-muted-foreground">{t("billing.plan")}</span>
            <span className="text-sm font-medium text-foreground">
              {planName} · {plan.price} {t("billing.sar")}/{t(`billing.${plan.interval}`)}
            </span>
          </div>
        )}

        {status === "trial" && trialDaysLeft !== null && (
          <p className="text-xs text-accent text-center font-medium">
            ⏳ {t("billing.trialDaysLeft", { days: trialDaysLeft })}
            {subscriber.trial_ends_at && ` · ${t("billing.trialEnds")} ${fmtDate(subscriber.trial_ends_at)}`}
          </p>
        )}

        {status === "active" && subscriber.subscription_renews_at && (
          <p className="text-xs text-muted-foreground text-center">
            {t("billing.renewsAt")} {fmtDate(subscriber.subscription_renews_at)}
          </p>
        )}

        {subscriber.cancel_at_period_end && (
          <p className="text-xs text-destructive text-center">{t("billing.cancelAtPeriodEnd")}</p>
        )}

        {inGrace && (
          <p className="text-xs text-destructive text-center font-medium">
            ⚠️ {t("billing.graceNote", { date: fmtDate(subscriber.grace_ends_at) })}
          </p>
        )}

        {subscriber.stripe_customer_id ? (
          <>
            <Button onClick={openPortal} disabled={portalLoading} variant="outline" className="w-full gap-2">
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {t("billing.manage")}
            </Button>
            <p className="text-xs text-muted-foreground text-center">{t("billing.manageHint")}</p>
          </>
        ) : (
          <Button onClick={() => { window.location.href = "/#pricing"; }} className="w-full gap-2 bg-accent hover:bg-accent/90 text-white">
            {t("billing.subscribe")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
