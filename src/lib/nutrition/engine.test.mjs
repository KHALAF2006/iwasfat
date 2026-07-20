/**
 * engine.test.mjs — sanity tests for the nutrition engine.
 * Run: node --test src/lib/nutrition/engine.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateBMI,
  calculateIdealWeight,
  calculateWaterGoal,
  macroSplit,
  CHRONIC_CONDITIONS,
  evaluateFoodForProfile,
  suggestDailyTargets,
} from "./engine.js";

const baseProfile = {
  age: 35,
  gender: "female",
  height_cm: 165,
  weight_kg: 70,
  activity_level: "sedentary",
  goal: "maintain",
  conditions: [],
};

test("BMR uses Mifflin-St Jeor and is gender-aware", () => {
  // 10*70 + 6.25*165 - 5*35 - 161 = 700 + 1031.25 - 175 - 161 = 1395.25
  assert.equal(calculateBMR(baseProfile), 1395);
  const male = { ...baseProfile, gender: "male" };
  // 700 + 1031.25 - 175 + 5 = 1561.25
  assert.equal(calculateBMR(male), 1561);
});

test("TDEE applies activity factors", () => {
  assert.equal(calculateTDEE(baseProfile), Math.round(1395 * 1.2));
  assert.equal(
    calculateTDEE({ ...baseProfile, activity_level: "active" }),
    Math.round(1395 * 1.725)
  );
});

test("lose goal creates a deficit; female floor of 1200 kcal holds", () => {
  const small = {
    age: 30, gender: "female", height_cm: 155, weight_kg: 55,
    activity_level: "sedentary", goal: "lose", conditions: [],
  };
  const t = calculateTargetCalories(small);
  assert.ok(t.calories >= 1200, `calories ${t.calories} below female floor`);
  assert.ok(t.applied_floors.includes("safe_floor"));
});

test("male floor of 1500 kcal holds", () => {
  const smallMale = {
    age: 28, gender: "male", height_cm: 168, weight_kg: 62,
    activity_level: "sedentary", goal: "lose", conditions: [],
  };
  const t = calculateTargetCalories(smallMale);
  assert.ok(t.calories >= 1500);
});

test("deficit never exceeds 1000 kcal/day", () => {
  const big = {
    age: 30, gender: "male", height_cm: 190, weight_kg: 160,
    activity_level: "very_active", goal: "lose", conditions: [],
  };
  const t = calculateTargetCalories(big);
  assert.ok(t.deficit <= 1000);
});

test("teens get no deficit and a growth allowance", () => {
  const teen = { ...baseProfile, age: 15, goal: "lose" };
  const t = calculateTargetCalories(teen);
  assert.equal(t.deficit, 0);
  assert.ok(t.applied_floors.includes("teen_no_deficit"));
  assert.ok(t.applied_floors.includes("teen"));
  assert.ok(t.calories >= calculateTDEE(teen));
});

test("pregnancy adds 300 kcal and lactation adds 500 kcal", () => {
  const tdee = calculateTDEE(baseProfile);
  const preg = calculateTargetCalories({ ...baseProfile, pregnant: true });
  assert.equal(preg.calories, tdee + 300);
  const lact = calculateTargetCalories({ ...baseProfile, lactating: true });
  assert.equal(lact.calories, tdee + 500);
});

test("medical supervision flag triggers below 80% of BMR", () => {
  // Force the flag via a very aggressive (capped) situation check on function
  const p = { age: 45, gender: "female", height_cm: 150, weight_kg: 45,
    activity_level: "sedentary", goal: "lose", conditions: [] };
  const t = calculateTargetCalories(p);
  // target should never be below 1200; if 1200 < 0.8*BMR the flag fires
  const bmr = calculateBMR(p);
  if (t.calories < bmr * 0.8) assert.ok(t.requires_medical_supervision);
  else assert.equal(t.requires_medical_supervision, false);
});

test("BMI math and categories", () => {
  const r = calculateBMI(70, 165); // 25.7
  assert.equal(r.bmi, 25.7);
  assert.equal(r.category, "overweight");
  assert.ok(r.label_ar.length > 0 && r.label_en.length > 0);
  assert.equal(calculateBMI(55, 165).category, "normal");
  assert.equal(calculateBMI(40, 165).category, "underweight");
});

test("ideal weight is gender-aware (Devine)", () => {
  const f = calculateIdealWeight("female", 165);
  const m = calculateIdealWeight("male", 165);
  assert.ok(m.ideal_kg > f.ideal_kg);
  assert.ok(f.range_min_kg < f.ideal_kg && f.range_max_kg > f.ideal_kg);
});

test("water goal scales with weight and activity", () => {
  const sed = calculateWaterGoal(baseProfile);
  const act = calculateWaterGoal({ ...baseProfile, activity_level: "active" });
  assert.equal(sed.ml, 2450); // 70 * 35
  assert.ok(act.ml > sed.ml);
  assert.ok(sed.cups >= 8);
});

test("macro split: diabetic adjustment lowers carbs", () => {
  const std = macroSplit(2000, "maintain", []);
  const dia = macroSplit(2000, "maintain", ["diabetes"]);
  assert.ok(dia.carbs_g < std.carbs_g);
  assert.ok(dia.adjustments.includes("diabetes"));
  // grams roughly match calories: 4p+4c+9f within 10%
  const kcal = 4 * dia.protein_g + 4 * dia.carbs_g + 9 * dia.fat_g;
  assert.ok(Math.abs(kcal - 2000) / 2000 < 0.1);
});

test("macro split: kidney disease moderates protein", () => {
  const k = macroSplit(2000, "maintain", ["kidney_disease"]);
  assert.ok(k.adjustments.includes("kidney"));
  assert.ok(k.protein_g < macroSplit(2000, "maintain", []).protein_g);
});

test("chronic conditions registry is complete and bilingual", () => {
  const expected = ["diabetes", "prediabetes", "hypertension", "heart_disease",
    "high_cholesterol", "kidney_disease", "gout", "celiac", "gerd",
    "liver_disease", "hypothyroid", "anemia", "osteoporosis", "pregnancy", "lactation"];
  for (const k of expected) {
    const c = CHRONIC_CONDITIONS[k];
    assert.ok(c, `missing condition ${k}`);
    for (const f of ["name_ar", "name_en", "emoji", "doctor_caution_ar", "doctor_caution_en"]) {
      assert.ok(c[f] && String(c[f]).length > 0, `${k}.${f} missing`);
    }
    assert.ok(Array.isArray(c.avoid_tags) && Array.isArray(c.prefer_tags));
    assert.ok(c.doctor_caution_ar.split(/[.!؟?]/).length >= 3, `${k} caution too short`);
  }
});

const kunafa = {
  name_ar: "كنافة", name_en: "Kunafa", calories: 500,
  protein_g: 8, carbs_g: 45, fat_g: 18, fiber_g: 1, sugar_g: 30,
  sodium_mg: 350, tags: ["high_sugar", "contains_gluten", "diabetic_caution"],
};
const pita = {
  name_ar: "خبز", name_en: "Pita", calories: 250,
  protein_g: 8, carbs_g: 50, fat_g: 2, fiber_g: 2, sugar_g: 1,
  sodium_mg: 400, tags: ["contains_gluten", "refined_carb"],
};
const grilledFish = {
  name_ar: "سمك مشوي", name_en: "Grilled Fish", calories: 200,
  protein_g: 34, carbs_g: 0, fat_g: 6, fiber_g: 0, sugar_g: 0,
  sodium_mg: 120, tags: ["high_protein", "heart_healthy", "contains_seafood"],
};

test("diabetes flags sugary food", () => {
  const r = evaluateFoodForProfile(kunafa, { ...baseProfile, conditions: ["diabetes"] });
  assert.ok(r.warnings.length > 0);
  assert.ok(r.warnings.some((w) => w.condition === "diabetes" && w.severity === "caution"));
});

test("celiac marks gluten food as not allowed (danger)", () => {
  const r = evaluateFoodForProfile(pita, { ...baseProfile, conditions: ["celiac"] });
  assert.equal(r.allowed, false);
  assert.ok(r.warnings.some((w) => w.severity === "danger"));
});

test("hypertension flags high-sodium food", () => {
  const salty = { ...pita, sodium_mg: 900, tags: ["high_sodium"] };
  const r = evaluateFoodForProfile(salty, { ...baseProfile, conditions: ["hypertension"] });
  assert.ok(r.warnings.some((w) => w.condition === "hypertension"));
});

test("healthy food passes clean for healthy profile", () => {
  const r = evaluateFoodForProfile(grilledFish, baseProfile);
  assert.equal(r.allowed, true);
  assert.equal(r.warnings.length, 0);
});

test("gout flags seafood", () => {
  const r = evaluateFoodForProfile(grilledFish, { ...baseProfile, conditions: ["gout"] });
  assert.ok(r.warnings.some((w) => w.condition === "gout"));
});

test("pregnant profile flags caffeine via boolean", () => {
  const coffee = { name_ar: "قهوة", name_en: "Coffee", calories: 5, tags: ["caffeine"] };
  const r = evaluateFoodForProfile(coffee, { ...baseProfile, pregnant: true });
  assert.equal(r.allowed, false);
  assert.ok(r.warnings.some((w) => w.condition === "pregnancy" && w.severity === "danger"));
});

test("suggestDailyTargets returns full bilingual targets with meal split", () => {
  const t = suggestDailyTargets({ ...baseProfile, goal: "lose", conditions: ["diabetes"] });
  assert.ok(t.bmr > 0 && t.tdee >= t.bmr);
  assert.ok(t.target_calories >= 1200);
  const s = t.meal_split;
  assert.ok(s.breakfast_kcal > 0 && s.lunch_kcal > 0 && s.dinner_kcal > 0 && s.snacks_kcal > 0);
  const total = s.breakfast_kcal + s.lunch_kcal + s.dinner_kcal + s.snacks_kcal;
  assert.ok(Math.abs(total - t.target_calories) <= 3);
  assert.equal(Math.round(t.target_calories * 0.25), s.breakfast_kcal);
  assert.ok(t.macros.adjustments.includes("diabetes"));
  assert.ok(t.note_ar && t.note_en && t.meal_split_note_ar && t.meal_split_note_en);
});
