import { useMemo, useState } from "react";
import { Cake, Check } from "lucide-react";
import { useT } from "@/i18n";

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

export const computeAge = (year, month, day) => {
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) {
    age -= 1;
  }
  return age;
};

export const ageGroupKey = (age) => {
  if (age < 18) return "under18";
  if (age <= 29) return "g18_29";
  if (age <= 44) return "g30_44";
  if (age <= 59) return "g45_59";
  return "g60plus";
};

/**
 * Step 2 — custom year-first birth-date picker.
 * Year grid (current-10 … current-90) → month buttons (localized names) →
 * day grid (leap-year aware). Big touch targets, ring + check selected state.
 * No native date inputs, no animations gating visibility.
 */
export default function BirthDateStep({ value, onChange }) {
  const t = useT();
  const { year, month, day } = value;
  const [view, setView] = useState(year ? (month ? "day" : "month") : "year");

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 81 }, (_, i) => currentYear - 10 - i),
    [currentYear]
  );
  const months = t("onboarding.birth.months");
  const dim = year && month ? daysInMonth(year, month) : 31;

  const complete = !!(year && month && day);
  const age = complete ? computeAge(year, month, day) : null;
  const ageError = complete && age !== null && (age < 10 ? "errYoung" : age > 100 ? "errOld" : null);

  const selectYear = (y) => {
    const nextDay = day && month ? Math.min(day, daysInMonth(y, month)) : day;
    onChange({ year: y, month, day: nextDay });
    setView("month");
  };
  const selectMonth = (m) => {
    const nextDay = day && year ? Math.min(day, daysInMonth(year, m)) : day;
    onChange({ year, month: m, day: nextDay });
    setView("day");
  };
  const selectDay = (d) => onChange({ year, month, day: d });

  const crumb = (labelKey, labelValue, targetView, filled) => (
    <button
      type="button"
      onClick={() => setView(targetView)}
      className={`flex-1 min-h-[44px] rounded-xl border px-2 py-2 text-sm transition-colors ${
        view === targetView
          ? "border-primary bg-primary/10 text-primary font-semibold"
          : filled
            ? "border-primary/40 bg-card text-foreground"
            : "border-border bg-card text-muted-foreground"
      }`}
    >
      <span className="block text-[10px] opacity-70">{t(labelKey)}</span>
      <span className="block font-medium leading-tight">{labelValue ?? "—"}</span>
    </button>
  );

  const optionCls = (active) =>
    `relative min-h-[44px] rounded-xl border text-sm font-medium transition-all flex items-center justify-center ${
      active
        ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/30"
        : "border-border bg-card hover:bg-secondary text-foreground"
    }`;

  return (
    <div className="space-y-4">
      {/* Breadcrumb chips: year / month / day — tap to revisit a level */}
      <div className="flex gap-2">
        {crumb("onboarding.birth.year", year, "year", !!year)}
        {crumb("onboarding.birth.month", month ? months[month - 1] : null, "month", !!month)}
        {crumb("onboarding.birth.day", day, "day", !!day)}
      </div>

      {view === "year" && (
        <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto pe-1" dir="ltr">
          {years.map((y) => (
            <button key={y} type="button" onClick={() => selectYear(y)} className={optionCls(y === year)}>
              {y}
            </button>
          ))}
        </div>
      )}

      {view === "month" && (
        <div className="grid grid-cols-3 gap-2">
          {months.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => selectMonth(i + 1)}
              className={optionCls(i + 1 === month)}
            >
              {i + 1 === month && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] leading-none flex items-center justify-center">
                  ✓
                </span>
              )}
              {name}
            </button>
          ))}
        </div>
      )}

      {view === "day" && (
        <div className="grid grid-cols-7 gap-1.5" dir="ltr">
          {Array.from({ length: dim }, (_, i) => i + 1).map((d) => (
            <button key={d} type="button" onClick={() => selectDay(d)} className={optionCls(d === day)}>
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Live derived age + group */}
      {complete && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
          ageError ? "border-destructive/40 bg-destructive/5" : "border-primary/20 bg-primary/5"
        }`}>
          <Cake className={`w-5 h-5 shrink-0 ${ageError ? "text-destructive" : "text-primary"}`} />
          <div className="flex-1 min-w-0">
            {ageError ? (
              <p className="text-sm font-medium text-destructive">{t(`onboarding.birth.${ageError}`)}</p>
            ) : (
              <p className="text-sm text-foreground">
                {t("onboarding.birth.age")}:{" "}
                <span className="font-bold text-primary" dir="ltr">{age}</span>{" "}
                {t("onboarding.birth.years")}
                <span className="mx-2 text-border">·</span>
                <span className="font-semibold">{t(`onboarding.birth.ageGroup.${ageGroupKey(age)}`)}</span>
              </p>
            )}
          </div>
          {!ageError && <Check className="w-5 h-5 text-primary shrink-0" />}
        </div>
      )}
    </div>
  );
}
