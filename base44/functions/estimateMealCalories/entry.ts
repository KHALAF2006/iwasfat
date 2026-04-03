import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meal_description, quantity, cooking_method } = await req.json();

    if (!meal_description) {
      return Response.json({ 
        error: 'Missing meal_description' 
      }, { status: 400 });
    }

    // استخدام الذكاء الاصطناعي لحساب السعرات الحرارية
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `أنت خبير تغذية. قدّر السعرات الحرارية للوجبة التالية بناءً على الوصف والكمية وطريقة الطهي.

الوجبة: ${meal_description}
الكمية: ${quantity || 'حصة واحدة عادية'}
طريقة الطهي: ${cooking_method || 'غير محددة'}

أعطني:
1. تقدير السعرات الحرارية (رقم واحد فقط)
2. البروتين بالغرام (تقريبي)
3. الكربوهيدرات بالغرام (تقريبي)
4. الدهون بالغرام (تقريبي)
5. درجة الثقة (عالية/متوسطة/منخفضة)

إجابة JSON:
{
  "calories": NUMBER,
  "protein": NUMBER,
  "carbs": NUMBER,
  "fat": NUMBER,
  "confidence": "high|medium|low",
  "notes": "أي ملاحظات إضافية"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          confidence: { type: 'string' },
          notes: { type: 'string' }
        }
      }
    });

    return Response.json({ 
      success: true,
      estimation: response
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});