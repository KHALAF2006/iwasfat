import { useMemo, useState } from "react";
import { Check, ChevronDown, Phone, Search } from "lucide-react";
import { useT, useLanguage } from "@/i18n";
import { COUNTRIES, composeE164, stripNational, validateNational } from "./countries";

/**
 * Step 1 — phone capture for Gulf & Arab countries.
 * Country picker (flag + localized name + dial code, searchable) followed by
 * a digits-only national input with per-country validation and an E.164 preview.
 */
export default function PhoneStep({ country, onCountryChange, national, onNationalChange }) {
  const t = useT();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) =>
      c.ar.includes(query.trim()) ||
      c.en.toLowerCase().includes(q) ||
      c.code.includes(q.replace(/^\+/, ""))
    );
  }, [query]);

  const validation = validateNational(country, national);
  const showError = national.length > 0 && !validation.ok;
  const countryName = (c) => (language === "ar" ? c.ar : c.en);

  const hintKey = country.start ? "onboarding.phone.hint" : "onboarding.phone.hintPlain";
  const hintDigits = country.len[0] === country.len[1] ? country.len[0] : `${country.len[0]}–${country.len[1]}`;

  const errorText =
    validation.reason === "length"
      ? t("onboarding.phone.errLength", { digits: hintDigits })
      : validation.reason === "start"
        ? t("onboarding.phone.errStart", { start: country.start })
        : "";

  return (
    <div className="space-y-5">
      {/* Country selector */}
      <div>
        <label className="text-sm font-medium text-foreground">{t("onboarding.phone.country")}</label>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`mt-1.5 w-full flex items-center gap-3 rounded-xl border bg-card px-4 min-h-[52px] text-start transition-colors ${
            open ? "border-primary ring-2 ring-primary/30" : "border-border hover:bg-secondary"
          }`}
        >
          <span className="text-2xl">{country.flag}</span>
          <span className="flex-1 font-medium text-foreground">{countryName(country)}</span>
          <span className="text-sm text-muted-foreground" dir="ltr">+{country.code}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="mt-2 rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("onboarding.phone.search")}
                className="w-full py-2.5 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("onboarding.phone.noResults")}
                </p>
              )}
              {filtered.map((c) => {
                const active = c.iso === country.iso;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    onClick={() => {
                      onCountryChange(c);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`w-full flex items-center gap-3 px-4 min-h-[48px] text-start transition-colors ${
                      active ? "bg-primary/10" : "hover:bg-secondary"
                    }`}
                  >
                    <span className="text-xl">{c.flag}</span>
                    <span className={`flex-1 text-sm ${active ? "font-semibold text-primary" : "text-foreground"}`}>
                      {countryName(c)}
                    </span>
                    <span className="text-xs text-muted-foreground" dir="ltr">+{c.code}</span>
                    {active && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* National number input */}
      <div>
        <label className="text-sm font-medium text-foreground">{t("onboarding.phone.number")}</label>
        <div
          className={`mt-1.5 flex items-center rounded-xl border bg-card overflow-hidden transition-colors ${
            showError ? "border-destructive ring-2 ring-destructive/20" : "border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30"
          }`}
          dir="ltr"
        >
          <span className="px-3 py-3 text-sm font-semibold text-muted-foreground bg-secondary/70 border-r border-border whitespace-nowrap">
            {country.flag} +{country.code}
          </span>
          <input
            type="tel"
            inputMode="numeric"
            dir="ltr"
            value={national}
            onChange={(e) => onNationalChange(stripNational(e.target.value))}
            placeholder={t("onboarding.phone.placeholder")}
            className="flex-1 min-w-0 px-3 py-3 bg-transparent text-base font-medium tracking-wide outline-none placeholder:text-muted-foreground/60"
          />
          {validation.ok && <Check className="w-5 h-5 text-primary mx-3 shrink-0" />}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t(hintKey, { digits: hintDigits, start: country.start })}
        </p>
        {showError && (
          <p className="mt-1 text-xs font-medium text-destructive">{errorText}</p>
        )}
      </div>

      {/* E.164 preview */}
      {validation.ok && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
          <Phone className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">{t("onboarding.phone.preview")}</p>
            <p className="text-sm font-bold text-primary" dir="ltr">{composeE164(country, national)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
