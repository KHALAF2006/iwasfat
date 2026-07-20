import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * importFoodDatabase — admin-only bulk importer for the generated food database.
 *
 * Invoked from the admin UI (food database management screen). The admin
 * client reads src/data/food_db.json, slices the ~5000 items into batches of
 * ~200, and POSTs each batch here as { items: [...] } sequentially.
 *
 * Upsert key: external_id (the stable slug from the generator). Existing
 * records are updated; new ones are created. Invalid items are skipped and
 * counted, never partially written.
 *
 * Expected item shape (all macros per serving, non-negative numbers):
 *   { id, name_ar, name_en, category, subcategory, region[], serving_desc_ar,
 *     serving_desc_en, portion_grams, calories, protein_g, carbs_g, fat_g,
 *     fiber_g, sugar_g, sodium_mg, tags[], source_quality }
 */

// Map generator categories onto the (extended) FoodItem category enum.
const ALLOWED_CATEGORIES = new Set([
  'grain', 'protein', 'dairy', 'fruit', 'vegetable', 'fat', 'beverage', 'snack', 'other',
  'bread_grain', 'rice_main', 'meat', 'poultry', 'fish_seafood', 'legume',
  'salad', 'soup', 'egg_breakfast', 'nuts_seeds', 'oil_fat', 'sweets',
  'fast_food', 'condiment', 'packaged_snack'
]);

function isValidNumber(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function validateItem(item) {
  if (!item || typeof item !== 'object') return 'not an object';
  if (!item.id || typeof item.id !== 'string') return 'missing id';
  if (!item.name_ar || !item.name_en) return 'missing names';
  if (!ALLOWED_CATEGORIES.has(item.category)) return `bad category: ${item.category}`;
  for (const f of ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'portion_grams']) {
    if (!isValidNumber(item[f])) return `invalid macro field: ${f}`;
  }
  if (item.calories <= 0 && (item.protein_g + item.carbs_g + item.fat_g) > 0) return 'zero calories with non-zero macros';
  if (item.region && !Array.isArray(item.region)) return 'region must be an array';
  if (item.tags && !Array.isArray(item.tags)) return 'tags must be an array';
  return null;
}

// Translate the generator record into FoodItem entity fields. Legacy fields
// (portion, protein, carbs, fat) are mirrored so old UI keeps working.
function toEntity(item) {
  return {
    name_ar: item.name_ar,
    name_en: item.name_en,
    portion: item.serving_desc_ar || '',
    portion_grams: item.portion_grams,
    calories: item.calories,
    protein: item.protein_g,
    carbs: item.carbs_g,
    fat: item.fat_g,
    category: item.category,
    subcategory: item.subcategory || '',
    region: item.region || [],
    serving_desc_ar: item.serving_desc_ar || '',
    serving_desc_en: item.serving_desc_en || '',
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    fiber_g: item.fiber_g,
    sugar_g: item.sugar_g,
    sodium_mg: item.sodium_mg,
    tags: item.tags || [],
    source_quality: item.source_quality === 'reference' ? 'reference' : 'estimated',
    external_id: item.id,
    is_active: true
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Admin-only: the admin UI calls this; regular users get 403.
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }

    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'items[] is required (batch of ~200)' }, { status: 400 });
    }
    if (items.length > 500) {
      return Response.json({ error: 'batch too large (max 500 items per call)' }, { status: 400 });
    }

    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const item of items) {
      const invalid = validateItem(item);
      if (invalid) {
        skipped++;
        errors.push({ id: item?.id || null, reason: invalid });
        continue;
      }

      const entity = toEntity(item);
      // Upsert by external_id: filter first, update if exists, else create.
      const existing = await base44.entities.FoodItem.filter({ external_id: item.id });
      if (existing && existing.length > 0) {
        await base44.entities.FoodItem.update(existing[0].id, entity);
        updated++;
      } else {
        await base44.entities.FoodItem.create(entity);
        created++;
      }
    }

    return Response.json({ created, updated, skipped, errors: errors.slice(0, 20) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
