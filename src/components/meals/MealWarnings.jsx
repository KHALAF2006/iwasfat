import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import { CHRONIC_CONDITIONS } from "@/lib/nutrition/engine";
import { useT, useLanguage } from "@/i18n";

const SEVERITY_STYLE = {
  danger: {
    icon: AlertOctagon,
    cls: "border-red-300 bg-red-50 text-red-800",
    emoji: "🔴",
  },
  caution: {
    icon: AlertTriangle,
    cls: "border-amber-300 bg-amber-50 text-amber-800",
    emoji: "🟡",
  },
  info: {
    icon: Info,
    cls: "border-blue-300 bg-blue-50 text-blue-800",
    emoji: "🔵",
  },
};

/**
 * Renders engine-shaped evaluation warnings
 * ({ condition, severity, message_ar, message_en }) with severity colors,
 * plus the physician caution text of every triggered condition and a
 * guidance-not-prescription disclaimer.
 *
 * Props:
 *  - warnings: engine warning array (may be empty)
 *  - showDoctorNotes: also render CHRONIC_CONDITIONS doctor_caution text
 *  - className: optional wrapper classes
 */
export default function MealWarnings({ warnings = [], showDoctorNotes = true, className = "" }) {
  const t = useT();
  const { language } = useLanguage();
  const isAr = language === "ar";

  if (!warnings.length) {
    return (
      <div className={`rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ${className}`}>
        {t("mealFlow.medNone")}
      </div>
    );
  }

  const triggeredConditions = [...new Set(warnings.map((w) => w.condition))];

  return (
    <div className={`space-y-2 ${className}`}>
      {warnings.map((w, i) => {
        const style = SEVERITY_STYLE[w.severity] || SEVERITY_STYLE.info;
        const Icon = style.icon;
        return (
          <div key={i} className={`flex items-start gap-2 border rounded-xl px-3 py-2.5 text-sm ${style.cls}`}>
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{isAr ? w.message_ar : w.message_en}</span>
          </div>
        );
      })}

      {showDoctorNotes &&
        triggeredConditions.map((key) => {
          const cond = CHRONIC_CONDITIONS[key];
          if (!cond) return null;
          return (
            <div
              key={key}
              className="rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground"
            >
              <p className="font-semibold text-foreground mb-1">
                {cond.emoji} {isAr ? cond.name_ar : cond.name_en} — {t("mealFlow.doctorNote")}
              </p>
              <p>{isAr ? cond.doctor_caution_ar : cond.doctor_caution_en}</p>
            </div>
          );
        })}

      <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
        ⚕️ {t("mealFlow.disclaimer")}
      </p>
    </div>
  );
}
