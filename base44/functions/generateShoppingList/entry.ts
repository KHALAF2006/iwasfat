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
      return Response.json({ 
        error: 'Missing required fields: subscriber_id, week_start_date' 
      }, { status: 400 });
    }

    // الحصول على الوجبات المخطط لها للأسبوع
    const dailyPlans = await base44.entities.DailyMealPlan.filter({
      subscriber_id: subscriber_id
    });

    // جمع جميع المكونات من الوجبات
    const ingredientsMap = {};
    
    // هنا يتم معالجة الوجبات واستخراج المكونات
    // سيتم تطويره بناءً على نوع الوجبات المختارة

    const shoppingListItems = Object.entries(ingredientsMap).map(([name, qty]) => ({
      category: 'other',
      item_name: name,
      quantity: qty,
      is_checked: false,
      notes: ''
    }));

    // إنشاء أو تحديث قائمة التسوق
    const existingLists = await base44.entities.ShoppingList.filter({
      subscriber_id: subscriber_id,
      week_start_date: week_start_date
    });

    let shoppingList;
    if (existingLists.length > 0) {
      shoppingList = existingLists[0];
      await base44.entities.ShoppingList.update(shoppingList.id, {
        items: shoppingListItems,
        generated_from_meals: true
      });
    } else {
      shoppingList = await base44.entities.ShoppingList.create({
        subscriber_id: subscriber_id,
        week_start_date: week_start_date,
        items: shoppingListItems,
        generated_from_meals: true,
        is_active: true
      });
    }

    return Response.json({ 
      success: true, 
      shopping_list_id: shoppingList.id,
      items_count: shoppingListItems.length
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});