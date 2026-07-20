import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// SECURITY:
// - file_url validation: previously ANY external URL was accepted and forwarded
//   to the LLM (SSRF-ish abuse + cost). Now the URL must be https and its host
//   must match the app's own upload storage. Base44 UploadFile URLs are served
//   from the platform storage (*.base44.app / *.supabase.co); the allowlist is
//   overridable via the ALLOWED_FILE_HOSTS env var (comma-separated suffixes).
//   UNTESTED: verify the actual upload host after a real UploadFile call in
//   production and set ALLOWED_FILE_HOSTS accordingly.
// - LLM output validation: totals and per-item macros are clamp-checked
//   (0-5000 kcal, 0-500 g); implausible responses are rejected with 422.
// - Rate limiting: max 20 calls/hour per user via the RateLimit entity
//   (same design as estimateMealCalories; see notes there and in ENV.md).

const RATE_LIMIT_PER_HOUR = 20;
const MAX_CALORIES = 5000;
const MAX_MACRO_G = 500;
const MAX_PORTION_G = 5000;

const DEFAULT_ALLOWED_HOSTS = ['.base44.app', '.supabase.co'];

function isAllowedFileUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const envHosts = Deno.env.get('ALLOWED_FILE_HOSTS');
  const allowed = envHosts
    ? envHosts.split(',').map(h => h.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_HOSTS;
  const host = url.hostname.toLowerCase();
  return allowed.some(suffix => host.endsWith(suffix.toLowerCase()));
}

async function checkRateLimit(base44, action, email) {
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

function validNumber(n, max) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
}

function sanitizeText(value, maxLen) {
  if (!value) return '';
  return String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, maxLen)
    .trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = await checkRateLimit(base44, 'analyzeFoodImage', user.email);
    if (!allowed) {
      return Response.json({ error: 'Rate limit exceeded: max 20 requests/hour' }, { status: 429 });
    }

    const { file_url } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'Missing file_url' }, { status: 400 });
    }

    if (!isAllowedFileUrl(file_url)) {
      return Response.json({ error: 'file_url must be an https URL from the app upload storage' }, { status: 400 });
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

    // Validate LLM-returned numbers before trusting them
    if (!validNumber(result.total_calories, MAX_CALORIES)) {
      return Response.json({
        error: 'LLM returned implausible total_calories; please try again',
        received: { total_calories: result.total_calories }
      }, { status: 422 });
    }

    const items = (result.items || [])
      .filter(it => it && it.name)
      .map(it => ({
        name: sanitizeText(it.name, 200),
        portion_grams: validNumber(it.portion_grams, MAX_PORTION_G) ? it.portion_grams : 0,
        calories: validNumber(it.calories, MAX_CALORIES) ? Math.round(it.calories) : 0,
        protein: validNumber(it.protein, MAX_MACRO_G) ? Math.round(it.protein * 10) / 10 : 0,
        carbs: validNumber(it.carbs, MAX_MACRO_G) ? Math.round(it.carbs * 10) / 10 : 0,
        fat: validNumber(it.fat, MAX_MACRO_G) ? Math.round(it.fat * 10) / 10 : 0,
      }));

    return Response.json({
      items,
      total_calories: Math.round(result.total_calories),
      analysis: sanitizeText(result.analysis, 1000)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
