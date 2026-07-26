import { CheckCircle2, PartyPopper, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT, useLanguage } from "@/i18n";

/** Success screen after completeOnboarding returns ok:true. */
export default function SuccessScreen({ groupName, trialEndsAt, onContinue }) {
  const t = useT();
  const { language } = useLanguage();

  let trialText = t("onboarding.success.trialNoDate");
  if (trialEndsAt) {
    try {
      const date = new Intl.DateTimeFormat(language === "ar" ? "ar-u-ca-gregory" : "en", {
        dateStyle: "long",
      }).format(new Date(trialEndsAt));
      trialText = t("onboarding.success.trialValue", { date });
    } catch {
      trialText = t("onboarding.success.trialNoDate");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{t("onboarding.success.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("onboarding.success.subtitle")}</p>

        <div className="space-y-3 mb-8">
          {/* Assigned group */}
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card px-5 py-4 text-start">
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">{t("onboarding.success.groupLabel")}</p>
              <p className="font-bold text-foreground truncate">
                {groupName || t("onboarding.success.groupPending")}
              </p>
            </div>
          </div>

          {/* Trial */}
          <div className="flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4 text-start">
            <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <PartyPopper className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">{t("onboarding.success.trialLabel")}</p>
              <p className="font-bold text-foreground">{trialText}</p>
            </div>
          </div>
        </div>

        <Button
          onClick={onContinue}
          className="w-full bg-accent hover:bg-accent/90 text-white py-6 text-base font-bold"
        >
          {t("onboarding.success.cta")}
        </Button>
      </div>
    </div>
  );
}
