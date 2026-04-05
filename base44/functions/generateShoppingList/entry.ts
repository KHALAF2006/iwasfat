import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscriber_id, week_start_date } = await req.json();

    if (!subscriber_id || !week_start_date) {
      return Response.json({ error: 'Missing required fields: subscriber_id, week_start_date' }, { status: 400 });
    }

    // جلب خطط الوجبات للأسبوع
    const allPlans = await base44.entities.DailyMealPlan.filter({ subscriber_id });

    // جلب الوجبات لاستخراج المكونات
    const mealIds = new Set();
    for (const plan of allPlans) {
      if (plan.breakfast_meal_id) mealIds.add(plan.breakfast_meal_id);
      if (plan.lunch_meal_id) mealIds.add(plan.lunch_meal_id);
      if (plan.dinner_meal_id) mealIds.add(plan.dinner_meal_id);
    }

    const meals = [];
    for (const mealId of mealIds) {
      const meal = await base44.entities.Meal.filter({ id: mealId });
      if (meal.length > 0) meals.push(meal[0]);
    }

    // جمع أسماء الوجبات
    const mealNames = meals.map(m => m.name).join('، ');

    // استخدام AI لاستخراج مكونات التسوق
    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `أنت خبير تغذية. بناءً على هذه الوجبات الأسبوعية: ${mealNames}
      
      قم بإنشاء قائمة تسوق شاملة وعملية تحتوي على جميع المكونات اللازمة لتحضير هذه الوجبات لمدة أسبوع.
      
      صنّف كل منتج في إحدى هذه الفئات بالضبط: meat_protein, vegetables_fruits, dairy, grains_legumes, oils_spices, drinks, other
      
      أعطِ كميات واقعية لشخص واحد لأسبوع كامل.`,
      response_json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_name: { type: "string" },
                quantity: { type: "string" },
                category: { type: "string", enum: ["meat_protein", "vegetables_fruits", "dairy", "grains_legumes", "oils_spices", "drinks", "other"] }
              },
              required: ["item_name", "quantity", "category"]
            }
          }
        }
      }
    });

    const shoppingItems = (aiResponse?.items || []).map(item => ({
      ...item,
      is_checked: false,
      notes: ''
    }));

    // إنشاء أو تحديث قائمة التسوق
    const existingLists = await base44.entities.ShoppingList.filter({
      subscriber_id,
      week_start_date
    });

    let shoppingList;
    if (existingLists.length > 0) {
      shoppingList = existingLists[0];
      await base44.entities.ShoppingList.update(shoppingList.id, {
        items: shoppingItems,
        generated_from_meals: true,
        is_active: true
      });
    } else {
      shoppingList = await base44.entities.ShoppingList.create({
        subscriber_id,
        week_start_date,
        items: shoppingItems,
        generated_from_meals: true,
        is_active: true
      });
    }

    return Response.json({
      success: true,
      shopping_list_id: shoppingList.id,
      items_count: shoppingItems.length,
      meals_analyzed: meals.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});