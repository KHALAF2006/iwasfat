import { AlertTriangle } from "lucide-react";

const WARNINGS = {
  warning_diabetes: { label: "غير مناسب لمرضى السكري", color: "border-yellow-300 bg-yellow-50 text-yellow-800" },
  warning_blood_pressure: { label: "غير مناسب لمرضى الضغط", color: "border-red-300 bg-red-50 text-red-800" },
  warning_cholesterol: { label: "غير مناسب لمرضى الكوليسترول", color: "border-orange-300 bg-orange-50 text-orange-800" },
  warning_kidney_disease: { label: "غير مناسب لمرضى الكلى", color: "border-purple-300 bg-purple-50 text-purple-800" },
};

// subscriberDiseases: { has_chronic_diseases, chronic_diseases_details }
// We check against meal warnings
export default function MealWarnings({ meal, subscriberHasDiseases }) {
  if (!meal) return null;

  const activeWarnings = Object.entries(WARNINGS).filter(([field]) => meal[field]);
  if (activeWarnings.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {activeWarnings.map(([field, { label, color }]) => (
        <div key={field} className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm ${color}`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}