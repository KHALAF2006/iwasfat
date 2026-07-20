/**
 * engine.js — iwasfat doctor/nutrition engine.
 *
 * Framework-agnostic ES module of pure functions for calorie needs, BMI,
 * ideal weight, water goals, macro splits and chronic-condition food safety
 * evaluation. All user-facing strings are bilingual (ar/en).
 *
 * NOTE: these are evidence-based estimates (Mifflin-St Jeor, standard
 * activity multipliers) for general guidance — not medical advice.
 * @module nutrition/engine
 */

/** @typedef {"male"|"female"} Gender */
/** @typedef {"sedentary"|"light"|"moderate"|"active"|"very_active"} ActivityLevel */
/** @typedef {"lose"|"maintain"|"gain"} Goal */

/**
 * @typedef {Object} UserProfile
 * @property {number} age - years
 * @property {Gender} gender
 * @property {number} height_cm
 * @property {number} weight_kg
 * @property {number} [target_weight_kg]
 * @property {ActivityLevel} [activity_level="sedentary"]
 * @property {Goal} [goal="maintain"]
 * @property {string[]} [conditions=[]] - keys of CHRONIC_CONDITIONS
 * @property {boolean} [pregnant=false]
 * @property {boolean} [lactating=false]
 */

/**
 * @typedef {Object} FoodItem
 * @property {string} [name_ar]
 * @property {string} [name_en]
 * @property {number} [calories=0]
 * @property {number} [protein_g=0]
 * @property {number} [carbs_g=0]
 * @property {number} [fat_g=0]
 * @property {number} [fiber_g=0]
 * @property {number} [sugar_g=0]
 * @property {number} [sodium_mg=0]
 * @property {string[]} [tags=[]]
 */

/** Activity multipliers for TDEE (Harris-Benedict convention). */
const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Safe daily calorie floors — never recommend below these without a doctor. */
const SAFE_FLOORS = { male: 1500, female: 1200 };
/** Maximum recommended daily deficit (kcal/day). */
const MAX_DEFICIT = 1000;

/**
 * Basal metabolic rate — Mifflin-St Jeor equation (gender-aware).
 * @param {Object} p
 * @param {Gender} p.gender
 * @param {number} p.weight_kg
 * @param {number} p.height_cm
 * @param {number} p.age
 * @returns {number} kcal/day, rounded
 */
export function calculateBMR({ gender, weight_kg, height_cm, age }) {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  const bmr = gender === "male" ? base + 5 : base - 161;
  return Math.round(bmr);
}

/**
 * Total daily energy expenditure = BMR × activity factor.
 * @param {UserProfile} profile
 * @returns {number} kcal/day, rounded
 */
export function calculateTDEE(profile) {
  const factor = ACTIVITY_FACTORS[profile.activity_level || "sedentary"] ?? 1.2;
  return Math.round(calculateBMR(profile) * factor);
}

/**
 * Target daily calories for a goal with safety rails:
 *  - lose: TDEE − 500 (deficit capped at 1000 kcal/day)
 *  - gain: TDEE + 300
 *  - absolute floors: 1200 kcal women / 1500 kcal men
 *  - below BMR×0.8 → requires_medical_supervision flag
 *  - teens (<18): +150 kcal growth allowance, and weight-loss is discouraged
 *  - elderly (>65): milder deficit (300 kcal) to protect muscle mass
 *  - pregnancy: +300 kcal, lactation: +500 kcal (never in deficit)
 * @param {UserProfile} profile
 * @returns {{calories:number, deficit:number, requires_medical_supervision:boolean,
 *   applied_floors:string[], note_ar:string, note_en:string}}
 */
export function calculateTargetCalories(profile) {
  const tdee = calculateTDEE(profile);
  const bmr = calculateBMR(profile);
  const goal = profile.goal || "maintain";
  const flags = [];
  let deficit = 0;
  let target = tdee;

  if (goal === "lose") {
    deficit = profile.age > 65 ? 300 : 500;
    deficit = Math.min(deficit, MAX_DEFICIT);
    if (profile.age < 18) {
      deficit = 0;
      flags.push("teen_no_deficit");
    }
    target = tdee - deficit;
  } else if (goal === "gain") {
    target = tdee + 300;
  }

  if (profile.age < 18) {
    target += 150; // growth allowance
    flags.push("teen");
  }

  if (profile.pregnant) {
    target = Math.max(target, tdee) + 300;
    flags.push("pregnancy");
  }
  if (profile.lactating) {
    target = Math.max(target, tdee) + 500;
    flags.push("lactation");
  }

  const floor = SAFE_FLOORS[profile.gender] ?? 1200;
  if (target < floor) {
    target = floor;
    deficit = Math.max(0, tdee - floor);
    flags.push("safe_floor");
  }

  let requiresMedical = false;
  if (target < bmr * 0.8) {
    requiresMedical = true;
    flags.push("below_80pct_bmr");
  }
  if (deficit >= MAX_DEFICIT) flags.push("max_deficit");

  const notes = {
    safe_floor: ["تم تطبيق الحد الأدنى الآمن للسعرات لحماية صحتك.", "A safe calorie floor was applied to protect your health."],
    teen_no_deficit: ["للمراهقين دون 18 سنة لا ننصح بعجز حراري دون إشراف طبي.", "For teens under 18 we do not recommend a calorie deficit without medical supervision."],
    teen: ["تمت إضافة احتياج النمو للمراهقين.", "A teen growth allowance was added."],
    pregnancy: ["تمت إضافة احتياج الحمل (300 سعرة).", "Pregnancy needs (+300 kcal) were added."],
    lactation: ["تمت إضافة احتياج الرضاعة (500 سعرة).", "Lactation needs (+500 kcal) were added."],
    below_80pct_bmr: ["الهدف منخفض جدًا؛ يلزم إشراف طبي.", "Target is very low; medical supervision is required."],
    max_deficit: ["تم تقييد العجز الحراري بحد أقصى 1000 سعرة يوميًا.", "Deficit was capped at the 1000 kcal/day maximum."],
    none: ["هدفك الحراري ضمن النطاق الآمن.", "Your calorie target is within the safe range."],
  };
  const primary = flags.find((f) => f !== "teen" && notes[f]) || "none";
  return {
    calories: Math.round(target),
    deficit: Math.round(deficit),
    requires_medical_supervision: requiresMedical,
    applied_floors: flags,
    note_ar: notes[primary][0],
    note_en: notes[primary][1],
  };
}

/**
 * Body mass index and category.
 * @param {number} weight_kg
 * @param {number} height_cm
 * @returns {{bmi:number, category:string, label_ar:string, label_en:string}}
 */
export function calculateBMI(weight_kg, height_cm) {
  const m = height_cm / 100;
  const bmi = Math.round((weight_kg / (m * m)) * 10) / 10;
  const cats = [
    [18.5, "underweight", "نقص وزن", "Underweight"],
    [25, "normal", "وزن طبيعي", "Normal weight"],
    [30, "overweight", "زيادة وزن", "Overweight"],
    [35, "obese_1", "سمنة درجة أولى", "Obesity class I"],
    [40, "obese_2", "سمنة درجة ثانية", "Obesity class II"],
    [Infinity, "obese_3", "سمنة مفرطة", "Obesity class III"],
  ];
  const [, category, label_ar, label_en] = cats.find(([max]) => bmi < max);
  return { bmi, category, label_ar, label_en };
}

/**
 * Ideal body weight — gender-aware (Devine formula, widely used clinically).
 * @param {Gender} gender
 * @param {number} height_cm
 * @returns {{ideal_kg:number, range_min_kg:number, range_max_kg:number, formula:string}}
 */
export function calculateIdealWeight(gender, height_cm) {
  const inchesOver5ft = Math.max(0, (height_cm - 152.4) / 2.54);
  const base = gender === "male" ? 50 : 45.5;
  const ideal = base + 2.3 * inchesOver5ft;
  return {
    ideal_kg: Math.round(ideal * 10) / 10,
    range_min_kg: Math.round(ideal * 0.9 * 10) / 10,
    range_max_kg: Math.round(ideal * 1.1 * 10) / 10,
    formula: "devine",
  };
}

/**
 * Daily water goal in ml: 35 ml/kg, plus activity and climate-style adjustments.
 * @param {UserProfile} profile
 * @returns {{ml:number, cups:number, note_ar:string, note_en:string}}
 */
export function calculateWaterGoal(profile) {
  let ml = profile.weight_kg * 35;
  const act = profile.activity_level || "sedentary";
  if (act === "moderate") ml += 350;
  else if (act === "active") ml += 500;
  else if (act === "very_active") ml += 750;
  if (profile.pregnant) ml += 300;
  if (profile.lactating) ml += 700;
  ml = Math.round(ml / 50) * 50;
  return {
    ml,
    cups: Math.round(ml / 250),
    note_ar: "وزّع شرب الماء على مدار اليوم، وزد الكمية مع الحر أو الرياضة.",
    note_en: "Spread water intake across the day; increase with heat or exercise.",
  };
}

/**
 * Macro split (grams/day) for a calorie target, adjusted for conditions.
 * Defaults by goal: lose 30/40/30, maintain 20/50/30, gain 25/45/30 (P/C/F %).
 * Diabetes/prediabetes → carbs capped at 40% with fiber emphasis.
 * Kidney disease → protein moderated to 15-18%.
 * @param {number} targetCal
 * @param {Goal} goal
 * @param {string[]} [conditions=[]]
 * @returns {{protein_g:number, carbs_g:number, fat_g:number,
 *   protein_pct:number, carbs_pct:number, fat_pct:number,
 *   adjustments:string[], note_ar:string, note_en:string}}
 */
export function macroSplit(targetCal, goal, conditions = []) {
  let pPct = { lose: 30, maintain: 20, gain: 25 }[goal] ?? 20;
  let cPct = { lose: 40, maintain: 50, gain: 45 }[goal] ?? 50;
  let fPct = 100 - pPct - cPct;
  const adjustments = [];

  const has = (k) => conditions.includes(k);
  if (has("diabetes") || has("prediabetes")) {
    cPct = 40;
    pPct = Math.max(pPct, 25);
    fPct = 100 - pPct - cPct;
    adjustments.push("diabetes");
  }
  if (has("kidney_disease")) {
    pPct = 16;
    cPct = 54;
    fPct = 30;
    adjustments.push("kidney");
  }
  if (has("heart_disease") || has("high_cholesterol")) {
    fPct = Math.min(fPct, 30);
    cPct = 100 - pPct - fPct;
    adjustments.push("heart");
  }

  const noteKey = adjustments[0];
  const notes = {
    diabetes: ["تم تخفيض الكربوهيدرات ورفع البروتين بما يناسب السكري.", "Carbs lowered and protein raised to suit diabetes."],
    kidney: ["تم تعديل البروتين بما يناسب صحة الكلى.", "Protein moderated to suit kidney health."],
    heart: ["تم ضبط الدهون بما يناسب صحة القلب.", "Fat adjusted to suit heart health."],
    none: ["توزيع الماكروز قياسي حسب هدفك.", "Standard macro split for your goal."],
  };
  const [ar, en] = notes[noteKey || "none"];
  return {
    protein_g: Math.round((targetCal * pPct) / 100 / 4),
    carbs_g: Math.round((targetCal * cPct) / 100 / 4),
    fat_g: Math.round((targetCal * fPct) / 100 / 9),
    protein_pct: pPct,
    carbs_pct: cPct,
    fat_pct: fPct,
    adjustments,
    note_ar: ar,
    note_en: en,
  };
}

/**
 * Chronic conditions registry. avoid_tags/prefer_tags reference the food
 * database tag vocabulary (src/data/food_db.json).
 * @type {Record<string, {name_ar:string, name_en:string, emoji:string,
 *   doctor_caution_ar:string, doctor_caution_en:string,
 *   daily_limits:Object, avoid_tags:string[], prefer_tags:string[]}>}
 */
export const CHRONIC_CONDITIONS = {
  diabetes: {
    name_ar: "مرض السكري",
    name_en: "Diabetes",
    emoji: "🩸",
    doctor_caution_ar: "انتبه لكمية الكربوهيدرات في كل وجبة ووزّعها على مدار اليوم. تجنّب السكريات المضافة والمشروبات المحلاة والعصائر حتى الطبيعية منها. اختر الحبوب الكاملة والألياف لإبطاء امتصاص الجلوكوز، وراقب سكر الدم بانتظام ولا تغيّر أدويتك دون استشارة طبيبك.",
    doctor_caution_en: "Watch carbohydrate amounts per meal and spread them across the day. Avoid added sugars, sweetened drinks, and juices. Choose whole grains and fiber to slow glucose absorption, monitor blood sugar regularly, and never adjust medication without your doctor.",
    daily_limits: { sugar_g: 25, carbs_g: 200, sodium_mg: 2300 },
    avoid_tags: ["high_sugar", "refined_carb", "diabetic_caution"],
    prefer_tags: ["whole_grain", "high_fiber", "diabetic_friendly", "low_calorie"],
  },
  prediabetes: {
    name_ar: "ما قبل السكري",
    name_en: "Prediabetes",
    emoji: "⚠️",
    doctor_caution_ar: "مرحلة ما قبل السكري فرصة حقيقية للوقاية. فقدان 5-10٪ من الوزن مع نشاط بدني منتظم يقلل خطر الإصابة بشكل كبير. قلل السكريات والخبز الأبيض والأرز الأبيض، واستبدلها بالحبوب الكاملة والخضار.",
    doctor_caution_en: "Prediabetes is a real prevention opportunity. Losing 5-10% of body weight with regular activity greatly reduces risk. Cut sugars, white bread and white rice; replace with whole grains and vegetables.",
    daily_limits: { sugar_g: 30, sodium_mg: 2300 },
    avoid_tags: ["high_sugar", "refined_carb"],
    prefer_tags: ["whole_grain", "high_fiber", "diabetic_friendly", "low_calorie"],
  },
  hypertension: {
    name_ar: "ارتفاع ضغط الدم",
    name_en: "Hypertension",
    emoji: "💗",
    doctor_caution_ar: "الملح هو العدو الأول: لا تتجاوز 2000 ملغ صوديوم يوميًا (نحو 5 غ ملح). احذر المخللات والمعلبات والوجبات السريعة والأجبان المالحة والمرق الجاهز. أكثر من البوتاسيوم من الخضار والفواكه ما لم تكن تعاني من أمراض كلوية، وراقب ضغطك منزليًا.",
    doctor_caution_en: "Salt is enemy number one: stay under 2000 mg sodium daily (~5 g salt). Beware pickles, canned food, fast food, salty cheeses and stock cubes. Favor potassium-rich produce unless you have kidney disease, and monitor your blood pressure at home.",
    daily_limits: { sodium_mg: 2000 },
    avoid_tags: ["high_sodium", "hypertension_caution", "processed"],
    prefer_tags: ["heart_healthy", "low_calorie", "high_fiber"],
  },
  heart_disease: {
    name_ar: "أمراض القلب",
    name_en: "Heart Disease",
    emoji: "❤️",
    doctor_caution_ar: "اعتمد نمط البحر المتوسط: زيت زيتون وأسماك وخضار وحبوب كاملة. قلل الدهون المشبعة والمقليات واللحوم المصنعة، وتجنب الدهون المتحولة تمامًا. راقب الكوليسترول وضغط الدم، ولا تهمل أدويتك، واستشر طبيبك قبل أي حمية قاسية.",
    doctor_caution_en: "Follow a Mediterranean pattern: olive oil, fish, vegetables, whole grains. Limit saturated fat, fried food and processed meats; avoid trans fats entirely. Monitor cholesterol and blood pressure, stay on your medications, and consult your doctor before any restrictive diet.",
    daily_limits: { sodium_mg: 2000, fat_g: 70, sugar_g: 30 },
    avoid_tags: ["fried", "high_sodium", "processed"],
    prefer_tags: ["heart_healthy", "high_fiber", "whole_grain"],
  },
  high_cholesterol: {
    name_ar: "ارتفاع الكوليسترول",
    name_en: "High Cholesterol",
    emoji: "🧈",
    doctor_caution_ar: "قلل الدهون المشبعة (السمن والزبدة واللحوم الدسمة) واستبدلها بزيت الزيتون والمكسرات والأسماك الدهنية. الألياف الذائبة في الشوفان والبقول تساعد على خفض LDL. قلل المقليات والمعجنات، وحافظ على نشاط بدني أسبوعي منتظم.",
    doctor_caution_en: "Cut saturated fats (ghee, butter, fatty meats) and replace with olive oil, nuts and fatty fish. Soluble fiber from oats and legumes helps lower LDL. Limit fried food and pastries, and keep regular weekly physical activity.",
    daily_limits: { fat_g: 65, sugar_g: 30 },
    avoid_tags: ["fried", "processed"],
    prefer_tags: ["heart_healthy", "high_fiber", "whole_grain"],
  },
  kidney_disease: {
    name_ar: "أمراض الكلى",
    name_en: "Kidney Disease",
    emoji: "🫘",
    doctor_caution_ar: "التغذية الكلوية دقيقة وتعتمد على مرحلة المرض: غالبًا يُنصح بتقليل البروتين الزائد والصوديوم، وقد تحتاج لتقييد البوتاسيوم والفوسفور (المكسرات، البقول، المعلبات، المشروبات الغازية الداكنة). لا تتبع حمية عالية البروتين، وراجع أخصائي تغذية كلوية لخطة شخصية.",
    doctor_caution_en: "Renal nutrition is precise and stage-dependent: usually moderating protein and sodium is advised, and you may need to restrict potassium and phosphorus (nuts, legumes, canned food, dark sodas). Do not follow high-protein diets, and see a renal dietitian for a personal plan.",
    daily_limits: { sodium_mg: 2000, protein_g: 60, potassium_note: true, phosphorus_note: true },
    avoid_tags: ["high_sodium", "kidney_caution", "processed", "high_protein"],
    prefer_tags: ["low_calorie"],
  },
  gout: {
    name_ar: "النقرس",
    name_en: "Gout",
    emoji: "🦶",
    doctor_caution_ar: "النقرس يرتبط بالبيورين: قلل اللحوم الحمراء والأعضاء الداخلية (الكبدة والكلاوي) والسردين والمحار. أكثر من شرب الماء، وقلل المشروبات المحلاة والعصائر المركزة. الحليب قليل الدسم والخضار والكرز خيارات مساعدة، وحافظ على وزن صحي دون حميات قاسية مفاجئة.",
    doctor_caution_en: "Gout is linked to purines: limit red meat, organ meats (liver, kidneys), sardines and shellfish. Drink plenty of water, cut sweetened drinks and concentrated juices. Low-fat dairy, vegetables and cherries are helpful; keep a healthy weight without crash diets.",
    daily_limits: { sugar_g: 30, purine_warning: true },
    avoid_tags: ["gout_caution", "contains_seafood"],
    prefer_tags: ["low_calorie", "heart_healthy"],
  },
  celiac: {
    name_ar: "مرض السيلياك (حساسية القمح)",
    name_en: "Celiac Disease",
    emoji: "🌾",
    doctor_caution_ar: "الالتزام الكامل مدى الحياة بحمية خالية من الغلوتين هو العلاج الوحيد. تجنب القمح والشعير والجاودار وكل منتجاتها (الخبز، المعجنات، الكنافة، الكسكس، الشعيرية) واحذر التلوث المتبادل في المطبخ والمطاعم. اقرأ الملصقات دائمًا، واختر الأرز والذرة والكينوا والبطاطس كبدائل آمنة.",
    doctor_caution_en: "Strict lifelong gluten exclusion is the only treatment. Avoid wheat, barley, rye and all their products (bread, pastries, kunafa, couscous, vermicelli) and beware cross-contamination in kitchens and restaurants. Always read labels; rice, corn, quinoa and potatoes are safe staples.",
    daily_limits: { gluten: "strict_exclusion" },
    avoid_tags: ["contains_gluten"],
    prefer_tags: ["high_fiber"],
  },
  gerd: {
    name_ar: "ارتجاع المريء",
    name_en: "GERD (Acid Reflux)",
    emoji: "🔥",
    doctor_caution_ar: "تجنب الوجبات الدسمة والمقلية والشطة والحمضيات والشوكولاتة والنعناع والقهوة بكميات كبيرة، فهي تزيد الارتجاع. تناول وجبات صغيرة متكررة، ولا تستلقِ قبل 3 ساعات من الأكل، وقلل العشاء الدسم ليلًا.",
    doctor_caution_en: "Avoid large fatty meals, fried food, chili, citrus, chocolate, mint and heavy coffee — they worsen reflux. Eat small frequent meals, do not lie down within 3 hours of eating, and keep dinners light.",
    daily_limits: { fat_g: 60, caffeine_note: true },
    avoid_tags: ["fried", "caffeine"],
    prefer_tags: ["low_calorie"],
  },
  liver_disease: {
    name_ar: "أمراض الكبد",
    name_en: "Liver Disease",
    emoji: "🫁",
    doctor_caution_ar: "الكبد يحتاج غذاءً متوازنًا خاليًا تمامًا من الدهون الزائدة والسكريات المكررة والأطعمة المصنعة. قلل الملح إذا كان هناك استسقاء، وتناول بروتينًا كافيًا من مصادر سهلة الهضم ما لم يوجه طبيبك بغير ذلك. امتنع عن المكملات العشبية دون استشارة، فبعضها سام للكبد.",
    doctor_caution_en: "The liver needs balanced food free of excess fat, refined sugars and processed items. Reduce salt if ascites is present, and eat adequate easily-digested protein unless your doctor says otherwise. Avoid herbal supplements without consultation — some are hepatotoxic.",
    daily_limits: { sodium_mg: 2000, sugar_g: 25, fat_g: 60 },
    avoid_tags: ["fried", "processed", "high_sugar", "high_sodium"],
    prefer_tags: ["heart_healthy", "low_calorie"],
  },
  hypothyroid: {
    name_ar: "قصور الغدة الدرقية",
    name_en: "Hypothyroidism",
    emoji: "🦋",
    doctor_caution_ar: "قصور الدرقية يبطئ الأيض، لذا راقب السعرات بصدق وركّز على البروتين والألياف. تناول دواء الدرقية على معدة فارغة وبعيدًا عن الكالسيوم والحديد والقهوة بأربع ساعات. لا تفرط في منتجات الصويا والملفوف النيء، وأكثر من السيلينيوم والزنك من مصادرهما الطبيعية.",
    doctor_caution_en: "Hypothyroidism slows metabolism, so track calories honestly and focus on protein and fiber. Take thyroid medication on an empty stomach, 4 hours away from calcium, iron and coffee. Do not overdo soy and raw crucifers, and get selenium and zinc from natural sources.",
    daily_limits: { sugar_g: 30 },
    avoid_tags: ["processed", "high_sugar"],
    prefer_tags: ["high_protein", "high_fiber", "heart_healthy"],
  },
  anemia: {
    name_ar: "فقر الدم (الأنيميا)",
    name_en: "Anemia",
    emoji: "🩸",
    doctor_caution_ar: "ركّز على الحديد: اللحوم الحمراء باعتدال، الكبدة (إن لم تكن ممنوعة لسبب آخر)، العدس والسبانخ والحمص، مع فيتامين C لتحسين الامتصاص. تجنب شرب الشاي والقهوة مع الوجبات لأنهما يعيقان امتصاص الحديد، وراجع طبيبك لتحديد نوع الأنيميا قبل أي مكملات.",
    doctor_caution_en: "Focus on iron: moderate red meat, liver (if not restricted for another reason), lentils, spinach and chickpeas, with vitamin C to boost absorption. Avoid tea and coffee with meals as they block iron absorption, and see your doctor to identify the anemia type before supplements.",
    daily_limits: {},
    avoid_tags: [],
    prefer_tags: ["high_protein", "high_fiber"],
  },
  osteoporosis: {
    name_ar: "هشاشة العظام",
    name_en: "Osteoporosis",
    emoji: "🦴",
    doctor_caution_ar: "تحتاج كالسيوم كافيًا (1000-1200 ملغ يوميًا) من الحليب والزبادي والجبن والسردين، مع فيتامين D والتعرض الآمن للشمس. قلل الملح الزائد والمشروبات الغازية لأنها تؤثر على الكالسيوم، وحافظ على تمارين الأثقال بإشراف مختص.",
    doctor_caution_en: "You need adequate calcium (1000-1200 mg/day) from milk, yogurt, cheese and sardines, plus vitamin D and safe sun exposure. Limit excess salt and sodas which affect calcium, and keep supervised weight-bearing exercise.",
    daily_limits: { sodium_mg: 2300, calcium_target_mg: 1200 },
    avoid_tags: ["high_sodium", "caffeine"],
    prefer_tags: ["contains_lactose", "high_protein", "heart_healthy"],
  },
  pregnancy: {
    name_ar: "الحمل",
    name_en: "Pregnancy",
    emoji: "🤰",
    doctor_caution_ar: "الحمل ليس وقتًا للحمية: تحتاجين نحو 300 سعرة إضافية فقط يوميًا مع بروتين وكالسيوم وحمض الفوليك والحديد. تجنبي اللحوم والأسماك النيئة والأجبان غير المبسترة والكبدة بإفراط، وقللي الكافيين إلى أقل من 200 ملغ يوميًا، وراجعي طبيبتك بانتظام.",
    doctor_caution_en: "Pregnancy is not a time for dieting: you need only ~300 extra kcal/day with protein, calcium, folate and iron. Avoid raw meats and fish, unpasteurized cheeses and excess liver, keep caffeine under 200 mg/day, and attend regular prenatal care.",
    daily_limits: { caffeine_mg: 200, sugar_g: 30 },
    avoid_tags: ["contains_seafood", "caffeine", "high_sugar"],
    prefer_tags: ["high_protein", "contains_lactose", "high_fiber"],
  },
  lactation: {
    name_ar: "الرضاعة الطبيعية",
    name_en: "Lactation",
    emoji: "🤱",
    doctor_caution_ar: "الرضاعة تحتاج نحو 500 سعرة إضافية يوميًا وسوائل وفيرة. لا تتبعي حميات قاسية، فهي تؤثر على إدرار الحليب. أكثري من البروتين والكالسيوم والشوفان، وقللي الكافيين، وراقبي أي طعام يزعج طفلك.",
    doctor_caution_en: "Lactation needs ~500 extra kcal/day and plenty of fluids. Avoid crash diets as they affect milk supply. Emphasize protein, calcium and oats, limit caffeine, and watch for foods that upset your baby.",
    daily_limits: { caffeine_mg: 200, sugar_g: 30 },
    avoid_tags: ["caffeine", "high_sugar"],
    prefer_tags: ["high_protein", "contains_lactose", "whole_grain"],
  },
};

/**
 * Evaluate one food against a user profile's conditions.
 * @param {FoodItem} food
 * @param {UserProfile} profile
 * @returns {{allowed:boolean, warnings:Array<{condition:string, severity:"info"|"caution"|"danger",
 *   message_ar:string, message_en:string}>}}
 */
export function evaluateFoodForProfile(food, profile) {
  const tags = new Set(food.tags || []);
  const warnings = [];
  for (const key of profile.conditions || []) {
    const cond = CHRONIC_CONDITIONS[key];
    if (!cond) continue;

    // Hard exclusions (e.g. gluten for celiac)
    const hardAvoid = key === "celiac" ? ["contains_gluten"] : [];
    for (const t of hardAvoid) {
      if (tags.has(t)) {
        warnings.push({
          condition: key, severity: "danger",
          message_ar: `${cond.emoji} ${cond.name_ar}: هذا الصنف يحتوي على الغلوتين وهو ممنوع منعًا تامًا لمرضى السيلياك.`,
          message_en: `${cond.emoji} ${cond.name_en}: this item contains gluten and is strictly off-limits for celiac disease.`,
        });
      }
    }

    // Tag-based cautions (skip ones already raised as danger)
    for (const t of cond.avoid_tags) {
      if (!tags.has(t) || hardAvoid.includes(t)) continue;
      const msg = {
        high_sugar: ["غني بالسكر", "high in sugar"],
        refined_carb: ["كربوهيدرات مكررة", "refined carbs"],
        high_sodium: ["غني بالصوديوم", "high in sodium"],
        fried: ["مقلي", "fried"],
        processed: ["مصنّع", "processed"],
        contains_seafood: ["ثمار بحر قد ترفع حمض اليوريك", "seafood may raise uric acid"],
        caffeine: ["يحتوي كافيين", "contains caffeine"],
        high_protein: ["بروتين مرتفع", "high protein"],
        gout_caution: ["مصدر للبيورين", "purine source"],
        kidney_caution: ["قد يثقل الكلى", "may burden kidneys"],
        diabetic_caution: ["قد يرفع سكر الدم", "may spike blood sugar"],
        hypertension_caution: ["قد يرفع الضغط", "may raise blood pressure"],
      }[t] || [t, t];
      warnings.push({
        condition: key, severity: "caution",
        message_ar: `${cond.emoji} ${cond.name_ar}: انتبه — ${msg[0]}.`,
        message_en: `${cond.emoji} ${cond.name_en}: caution — ${msg[1]}.`,
      });
    }

    // Per-serving numeric checks vs daily limits
    const lim = cond.daily_limits || {};
    if (lim.sodium_mg && (food.sodium_mg || 0) > lim.sodium_mg * 0.4) {
      warnings.push({
        condition: key, severity: "caution",
        message_ar: `${cond.emoji} ${cond.name_ar}: حصة واحدة تغطي أكثر من 40٪ من حد الصوديوم اليومي (${lim.sodium_mg} ملغ).`,
        message_en: `${cond.emoji} ${cond.name_en}: one serving covers over 40% of your daily sodium limit (${lim.sodium_mg} mg).`,
      });
    }
    if (lim.sugar_g && (food.sugar_g || 0) > lim.sugar_g * 0.6) {
      warnings.push({
        condition: key, severity: "caution",
        message_ar: `${cond.emoji} ${cond.name_ar}: سكر هذه الحصة مرتفع مقارنة بحدك اليومي (${lim.sugar_g} غ).`,
        message_en: `${cond.emoji} ${cond.name_en}: this serving's sugar is high relative to your daily limit (${lim.sugar_g} g).`,
      });
    }
  }

  // Pregnancy/lactation flags from profile booleans
  const extra = [];
  if (profile.pregnant) extra.push("pregnancy");
  if (profile.lactating) extra.push("lactation");
  for (const key of extra) {
    const cond = CHRONIC_CONDITIONS[key];
    for (const t of cond.avoid_tags) {
      if (tags.has(t)) {
        warnings.push({
          condition: key, severity: key === "pregnancy" ? "danger" : "caution",
          message_ar: `${cond.emoji} ${cond.name_ar}: يُنصح بتجنب هذا الصنف في هذه الفترة.`,
          message_en: `${cond.emoji} ${cond.name_en}: avoiding this item is advised during this period.`,
        });
      }
    }
  }

  const allowed = !warnings.some((w) => w.severity === "danger");
  return { allowed, warnings };
}

/**
 * Full daily targets for a profile: calories, macros, water, BMI, and a
 * per-meal calorie split (breakfast 25%, lunch 35%, dinner 30%, snacks 10%).
 * @param {UserProfile} profile
 * @returns {Object}
 */
export function suggestDailyTargets(profile) {
  const target = calculateTargetCalories(profile);
  const macros = macroSplit(target.calories, profile.goal || "maintain", profile.conditions || []);
  const water = calculateWaterGoal(profile);
  const bmi = calculateBMI(profile.weight_kg, profile.height_cm);
  const ideal = calculateIdealWeight(profile.gender, profile.height_cm);
  const cal = target.calories;
  const mealSplit = {
    breakfast_kcal: Math.round(cal * 0.25),
    lunch_kcal: Math.round(cal * 0.35),
    dinner_kcal: Math.round(cal * 0.30),
    snacks_kcal: Math.round(cal * 0.10),
  };
  return {
    bmr: calculateBMR(profile),
    tdee: calculateTDEE(profile),
    target_calories: cal,
    deficit: target.deficit,
    requires_medical_supervision: target.requires_medical_supervision,
    note_ar: target.note_ar,
    note_en: target.note_en,
    macros,
    water,
    bmi,
    ideal_weight: ideal,
    meal_split: mealSplit,
    meal_split_note_ar: "توزيع مقترح: فطور 25٪، غداء 35٪، عشاء 30٪، سناكات 10٪.",
    meal_split_note_en: "Suggested split: breakfast 25%, lunch 35%, dinner 30%, snacks 10%.",
  };
}
