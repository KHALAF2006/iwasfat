import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, Loader2, Check, Pencil } from "lucide-react";
import moment from "moment";

export default function Scanner() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [mealType, setMealType] = useState("lunch");
  const [saved, setSaved] = useState(false);

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
  });

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
      setSaved(false);
    }
  };

  const analyzeImage = async () => {
    if (!file) return;
    setAnalyzing(true);
    
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: `حلل هذه الصورة لوجبة طعام وأعطني تقديراً للمحتوى الغذائي.
      
      أرجع النتيجة بالعربي بالشكل التالي:
      - اسم كل طعام مع الكمية التقريبية
      - السعرات الحرارية لكل عنصر
      - المجموع الكلي للسعرات
      - البروتين والكربوهيدرات والدهون الإجمالية`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                portion: { type: "string" },
                calories: { type: "number" },
              },
            },
          },
          total_calories: { type: "number" },
          total_protein: { type: "number" },
          total_carbs: { type: "number" },
          total_fat: { type: "number" },
          summary: { type: "string" },
        },
      },
    });

    setResult({ ...analysis, file_url });
    setAnalyzing(false);
  };

  const saveToLog = async () => {
    if (!result || !subscriber) return;
    
    await base44.entities.FoodLog.create({
      subscriber_id: subscriber.id,
      date: moment().format("YYYY-MM-DD"),
      meal_type: mealType,
      actual_food: result.items?.map(i => `${i.name} (${i.portion})`).join("، ") || result.summary,
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
      <h1 className="text-2xl font-bold text-foreground mb-2">تحليل الوجبة بالذكاء الاصطناعي</h1>
      <p className="text-muted-foreground text-sm mb-6">صوّر وجبتك واحصل على تحليل السعرات فوراً</p>

      {/* Upload Area */}
      {!preview ? (
        <label className="block cursor-pointer">
          <div className="bg-card border-2 border-dashed border-border rounded-2xl p-12 text-center hover:border-primary/40 transition-colors">
            <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-1">التقط صورة أو ارفع من المعرض</p>
            <p className="text-sm text-muted-foreground">JPG, PNG — حتى 10MB</p>
          </div>
          <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden">
            <img src={preview} alt="وجبتك" className="w-full aspect-square object-cover" />
            <label className="absolute bottom-3 left-3 cursor-pointer">
              <Button size="sm" variant="secondary" className="gap-1">
                <Pencil className="w-3 h-3" /> تغيير الصورة
              </Button>
              <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          {!result && (
            <div className="space-y-3">
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">فطور</SelectItem>
                  <SelectItem value="lunch">غداء</SelectItem>
                  <SelectItem value="dinner">عشاء</SelectItem>
                  <SelectItem value="snack">سناك</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={analyzeImage} disabled={analyzing} className="w-full bg-primary text-primary-foreground py-5 gap-2">
                {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التحليل...</> : <><Camera className="w-4 h-4" /> حلّل الوجبة</>}
              </Button>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
              <h3 className="font-semibold text-foreground">📸 تحليل وجبتك</h3>
              
              <div className="space-y-2">
                {result.items?.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-foreground">{item.name} <span className="text-muted-foreground">({item.portion})</span></span>
                    <span className="text-muted-foreground">~{item.calories} سعرة</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex justify-between font-semibold text-foreground">
                  <span>المجموع</span>
                  <span>~{result.total_calories} سعرة</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                  <div className="bg-secondary rounded-lg p-2 text-center">
                    <p className="font-medium text-foreground">{result.total_protein}غ</p>
                    <p>بروتين</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-2 text-center">
                    <p className="font-medium text-foreground">{result.total_carbs}غ</p>
                    <p>كربوهيدرات</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-2 text-center">
                    <p className="font-medium text-foreground">{result.total_fat}غ</p>
                    <p>دهون</p>
                  </div>
                </div>
              </div>

              {saved ? (
                <div className="flex items-center gap-2 text-primary bg-primary/5 rounded-lg p-3">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">تم الإضافة للسجل بنجاح!</span>
                </div>
              ) : (
                <Button onClick={saveToLog} className="w-full bg-accent hover:bg-accent/90 text-white py-5">
                  إضافة للسجل
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}