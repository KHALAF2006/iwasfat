import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// SECURITY:
// - IDOR fix: callers may only generate lists for their OWN subscriber_id
//   (resolved via created_by == auth email); admins bypass.
// - LLM cost-abuse fix: per-user rate limit (20 calls/hour) tracked in the
//   RateLimit entity — see note in estimateMealCalories for the design.

const RATE_LIMIT_PER_HOUR = 20;

async function checkRateLimit(base44, action, email) {
  // Simple hourly-bucket rate limit. Trade-off: a burst at the exact window
  // boundary can slightly exceed the limit, and concurrent calls can race the
  // read-modify-write. Accepted as "good enough" abuse protection; documented
  // in base44/ENV.md.
  const now = new Date();
  const bucket = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const key = `${action}:${email}:${bucket}`;
  const rows = await base44.asServiceRole.entities.RateLimit.filter({ key });
  const row = rows[0];
  if (row && (row.count || 0) >= RATE_LIMIT_PER_HOUR) return false;
  if (row) {
    await base44.asServiceRole.entities.RateLimit.update(row.id, { count: (row.count || 0) + 1 });
  } else {
    await base44.asServiceRole.entities.RateLimit.create({ key, count: 1, window_start: now.toISOString() });
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { subscriber_id, week_start_date } = await req.json();
    if (!subscriber_id || !week_start_date) {
      return Response.json({ error: 'subscriber_id and week_start_date required' }, { status: 400 });
    }

    // Ownership check (admins bypass)
    if (user.role !== 'admin') {
      const own = await base44.asServiceRole.entities.Subscriber.filter({ created_by: user.email });
      const mySubscriber = own[0];
      if (!mySubscriber || mySubscriber.id !== subscriber_id) {
        return Response.json({ error: 'Forbidden: not your subscriber record' }, { status: 403 });
      }
    }

    // Rate limit (LLM cost protection)
    const allowed = await checkRateLimit(base44, 'generateShoppingList', user.email);
    if (!allowed) {
      return Response.json({ error: 'Rate limit exceeded: max 20 requests/hour' }, { status: 429 });
    }

    // جلب خطط الوجبات اليومية للأسبوع
    const weekEnd = new Date(week_start_date);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const dailyPlans = await base44.asServiceRole.entities.DailyMealPlan.filter({
      subscriber_id
    });

    const weekPlans = dailyPlans.filter(p => p.date >= week_start_date && p.date <= weekEndStr);

    // جمع أسماء كل الوجبات
    const mealNames = [];
    for (const plan of weekPlans) {
      if (plan.breakfast_meal_name) mealNames.push({ meal: plan.breakfast_meal_name, type: 'فطور' });
      if (plan.lunch_meal_name) mealNames.push({ meal: plan.lunch_meal_name, type: 'غداء' });
      if (plan.dinner_meal_name) mealNames.push({ meal: plan.dinner_meal_name, type: 'عشاء' });
      if (plan.morning_snack_name) mealNames.push({ meal: plan.morning_snack_name, type: 'سناك' });
      if (plan.afternoon_snack_name) mealNames.push({ meal: plan.afternoon_snack_name, type: 'سناك' });
      if (plan.morning_drink_name) mealNames.push({ meal: plan.morning_drink_name, type: 'مشروب' });
      if (plan.afternoon_drink_name) mealNames.push({ meal: plan.afternoon_drink_name, type: 'مشروب' });
    }

    const mealsSummary = mealNames.length > 0
      ? mealNames.map(m => `${m.type}: ${m.meal}`).join('\n')
      : 'لا توجد وجبات محددة للأسبوع';

    // استخدام AI لتوليد قائمة تسوق شاملة
    const prompt = `أنت خبير تغذية. بناءً على الوجبات التالية لأسبوع كامل (7 أيام) لشخص واحد يتبع نظام غذائي صحي:

${mealsSummary}

قم بإنشاء قائمة تسوق أسبوعية شاملة ومفصّلة تتضمن:
1. جميع المكونات الرئيسية لتحضير هذه الوجبات
2. التوابل والزيوت الأساسية
3. المشروبات الصحية (ماء، شاي أخضر، إلخ)
4. خضروات وفواكه طازجة متنوعة
5. مصادر بروتين كافية
6. حبوب ومنتجات ألبان

يجب أن تحتوي القائمة على 30-50 منتجاً على الأقل موزعة على الفئات.

المطلوب: JSON فقط بالصيغة التالية:
{
  "items": [
    {
      "category": "meat_protein",
      "item_name": "اسم المنتج بالعربي",
      "quantity": "الكمية مثل 500غ أو 2 كيلو أو 6 حبات"
    }
  ]
}

الفئات المتاحة فقط:
- meat_protein (لحوم، دجاج، سمك، بيض، بقوليات)
- vegetables_fruits (خضروات وفواكه طازجة)
- dairy (ألبان، أجبان، زبادي)
- grains_legumes (أرز، خبز، معكرونة، حبوب)
- oils_spices (زيوت، توابل، أعشاب)
- drinks (مشروبات صحية، عصائر، شاي)
- other (منتجات أخرى)

تأكد من أن الكميات واقعية لشخص واحد لمدة أسبوع كامل.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                item_name: { type: "string" },
                quantity: { type: "string" }
              },
              required: ["category", "item_name", "quantity"]
            }
          }
        }
      }
    });

    const VALID_CATEGORIES = ['meat_protein','vegetables_fruits','dairy','grains_legumes','oils_spices','drinks','other'];
    const items = (result.items || [])
      .filter(item => item && item.item_name && item.quantity)
      .map(item => ({
        category: VALID_CATEGORIES.includes(item.category) ? item.category : 'other',
        item_name: String(item.item_name).slice(0, 200),
        quantity: String(item.quantity).slice(0, 100),
        is_checked: false,
        notes: ''
      }));

    // حذف القائمة القديمة وإنشاء جديدة
    const existing = await base44.asServiceRole.entities.ShoppingList.filter({ subscriber_id, is_active: true });

    let listId;
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ShoppingList.update(existing[0].id, {
        items,
        week_start_date,
        generated_from_meals: true
      });
      listId = existing[0].id;
    } else {
      const newList = await base44.asServiceRole.entities.ShoppingList.create({
        subscriber_id,
        week_start_date,
        items,
        generated_from_meals: true,
        is_active: true
      });
      listId = newList.id;
    }

    return Response.json({ success: true, list_id: listId, items_count: items.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
