import { useLanguage } from "@/i18n";
import { Globe } from "lucide-react";

/**
 * 🌐 Language switcher — toggles between العربية and English.
 * variant: "ghost" (for landing navbar) | "outline" (for settings)
 */
export default function LanguageSwitcher({ className = "" }) {
  const { language, setLanguage, t } = useLanguage();
  const next = language === "ar" ? "en" : "ar";

  return (
    <button
      onClick={() => setLanguage(next)}
      className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-accent ${className}`}
      aria-label={t("language.label")}
      title={t("language.label")}
    >
      <Globe className="w-4 h-4" />
      <span>{next === "ar" ? t("language.ar") : t("language.en")}</span>
    </button>
  );
}
