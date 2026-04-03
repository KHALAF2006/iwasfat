import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();
    
    if (!file_url) {
      return Response.json({ error: 'Missing file_url' }, { status: 400 });
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `
تحليل الصورة الغذائية:
1. تحديد جميع الأطعمة والمشروبات
2. تقدير الكميات والأوزان بالغرام
3. حساب السعرات الحرارية والبروتين والكربوهيدرات والدهون
4. تقييم مدى تطابق مع خطة صحية

أرجع JSON بالصيغة:
{
  "items": [{"name": "الاسم العربي", "portion_grams": 100, "calories": 150, "protein": 10, "carbs": 15, "fat": 5}],
  "total_calories": 150,
  "analysis": "تقييم صحي موجز"
}
      `,
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
                portion_grams: { type: "number" },
                calories: { type: "number" },
                protein: { type: "number" },
                carbs: { type: "number" },
                fat: { type: "number" }
              }
            }
          },
          total_calories: { type: "number" },
          analysis: { type: "string" }
        }
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});