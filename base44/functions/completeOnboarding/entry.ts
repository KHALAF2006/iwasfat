import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// completeOnboarding — creates or updates the caller's Subscriber profile and,
// for NEW subscribers, starts the 7-day trial and auto-assigns a Group.
//
// AUTH: authenticated user only (base44.auth.me()); 401 otherwise.
//
// ERROR CONTRACT: validation failures return HTTP 200 with
//   { ok: false, code: 'INVALID_PHONE' | 'INVALID_DATA', error: '<bilingual message>' }
// The frontend maps `code` to a localized message; HTTP 200 keeps the response
// body accessible to clients that treat non-2xx as opaque transport errors.
// Only auth (401) and unexpected server errors (500) use non-200 statuses.
//
// PRIVILEGE SAFETY: all writes go through asServiceRole. On UPDATE of an
// existing subscriber only profile fields are touched — subscription_status,
// trial_*, grace_ends_at, subscription_plan/start/end are never writable here
// (they are also field-level admin-only in Subscriber.jsonc).

// Gulf / Arab country calling codes. Sorted longest-first so prefix matching
// is unambiguous (e.g. 218 before any shorter overlapping code).
const ARAB_PHONE_CODES = [
  '966', '971', '965', '974', '973', '968', '963', '964', '967', '970',
  '962', '961', '218', '216', '213', '212', '249', '252', '253', '269',
  '222', '20',
].sort((a, b) => b.length - a.length);

const E164_RE = /^\+[1-9]\d{7,14}$/;
const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active'];
const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

function fail(code, ar, en) {
  return Response.json({ ok: false, code, error: `${ar} / ${en}` }, { status: 200 });
}

function isValidPhone(phone) {
  if (!E164_RE.test(phone)) return false;
  const digits = phone.slice(1);
  return ARAB_PHONE_CODES.some((code) => digits.startsWith(code));
}

function computeAge(birthDate, now) {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

function ageGroupFor(age) {
  if (age < 30) return '18-29'; // ages 10-17 (allowed by validation) clamp into the youngest band
  if (age < 45) return '30-44';
  if (age < 60) return '45-59';
  return '60+';
}

function dateOnly(d) {
  return d.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return fail('INVALID_DATA', 'بيانات غير صالحة', 'Invalid request data');
    }

    const {
      full_name, gender, birth_date, height_cm, current_weight, target_weight,
      activity_level, has_chronic_diseases, chronic_diseases_details, phone,
    } = body || {};

    // ---- Validation ----
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return fail('INVALID_DATA', 'الاسم الكامل مطلوب', 'Full name is required');
    }
    if (gender !== 'male' && gender !== 'female') {
      return fail('INVALID_DATA', 'الجنس مطلوب', 'Gender is required');
    }
    const birth = new Date(birth_date);
    if (!birth_date || isNaN(birth.getTime())) {
      return fail('INVALID_DATA', 'تاريخ الميلاد غير صالح', 'Invalid birth date');
    }
    const now = new Date();
    const age = computeAge(birth, now);
    if (age < 10 || age > 100) {
      return fail('INVALID_DATA', 'العمر يجب أن يكون بين 10 و 100 سنة', 'Age must be between 10 and 100');
    }
    if (typeof height_cm !== 'number' || height_cm < 100 || height_cm > 230) {
      return fail('INVALID_DATA', 'الطول يجب أن يكون بين 100 و 230 سم', 'Height must be 100-230 cm');
    }
    if (typeof current_weight !== 'number' || current_weight < 30 || current_weight > 300) {
      return fail('INVALID_DATA', 'الوزن الحالي يجب أن يكون بين 30 و 300 كغ', 'Current weight must be 30-300 kg');
    }
    if (typeof target_weight !== 'number' || target_weight < 30 || target_weight > 300) {
      return fail('INVALID_DATA', 'الوزن المستهدف يجب أن يكون بين 30 و 300 كغ', 'Target weight must be 30-300 kg');
    }
    if (activity_level !== undefined && activity_level !== null && !ACTIVITY_LEVELS.includes(activity_level)) {
      return fail('INVALID_DATA', 'مستوى النشاط غير صالح', 'Invalid activity level');
    }
    if (phone !== undefined && phone !== null && phone !== '' && !isValidPhone(phone)) {
      return fail(
        'INVALID_PHONE',
        'رقم الجوال يجب أن يكون بصيغة دولية (+...) وبمفتاح دولة عربية/خليجية',
        'Phone must be E.164 with a Gulf/Arab country code'
      );
    }

    const age_group = ageGroupFor(age);

    const profileFields = {
      full_name: full_name.trim(),
      gender,
      birth_date: dateOnly(birth),
      height_cm,
      current_weight,
      target_weight,
      activity_level: activity_level ?? null,
      has_chronic_diseases: !!has_chronic_diseases,
      chronic_diseases_details: chronic_diseases_details ?? null,
      phone: phone || null,
      age_group,
    };

    const db = base44.asServiceRole.entities;
    const own = await db.Subscriber.filter({ email: user.email });

    // Dedupe: historical double-onboarding created multiple rows per email
    // (the old lookup matched created_by, which is the service identity for
    // function-created rows, so it never found them). Keep the strongest row —
    // active beats trial beats expired/cancelled, then the latest end date —
    // and remove the rest so one email = one subscriber, always.
    const rank = (s) => {
      const statusRank = { active: 3, trial: 2, expired: 1, cancelled: 0 }[s.subscription_status] ?? 0;
      const end = Date.parse(s.subscription_end_date || s.trial_ends_at || '') || 0;
      return statusRank * 1e13 + end;
    };
    const sorted = [...own].sort((a, b) => rank(b) - rank(a));
    const existing = sorted[0];
    for (const dup of sorted.slice(1)) {
      await db.Subscriber.delete(dup.id).catch(() => null);
    }

    // ---- Existing subscriber: profile update ONLY, never touch billing/trial ----
    if (existing) {
      await db.Subscriber.update(existing.id, { ...profileFields, user_id: user.id });
      const updated = { ...existing, ...profileFields };
      let group_name = null;
      if (existing.group_id) {
        const group = await db.Group.get(existing.group_id).catch(() => null);
        group_name = group?.name ?? null;
      }
      return Response.json({
        ok: true,
        subscriber: updated,
        group_name,
        trial_ends_at: existing.trial_ends_at ?? null,
        subscription_status: existing.subscription_status,
      });
    }

    // ---- New subscriber: start trial + auto-assign group ----
    const trialEnds = new Date(now.getTime() + TRIAL_MS);

    const groups = await db.Group.filter({ is_active: true });
    const candidates = groups.filter(
      (g) =>
        g.gender === gender &&
        (g.age_min ?? 0) <= age &&
        age <= (g.age_max ?? 150) &&
        (g.member_count || 0) < (g.max_members || 15)
    );
    // Prefer groups whose weight band fits, then the narrowest age band.
    candidates.sort((a, b) => {
      const fitsA = (a.weight_min ?? 0) <= current_weight && current_weight <= (a.weight_max ?? 1000) ? 0 : 1;
      const fitsB = (b.weight_min ?? 0) <= current_weight && current_weight <= (b.weight_max ?? 1000) ? 0 : 1;
      if (fitsA !== fitsB) return fitsA - fitsB;
      return ((a.age_max ?? 150) - (a.age_min ?? 0)) - ((b.age_max ?? 150) - (b.age_min ?? 0));
    });
    const assigned = candidates[0] ?? null;

    const created = await db.Subscriber.create({
      email: user.email,
      user_id: user.id,
      ...profileFields,
      subscription_status: 'trial',
      trial_used: true,
      trial_ends_at: dateOnly(trialEnds),
      subscription_end_date: dateOnly(trialEnds),
      subscription_start_date: dateOnly(now),
      group_id: assigned?.id ?? null,
    });

    if (assigned) {
      await db.Group.update(assigned.id, { member_count: (assigned.member_count || 0) + 1 });
    }

    return Response.json({
      ok: true,
      subscriber: created,
      group_name: assigned?.name ?? null,
      trial_ends_at: created.trial_ends_at,
    });
  } catch (error) {
    console.error('completeOnboarding failed:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
