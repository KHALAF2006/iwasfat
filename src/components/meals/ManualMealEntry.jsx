import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Wand2 } from "lucide-react";
import { useT } from "@/i18n";
import { showApiError } from "@/lib/api-error";

const COOKING_METHODS = ["grilled", "boiled", "fried", "raw", "cooked"];

/**
 * ✍️ Manual path of the meal wizard: free-text description + quantity +
 * cooking method, with calorie estimation via the estimateMealCalories
 * backend function. Submits { meal_name, calories, protein, carbs, fat,
 * size_selected } to the parent.
 */
export default function ManualMealEntry({ isOpen, onClose, onSubmit }) {
  const t = useT();
  const [mealDesc, setMealDesc] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cookingMethod, setCookingMethod] = useState("");
  const [manualCalories, setManualCalories] = useState("");

  const estimateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke("estimateMealCalories", {
        meal_description: mealDesc,
        quantity,
        cooking_method: cookingMethod ? t(`mealFlow.cookingOpts.${cookingMethod}`) : "",
      });
      return response.data.estimation;
    },
    onSuccess: (data) => {
      if (data?.calories != null) setManualCalories(String(Math.round(data.calories)));
    },
    onError: (err) => showApiError(err),
  });

  const reset = () => {
    setMealDesc("");
    setQuantity("");
    setCookingMethod("");
    setManualCalories("");
    estimateMutation.reset();
  };

  const handleSubmit = () => {
    if (!mealDesc || !manualCalories) return;
    const est = estimateMutation.data || {};
    onSubmit({
      meal_name: mealDesc,
      calories: parseInt(manualCalories, 10) || 0,
      protein: est.protein ?? null,
      carbs: est.carbs ?? null,
      fat: est.fat ?? null,
      size_selected: quantity || t("mealFlow.oneServing"),
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("mealFlow.manualTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">{t("mealFlow.whatAte")}</label>
            <Textarea
              value={mealDesc}
              onChange={(e) => setMealDesc(e.target.value)}
              placeholder={t("mealFlow.whatAtePh")}
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">{t("mealFlow.quantity")}</label>
              <Input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={t("mealFlow.quantityPh")}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{t("mealFlow.cooking")}</label>
              <select
                value={cookingMethod}
                onChange={(e) => setCookingMethod(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
              >
                <option value="">{t("mealFlow.cookingOpts.choose")}</option>
                {COOKING_METHODS.map((m) => (
                  <option key={m} value={m}>{t(`mealFlow.cookingOpts.${m}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {estimateMutation.data && (
            <Card className="bg-accent/10">
              <CardContent className="pt-4">
                <h4 className="font-semibold text-sm mb-2 text-foreground">{t("mealFlow.smartEstimate")}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t("mealFlow.caloriesLabel")}</p>
                    <p className="text-lg font-bold text-foreground">{estimateMutation.data.calories}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("mealFlow.confidence")}</p>
                    <p className="text-sm text-foreground">
                      {estimateMutation.data.confidence === "high" && t("mealFlow.confHigh")}
                      {estimateMutation.data.confidence === "medium" && t("mealFlow.confMedium")}
                      {estimateMutation.data.confidence === "low" && t("mealFlow.confLow")}
                    </p>
                  </div>
                </div>
                {(estimateMutation.data.protein != null) && (
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                    <span>💪 {estimateMutation.data.protein}g</span>
                    <span>🌾 {estimateMutation.data.carbs}g</span>
                    <span>🥑 {estimateMutation.data.fat}g</span>
                  </div>
                )}
                {estimateMutation.data.notes && (
                  <p className="text-xs text-muted-foreground mt-2">{estimateMutation.data.notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          <div>
            <label className="text-sm font-medium text-foreground">{t("mealFlow.caloriesLabel")}</label>
            <div className="flex gap-2 mt-2">
              <Input
                type="number"
                value={manualCalories}
                onChange={(e) => setManualCalories(e.target.value)}
                placeholder={t("mealFlow.caloriesPh")}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={() => estimateMutation.mutate()}
                disabled={!mealDesc || estimateMutation.isPending}
                variant="outline"
                className="gap-2"
              >
                {estimateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                {t("mealFlow.estimate")}
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={() => { reset(); onClose(); }} variant="outline" className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!mealDesc || !manualCalories} className="flex-1">
              {t("mealFlow.addMeal")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
