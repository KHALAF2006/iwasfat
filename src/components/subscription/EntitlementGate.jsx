import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

// checkEntitlement — same rule as the server-side pattern in
// base44/functions/sendDailyReminders:
//   allowed = status active
//          OR (trial   AND (no trial_ends_at [legacy] OR now < trial_ends_at))
//          OR (expired AND grace_ends_at set AND now < grace_ends_at)
export function isEntitled(subscriber, now = new Date()) {
  if (!subscriber) return false;
  const status = subscriber.subscription_status;
  if (status === "active") return true;
  if (status === "trial") {
    if (!subscriber.trial_ends_at) return true; // legacy client-side trial
    return new Date(subscriber.trial_ends_at) > now;
  }
  if (status === "expired") {
    return !!subscriber.grace_ends_at && new Date(subscriber.grace_ends_at) > now;
  }
  return false;
}

// Wraps app content; users expired beyond the grace period see a lock screen
// with a renewal CTA. Wired into Settings for now — the exact 3-line change to
// gate the whole app (App.jsx, owned by the parent agent) is in the report.
export default function EntitlementGate({ subscriber, children }) {
  const t = useT();
  const navigate = useNavigate();

  if (subscriber === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No subscriber record yet (fresh registration) — let them through; the
  // register flow owns onboarding.
  if (!subscriber || isEntitled(subscriber)) {
    return children;
  }

  return (
    <div className="px-4 pt-16 pb-24 max-w-md mx-auto text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
        <Lock className="w-8 h-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">{t("billing.locked.title")}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{t("billing.locked.body")}</p>
      </div>
      <Button
        size="lg"
        className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl"
        onClick={() => navigate("/#pricing")}
      >
        {t("billing.locked.cta")}
      </Button>
    </div>
  );
}
