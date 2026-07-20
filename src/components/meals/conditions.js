/**
 * conditions.js — bridges the Subscriber record (free-text chronic disease
 * details) and the nutrition engine (src/lib/nutrition/engine.js).
 *
 * Provides:
 *  - normalizeText(): Arabic-aware search normalization (diacritics, tatweel,
 *    alef variants, ة/ه, ى/ي) used by the food-index search.
 *  - deriveConditions(subscriber): best-effort mapping of the subscriber's
 *    free-text `chronic_diseases_details` to CHRONIC_CONDITIONS keys.
 *  - buildEngineProfile(subscriber): UserProfile object for engine functions.
 *  - evaluateMealForSubscriber(): merges Meal entity warning flags and matched
 *    food-index tags into one engine evaluation.
 */
import { useEffect, useState } from "react";
import { CHRONIC_CONDITIONS, evaluateFoodForProfile } from "@/lib/nutrition/engine";

// ── lazy food-index loader (shared async chunk, cached across components) ──
let indexCache = null;
let indexPromise = null;

/** React hook: loads src/data/food_index.json once as an async chunk. */
export function useFoodIndexItems() {
  const [items, setItems] = useState(indexCache);
  useEffect(() => {
    if (indexCache) {
      setItems(indexCache);
      return;
    }
    let alive = true;
    indexPromise =
      indexPromise ||
      import("@/data/food_index.json").then((mod) => {
        indexCache = mod.default.items;
        return indexCache;
      });
    indexPromise.then((loaded) => {
      if (alive) setItems(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);
  return items;
}

/** Strip Arabic diacritics/tatweel and unify look-alike letters for search. */
export function normalizeText(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "") // harakat + superscript alef + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Keyword map: CHRONIC_CONDITIONS key → substrings (already normalized) that
 * we look for inside the subscriber's free-text disease details.
 */
const CONDITION_KEYWORDS = {
  diabetes: ["سكري", "diabet", "سكر الدم"],
  prediabetes: ["ما قبل السكري", "prediabet"],
  hypertension: ["ضغط", "hypertension", "blood pressure"],
  heart_disease: ["قلب", "heart", "شرايين"],
  high_cholesterol: ["كوليسترول", "cholesterol", "دهون الدم", "دهنيات"],
  kidney_disease: ["كلي", "كلوي", "kidney", "renal"],
  gout: ["نقرس", "gout", "يوريك", "حمض البول"],
  celiac: ["سيلياك", "celiac", "غلوتين", "gluten", "حساسية القمح"],
  gerd: ["ارتجاع", "حموضه", "حموضة", "gerd", "reflux", "مري"],
  liver_disease: ["كبد", "liver", "hepat"],
  hypothyroid: ["درقيه", "درقية", "thyroid", "خمول الغده", "خمول الغدة"],
  anemia: ["انيميا", "أنيميا", "فقر الدم", "anemia", "anaemia"],
  osteoporosis: ["هشاشه", "هشاشة", "osteopor", "كساح"],
  pregnancy: ["حامل", "حمل", "pregnan"],
  lactation: ["رضاعه", "رضاعة", "مرضع", "lactat", "breastfeed"],
};

/**
 * Best-effort derivation of CHRONIC_CONDITIONS keys from a Subscriber record.
 * Returns [] when the subscriber reported no chronic diseases.
 */
export function deriveConditions(subscriber) {
  if (!subscriber) return [];
  const text = normalizeText(
    [subscriber.chronic_diseases_details, ""].join(" ")
  );
  const found = [];
  for (const [key, words] of Object.entries(CONDITION_KEYWORDS)) {
    if (words.some((w) => text.includes(normalizeText(w)))) found.push(key);
  }
  // If the subscriber ticked "has chronic diseases" but nothing matched,
  // we cannot safely guess — leave empty rather than over-warning.
  return found;
}

/**
 * Build an engine UserProfile from a Subscriber record.
 * Missing pieces fall back to safe defaults (adult, sedentary, maintain).
 */
export function buildEngineProfile(subscriber) {
  if (!subscriber) return null;
  const conditions = deriveConditions(subscriber);
  let age = 30;
  if (subscriber.birth_date) {
    const dob = new Date(subscriber.birth_date);
    if (!isNaN(dob)) {
      age = Math.max(
        10,
        Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000))
      );
    }
  }
  return {
    age,
    gender: subscriber.gender === "female" ? "female" : "male",
    height_cm: subscriber.height_cm || 170,
    weight_kg: subscriber.current_weight || 75,
    target_weight_kg: subscriber.target_weight || undefined,
    activity_level: subscriber.activity_level || "sedentary",
    goal:
      subscriber.target_weight && subscriber.current_weight
        ? subscriber.target_weight < subscriber.current_weight
          ? "lose"
          : subscriber.target_weight > subscriber.current_weight
            ? "gain"
            : "maintain"
        : "lose",
    conditions: conditions.filter((k) => k !== "pregnancy" && k !== "lactation"),
    pregnant: conditions.includes("pregnancy"),
    lactating: conditions.includes("lactation"),
  };
}

/** Meal entity boolean flags → engine condition keys. */
export const MEAL_FLAG_MAP = {
  warning_diabetes: "diabetes",
  warning_blood_pressure: "hypertension",
  warning_cholesterol: "high_cholesterol",
  warning_kidney_disease: "kidney_disease",
};

/**
 * Fuzzy-match a Meal entity record (or any name) to a food-index item so its
 * tag vocabulary can feed the engine. Returns the index item or null.
 */
export function matchFoodIndexItem(nameAr, nameEn, indexItems) {
  if (!indexItems?.length) return null;
  const na = normalizeText(nameAr);
  const ne = normalizeText(nameEn);
  if (!na && !ne) return null;
  // 1) exact normalized match
  let hit = indexItems.find(
    (it) => normalizeText(it.name_ar) === na || (ne && normalizeText(it.name_en) === ne)
  );
  if (hit) return hit;
  // 2) containment (either direction), prefer the longest index name
  const candidates = indexItems.filter((it) => {
    const ia = normalizeText(it.name_ar);
    const ie = normalizeText(it.name_en);
    return (
      (na && ia && (ia.includes(na) || na.includes(ia))) ||
      (ne && ie && (ie.includes(ne) || ne.includes(ie)))
    );
  });
  candidates.sort(
    (a, b) => (b.name_ar?.length || 0) - (a.name_ar?.length || 0)
  );
  return candidates[0] || null;
}

/**
 * Evaluate a catalog Meal against the subscriber's health profile.
 * Combines:
 *   a) the Meal entity's warning_* boolean flags, and
 *   b) the matched food-index item's tags/numbers (when matched).
 * Returns { allowed, warnings, matchedItem, flagConditions } — warnings are
 * engine-shaped: { condition, severity, message_ar, message_en }.
 */
export function evaluateMealForSubscriber(meal, subscriber, indexItems) {
  const profile = buildEngineProfile(subscriber);
  if (!meal || !profile) {
    return { allowed: true, warnings: [], matchedItem: null, flagConditions: [] };
  }

  const matchedItem = matchFoodIndexItem(meal.name, meal.name_en, indexItems);
  const size = meal.__size || null; // optional chosen size attached by caller

  const food = {
    name_ar: meal.name,
    name_en: meal.name_en,
    calories: size?.calories ?? matchedItem?.calories ?? 0,
    sugar_g: matchedItem?.sugar_g ?? 0,
    sodium_mg: matchedItem?.sodium_mg ?? 0,
    tags: matchedItem?.tags ?? [],
  };

  const result = evaluateFoodForProfile(food, profile);
  const warnings = [...result.warnings];
  const subscriberConds = new Set([
    ...(profile.conditions || []),
    ...(profile.pregnant ? ["pregnancy"] : []),
    ...(profile.lactating ? ["lactation"] : []),
  ]);

  // Meal entity flags only fire when the subscriber actually has that condition.
  const flagConditions = [];
  for (const [flag, condKey] of Object.entries(MEAL_FLAG_MAP)) {
    if (!meal[flag] || !subscriberConds.has(condKey)) continue;
    flagConditions.push(condKey);
    const cond = CHRONIC_CONDITIONS[condKey];
    // Avoid duplicating an identical engine warning.
    if (warnings.some((w) => w.condition === condKey && w.severity !== "info")) continue;
    warnings.push({
      condition: condKey,
      severity: "caution",
      message_ar: `${cond.emoji} ${cond.name_ar}: هذه الوجبة موسومة كغير مناسبة لحالتك.`,
      message_en: `${cond.emoji} ${cond.name_en}: this meal is flagged as unsuitable for your condition.`,
    });
  }

  const allowed = !warnings.some((w) => w.severity === "danger");
  return { allowed, warnings, matchedItem, flagConditions };
}

/**
 * Conditions (with registry metadata) relevant to a subscriber, used to show
 * the physician caution text in the active language.
 */
export function subscriberConditionMeta(subscriber) {
  const profile = buildEngineProfile(subscriber);
  if (!profile) return [];
  const keys = [
    ...(profile.conditions || []),
    ...(profile.pregnant ? ["pregnancy"] : []),
    ...(profile.lactating ? ["lactation"] : []),
  ];
  return keys
    .map((k) => ({ key: k, ...CHRONIC_CONDITIONS[k] }))
    .filter((c) => c.name_ar);
}
