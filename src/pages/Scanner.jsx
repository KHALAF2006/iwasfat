import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2, Check, Pencil } from "lucide-react";
import moment from "moment";
import { useT, useLanguage } from "@/i18n";
import { evaluateFoodForProfile } from "@/lib/nutrition/engine";
import MealWarnings from "@/components/meals/MealWarnings";
import {
  buildEngineProfile,
  matchFoodIndexItem,
  useFoodIndexItems,
} from "@/components/meals/conditions";

const MEAL_TYPE_KEYS = ["breakfast", "lunch", "dinner", "snack"];

/**
 * AI food scanner. Analysis runs in the backend function
 * base44/functions/analyzeFoodImage (never client-side InvokeLLM). Detected
 * items are matched against the food index and evaluated against the
 * subscriber's chronic conditions before anything is logged.
 */
export default function Scanner() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [mealType, setMealType] = useState("lunch");
  const [saved, setSaved] = useState(false);
  const t = useT();
  const { language } = useLanguage();
  const indexItems = useFoodIndexItems();

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
  });

  const profile = useMemo(() => buildEngineProfile(subscriber), [subscriber]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
      setSaved(false);
      setError(null);
    }
  };

  const analyzeImage = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // Backend contract: { items: [{name, portion_grams, calories, protein,
      // carbs, fat}], total_calories, analysis }
      const res = await base44.functions.invoke("analyzeFoodImage", { file_url });
      const analysis = res.data;
      if (analysis?.error) throw new Error(analysis.error);
      const items = (analysis.items || []).map((it) => ({
        ...it,
        portion_grams: it.portion_grams || 0,
        calories: it.calories || 0,
        protein: it.protein || 0,
        carbs: it.carbs || 0,
        fat: it.fat || 0,
      }));
      const totals = items.reduce(
        (acc, it) => ({
          calories: acc.calories + it.calories,
          protein: acc.protein + it.protein,
          carbs: acc.carbs + it.carbs,
          fat: acc.fat + it.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      setResult({
        items,
        total_calories: analysis.total_calories ?? Math.round(totals.calories),
        total_protein: Math.round(totals.protein),
        total_carbs: Math.round(totals.carbs),
        total_fat: Math.round(totals.fat),
        analysis: analysis.analysis || "",
        file_url,
      });
    } catch (err) {
      setError(err.message || "analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // Evaluate detected items against the subscriber's conditions. Items are
  // fuzzy-matched to the food index to inherit its tag vocabulary.
  const evaluation = useMemo(() => {
    if (!result || !profile) return { allowed: true, warnings: [] };
    const warnings = [];
    let allowed = true;
    for (const item of result.items) {
      const matched = matchFoodIndexItem(item.name, null, indexItems);
      if (!matched) continue;
      const r = evaluateFoodForProfile(
        {
          name_ar: matched.name_ar,
          name_en: matched.name_en,
          sugar_g: matched.sugar_g || 0,
          sodium_mg: matched.sodium_mg || 0,
          tags: matched.tags || [],
        },
        profile
      );
      warnings.push(...r.warnings);
      if (!r.allowed) allowed = false;
    }
    // De-duplicate identical messages.
    const seen = new Set();
    const unique = warnings.filter((w) => {
      const k = `${w.condition}:${w.severity}:${w.message_ar}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { allowed, warnings: unique };
  }, [result, profile, indexItems]);

  const saveToLog = async () => {
    if (!result || !subscriber) return;

    await base44.entities.FoodLog.create({
      subscriber_id: subscriber.id,
      date: moment().format("YYYY-MM-DD"),
      meal_type: mealType,
      followed_plan: false,
      actual_food:
        result.items?.map((i) => `${i.name} (${i.portion_grams}غ)`).join("، ") ||
        result.analysis,
      food_image: result.file_url,
      calories: result.total_calories || 0,
      protein: result.total_protein || 0,
      carbs: result.total_carbs || 0,
      fat: result.total_fat || 0,
      ai_analysis: JSON.stringify(result),
    });

    queryClient.invalidateQueries({ queryKey: ["foodLogs"] });
    setSaved(true);
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">{t("scanner.title")}</h1>
      <p className="text-muted-foreground text-sm mb-6">{t("scanner.subtitle")}</p>

      {/* Upload Area */}
      {!preview ? (
        <label className="block cursor-pointer">
          <div className="bg-card border-2 border-dashed border-border rounded-2xl p-12 text-center hover:border-primary/40 transition-colors">
            <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-1">{t("scanner.upload")}</p>
            <p className="text-sm text-muted-foreground">{t("scanner.formats")}</p>
          </div>
          <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden">
            <img src={preview} alt={t("scanner.imageAlt")} className="w-full aspect-square object-cover" />
            <label className="absolute bottom-3 left-3 cursor-pointer">
              <Button size="sm" variant="secondary" className="gap-1">
                <Pencil className="w-3 h-3" /> {t("scanner.changeImage")}
              </Button>
              <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          {!result && (
            <div className="space-y-3">
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEAL_TYPE_KEYS.map(key => (
                    <SelectItem key={key} value={key}>{t(`scanner.types.${key}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={analyzeImage} disabled={analyzing} className="w-full bg-primary text-primary-foreground py-5 gap-2">
                {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("scanner.analyzing")}</> : <><Camera className="w-4 h-4" /> {t("scanner.analyze")}</>}
              </Button>
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {t("mealFlow.analysisFailed")}
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
              <h3 className="font-semibold text-foreground">{t("scanner.resultTitle")}</h3>

              <div className="space-y-2">
                {result.items?.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-foreground">
                      {item.name} <span className="text-muted-foreground">({item.portion_grams}{t("mealFlow.gram")})</span>
                    </span>
                    <span className="text-muted-foreground">~{item.calories} {t("common.cal")}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex justify-between font-semibold text-foreground">
                  <span>{t("scanner.total")}</span>
                  <span>~{result.total_calories} {t("common.cal")}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                  <div className="bg-secondary rounded-lg p-2 text-center">
                    <p className="font-medium text-foreground">{result.total_protein}g</p>
                    <p>{t("scanner.protein")}</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-2 text-center">
                    <p className="font-medium text-foreground">{result.total_carbs}g</p>
                    <p>{t("scanner.carbs")}</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-2 text-center">
                    <p className="font-medium text-foreground">{result.total_fat}g</p>
                    <p>{t("scanner.fat")}</p>
                  </div>
                </div>
              </div>

              {result.analysis && (
                <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3 leading-relaxed">
                  {result.analysis}
                </p>
              )}

              {/* Chronic-condition check before logging */}
              {subscriber && evaluation.warnings.length > 0 && (
                <MealWarnings warnings={evaluation.warnings} showDoctorNotes={false} />
              )}
              {subscriber && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  ⚕️ {t("mealFlow.disclaimer")}
                </p>
              )}

              {saved ? (
                <div className="flex items-center gap-2 text-primary bg-primary/5 rounded-lg p-3">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">{t("scanner.savedMsg")}</span>
                </div>
              ) : (
                <Button onClick={saveToLog} className="w-full bg-accent hover:bg-accent/90 text-white py-5">
                  {evaluation.allowed
                    ? t("scanner.addToLog")
                    : t("mealFlow.addToLogAnyway")}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
