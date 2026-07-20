# -*- coding: utf-8 -*-
"""
build_food_db.py — iwasfat bilingual (Arabic/English) food database generator.

Generates src/data/food_db.json deterministically from a curated base of real
Arab-region and international foods, expanded with honest variants (portion
sizes, cooking methods, with/without additions).

IMPORTANT HONESTY NOTE: macro values are dietitian-estimated reference values
(per typical serving), compiled from common nutrition-table knowledge. They are
guidance estimates pending lab-verified sources, NOT medical advice. Every item
is tagged source_quality accordingly ("reference" for plain single ingredients
that closely match standard tables, "estimated" for composite dishes).

Run:  python scripts/build_food_db.py
"""
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "food_db.json"

# ---------------------------------------------------------------------------
# Controlled vocabularies (must stay in sync with FoodItem.jsonc + engine.js)
# ---------------------------------------------------------------------------
CATEGORIES = [
    "bread_grain", "rice_main", "meat", "poultry", "fish_seafood", "legume",
    "vegetable", "salad", "soup", "fruit", "dairy", "egg_breakfast",
    "nuts_seeds", "oil_fat", "sweets", "beverage", "fast_food", "condiment",
    "packaged_snack",
]

REGIONS = ["gulf", "levant", "egypt", "iraq", "yemen", "north_africa",
           "maghreb", "international"]

TAG_VOCAB = {
    "high_sodium", "high_sugar", "fried", "refined_carb", "whole_grain",
    "high_fiber", "high_protein", "contains_gluten", "contains_lactose",
    "contains_nuts", "contains_egg", "contains_seafood", "diabetic_caution",
    "hypertension_caution", "kidney_caution", "gout_caution", "heart_healthy",
    "diabetic_friendly", "low_calorie", "caffeine", "processed",
}

ALL_ARAB = ["gulf", "levant", "egypt", "iraq", "yemen", "north_africa", "maghreb"]
INTL = ["international"]

# Portion variants applied to most foods (factor scales grams + all macros).
DEFAULT_SIZES = [
    ("نصف حصة", "half portion", 0.5),
    ("حصة صغيرة", "small portion", 0.75),
    ("حصة كبيرة", "large portion", 1.4),
    ("حصة مزدوجة", "double portion", 2.0),
]
DRINK_SIZES = [
    ("كوب صغير", "small cup", 0.7),
    ("كوب كبير", "large cup", 1.5),
]

_foods = []
_ids = set()


def _slug(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return text or "item"


def _auto_tags(p, c, f, fiber, sugar, sodium, kcal, grams, tags):
    """Derive metabolic tags from per-serving macros; merge with manual tags."""
    t = set(tags)
    if sodium >= 600:
        t.add("high_sodium")
        t.add("hypertension_caution")
    elif sodium >= 380:
        t.add("hypertension_caution")
    if sugar >= 20:
        t.add("high_sugar")
        t.add("diabetic_caution")
    elif sugar >= 12:
        t.add("diabetic_caution")
    if fiber >= 5:
        t.add("high_fiber")
    if p >= 20:
        t.add("high_protein")
    if p >= 35:
        t.add("kidney_caution")
    if kcal <= 100 and grams >= 80 and "high_sugar" not in t:
        t.add("low_calorie")
    if "refined_carb" in t and c >= 40:
        t.add("diabetic_caution")
    if "processed" in t and sodium >= 300:
        t.add("hypertension_caution")
    return sorted(t)


def add(name_ar, name_en, cat, subcat, regions, srv_ar, srv_en, grams,
        p, c, f, fiber=0.0, sugar=0.0, sodium=0, tags=(), quality="estimated",
        sizes="default"):
    """Register one curated base food. Macros are per serving; calories are
    derived from macros (4/4/9) so entries are internally consistent by
    construction."""
    assert cat in CATEGORIES, cat
    for r in regions:
        assert r in REGIONS, r
    p, c, f = round(p, 1), round(c, 1), round(f, 1)
    fiber, sugar = round(fiber, 1), round(sugar, 1)
    sodium = int(round(sodium))
    kcal = int(round(4 * p + 4 * c + 9 * f))
    if sizes == "default":
        sizes = DEFAULT_SIZES
    elif sizes == "drink":
        sizes = DRINK_SIZES
    item = {
        "name_ar": name_ar, "name_en": name_en, "category": cat,
        "subcategory": subcat, "region": list(regions),
        "serving_desc_ar": srv_ar, "serving_desc_en": srv_en,
        "portion_grams": int(round(grams)),
        "calories": kcal, "protein_g": p, "carbs_g": c, "fat_g": f,
        "fiber_g": fiber, "sugar_g": sugar, "sodium_mg": sodium,
        "tags": _auto_tags(p, c, f, fiber, sugar, sodium, kcal, grams, tags),
        "source_quality": quality,
        "_sizes": sizes,
    }
    _foods.append(item)
    return item


def add100(name_ar, name_en, cat, subcat, regions, srv_ar, srv_en, grams,
           p100, c100, f100, fib100=0.0, sug100=0.0, na100=0.0, tags=(),
           quality="reference", sizes="default"):
    """Register a food from per-100g nutrition-table values."""
    k = grams / 100.0
    return add(name_ar, name_en, cat, subcat, regions, srv_ar, srv_en, grams,
               p100 * k, c100 * k, f100 * k, fiber=fib100 * k,
               sugar=sug100 * k, sodium=na100 * k, tags=tags,
               quality=quality, sizes=sizes)


def variant(base, suffix_ar, suffix_en, scale=1.0, dp=0.0, dc=0.0, df=0.0,
            dfiber=0.0, dsugar=0.0, dsodium=0.0, add_tags=(), drop_tags=(),
            srv_ar=None, srv_en=None):
    """Create an honest variant of a base item: scale by portion factor and/or
    apply macro deltas (e.g. frying adds absorbed fat, sweetening adds sugar)."""
    g = base["portion_grams"] * scale
    p = max(0.0, round(base["protein_g"] * scale + dp, 1))
    c = max(0.0, round(base["carbs_g"] * scale + dc, 1))
    f = max(0.0, round(base["fat_g"] * scale + df, 1))
    fib = max(0.0, round(base["fiber_g"] * scale + dfiber, 1))
    sug = max(0.0, round(base["sugar_g"] * scale + dsugar, 1))
    na = max(0, int(round(base["sodium_mg"] * scale + dsodium)))
    kcal = int(round(4 * p + 4 * c + 9 * f))
    tags = sorted((set(base["tags"]) | set(add_tags)) - set(drop_tags))
    tags = _auto_tags(p, c, f, fib, sug, na, kcal, g, tags)
    return {
        "name_ar": f'{base["name_ar"]} — {suffix_ar}',
        "name_en": f'{base["name_en"]} — {suffix_en}',
        "category": base["category"], "subcategory": base["subcategory"],
        "region": list(base["region"]),
        "serving_desc_ar": srv_ar or base["serving_desc_ar"],
        "serving_desc_en": srv_en or base["serving_desc_en"],
        "portion_grams": int(round(g)),
        "calories": kcal, "protein_g": p, "carbs_g": c, "fat_g": f,
        "fiber_g": fib, "sugar_g": sug, "sodium_mg": na,
        "tags": tags, "source_quality": "estimated",
        "_sizes": [],
    }


# ===========================================================================
# 1) BREADS & GRAINS — خبز وحبوب
# ===========================================================================
add("خبز تميس", "Tamees Bread", "bread_grain", "breads", ["gulf"], "رغيف واحد", "1 loaf", 90, 7, 48, 1.5, fiber=2, sugar=1, sodium=380, tags=["refined_carb", "contains_gluten"])
add("خبز صامولي", "Samoon Bread", "bread_grain", "breads", ["iraq", "gulf"], "رغيف واحد", "1 loaf", 80, 6.5, 44, 1.2, fiber=1.5, sugar=1, sodium=350, tags=["refined_carb", "contains_gluten"])
add("خبز لبناني (عربي)", "Lebanese Pita Bread", "bread_grain", "breads", ["levant", "gulf"], "رغيف واحد", "1 loaf", 60, 5, 33, 0.8, fiber=1.2, sugar=0.8, sodium=300, tags=["refined_carb", "contains_gluten"])
add("خبز عربي أسمر", "Whole Wheat Pita Bread", "bread_grain", "breads", ALL_ARAB, "رغيف واحد", "1 loaf", 60, 5.5, 30, 1.2, fiber=4, sugar=1, sodium=290, tags=["whole_grain", "contains_gluten"], quality="reference")
add("خبز تنور", "Tannour Bread", "bread_grain", "breads", ["iraq", "gulf"], "قطعة وسط", "1 medium piece", 100, 8, 55, 1.5, fiber=2, sugar=1, sodium=320, tags=["refined_carb", "contains_gluten"])
add("خبز صاج", "Saj Bread", "bread_grain", "breads", ["levant"], "رغيف واحد", "1 loaf", 70, 5, 40, 1.2, fiber=1.5, sugar=0.5, sodium=260, tags=["refined_carb", "contains_gluten"])
add("خبز رقاق إماراتي", "Rigag Bread", "bread_grain", "breads", ["gulf"], "رقاقة واحدة", "1 sheet", 50, 4, 28, 1.5, fiber=1, sugar=0.5, sodium=180, tags=["refined_carb", "contains_gluten"])
add("خبز ملوح", "Malawah Bread", "bread_grain", "breads", ["yemen"], "قطعة واحدة", "1 piece", 80, 4.5, 32, 9, fiber=1, sugar=0.5, sodium=220, tags=["refined_carb", "contains_gluten"])
add("خبز لحوح", "Lahoh Bread", "bread_grain", "breads", ["yemen"], "قرص واحد", "1 disc", 100, 6, 45, 1.5, fiber=2, sugar=1, sodium=240, tags=["contains_gluten"])
add("عيش بلدي مصري", "Egyptian Baladi Bread", "bread_grain", "breads", ["egypt"], "رغيف واحد", "1 loaf", 120, 9, 62, 1.8, fiber=3.5, sugar=1, sodium=420, tags=["whole_grain", "contains_gluten"], quality="reference")
add("عيش فينو", "Fino Bread Roll", "bread_grain", "breads", ["egypt"], "رغيف واحد", "1 roll", 70, 6, 40, 1.5, fiber=1.5, sugar=2, sodium=330, tags=["refined_carb", "contains_gluten"])
add("عيش شامي", "Shami Bread", "bread_grain", "breads", ["egypt", "levant"], "رغيف واحد", "1 loaf", 60, 5, 33, 0.9, fiber=1.2, sugar=0.8, sodium=300, tags=["refined_carb", "contains_gluten"])
add("خبز بربري", "Barbari Bread", "bread_grain", "breads", INTL, "قطعة وسط", "1 medium piece", 100, 8, 55, 1.8, fiber=2, sugar=1.5, sodium=380, tags=["refined_carb", "contains_gluten"])
add("خبز نان", "Naan Bread", "bread_grain", "breads", INTL, "قطعة واحدة", "1 piece", 100, 8.5, 50, 3.5, fiber=2, sugar=2, sodium=420, tags=["refined_carb", "contains_gluten"])
add("خبز براثا", "Paratha", "bread_grain", "breads", INTL, "قطعة واحدة", "1 piece", 80, 5, 38, 8, fiber=1.5, sugar=1, sodium=350, tags=["refined_carb", "contains_gluten"])
add("خبز شاباتي", "Chapati", "bread_grain", "breads", INTL, "قطعة واحدة", "1 piece", 60, 5, 32, 2, fiber=3, sugar=0.5, sodium=200, tags=["whole_grain", "contains_gluten"])
add("شريحة خبز أبيض", "White Bread Slice", "bread_grain", "breads", INTL, "شريحة واحدة", "1 slice", 30, 2.4, 15, 0.8, fiber=0.7, sugar=1.5, sodium=130, tags=["refined_carb", "contains_gluten", "processed"], quality="reference")
add("شريحة خبز بر (أسمر)", "Whole Wheat Bread Slice", "bread_grain", "breads", INTL, "شريحة واحدة", "1 slice", 30, 2.6, 13.5, 0.9, fiber=2, sugar=1.5, sodium=140, tags=["whole_grain", "contains_gluten"], quality="reference")
add("توست أبيض", "White Toast", "bread_grain", "breads", INTL, "شريحتان", "2 slices", 60, 4.8, 30, 1.6, fiber=1.4, sugar=3, sodium=260, tags=["refined_carb", "contains_gluten", "processed"])
add("خبز الجاودار", "Rye Bread", "bread_grain", "breads", INTL, "شريحة واحدة", "1 slice", 32, 2.7, 15, 0.9, fiber=1.9, sugar=1.2, sodium=170, tags=["contains_gluten"], quality="reference")
add("خبز همبرغر", "Burger Bun", "bread_grain", "breads", INTL, "قطعة واحدة", "1 bun", 55, 5, 28, 2, fiber=1, sugar=4, sodium=250, tags=["refined_carb", "contains_gluten", "processed"])
add("كرواسون سادة", "Plain Croissant", "bread_grain", "breads", INTL, "قطعة واحدة", "1 piece", 60, 5, 26, 12, fiber=1.5, sugar=6, sodium=270, tags=["refined_carb", "contains_gluten", "contains_lactose", "contains_egg"])
add("كرواسون بالجبن", "Cheese Croissant", "bread_grain", "breads", INTL, "قطعة واحدة", "1 piece", 75, 8, 28, 15, fiber=1.5, sugar=6, sodium=420, tags=["refined_carb", "contains_gluten", "contains_lactose", "contains_egg"])
add("خبز بريوش", "Brioche", "bread_grain", "breads", INTL, "قطعة واحدة", "1 piece", 50, 5, 25, 8, fiber=0.8, sugar=5, sodium=200, tags=["refined_carb", "contains_gluten", "contains_lactose", "contains_egg"])
add("منقوشة زعتر", "Zaatar Manoushe", "bread_grain", "flatbreads", ["levant"], "قطعة واحدة", "1 piece", 120, 7, 55, 11, fiber=2, sugar=1, sodium=480, tags=["contains_gluten", "refined_carb"])
add("منقوشة جبن", "Cheese Manoushe", "bread_grain", "flatbreads", ["levant"], "قطعة واحدة", "1 piece", 130, 12, 55, 15, fiber=2, sugar=1.5, sodium=560, tags=["contains_gluten", "contains_lactose", "refined_carb"])
add("منقوشة لحم بعجين", "Lahm Bi Ajeen", "bread_grain", "flatbreads", ["levant"], "قطعة واحدة", "1 piece", 100, 10, 40, 10, fiber=1.5, sugar=1, sodium=450, tags=["contains_gluten"])
add("صفيحة بعلبكية", "Sfiha Baalbakia", "bread_grain", "flatbreads", ["levant"], "قطعتان", "2 pieces", 90, 8, 34, 8, fiber=1, sugar=1, sodium=400, tags=["contains_gluten"])
add("فطيرة سبانخ", "Spinach Fatayer", "bread_grain", "flatbreads", ["levant"], "قطعتان", "2 pieces", 90, 5, 40, 6, fiber=2, sugar=1, sodium=380, tags=["contains_gluten"])
add("فطيرة جبن", "Cheese Fatayer", "bread_grain", "flatbreads", ["levant"], "قطعتان", "2 pieces", 90, 7, 42, 9, fiber=1, sugar=1, sodium=430, tags=["contains_gluten", "contains_lactose"])
add("أرز أبيض مطبوخ", "Cooked White Rice", "bread_grain", "grains", ALL_ARAB + INTL, "كوب واحد", "1 cup", 158, 4.3, 44.5, 0.4, fiber=0.6, sugar=0, sodium=2, tags=["refined_carb"], quality="reference")
add("أرز بسمتي مطبوخ", "Cooked Basmati Rice", "bread_grain", "grains", ["gulf", "iraq"], "كوب واحد", "1 cup", 158, 4.5, 45, 0.6, fiber=0.7, sugar=0, sodium=2, tags=["refined_carb"], quality="reference")
add("أرز بني مطبوخ", "Cooked Brown Rice", "bread_grain", "grains", INTL, "كوب واحد", "1 cup", 158, 5, 45, 1.6, fiber=3.5, sugar=0, sodium=5, tags=["whole_grain"], quality="reference")
add("برغل مطبوخ", "Cooked Bulgur", "bread_grain", "grains", ["levant"], "كوب واحد", "1 cup", 182, 5.6, 33.8, 0.4, fiber=8.2, sugar=0, sodium=9, tags=["whole_grain", "high_fiber", "contains_gluten"], quality="reference")
add("فريكة مطبوخة", "Cooked Freekeh", "bread_grain", "grains", ["levant", "egypt"], "كوب واحد", "1 cup", 160, 6, 34, 1, fiber=6, sugar=0, sodium=5, tags=["whole_grain", "high_fiber", "contains_gluten"], quality="reference")
add("كسكس مطبوخ", "Cooked Couscous", "bread_grain", "grains", ["maghreb", "north_africa"], "كوب واحد", "1 cup", 157, 6, 36, 0.3, fiber=2.2, sugar=0, sodium=8, tags=["refined_carb", "contains_gluten"], quality="reference")
add("شعيرية مطبوخة", "Cooked Vermicelli", "bread_grain", "grains", ALL_ARAB, "كوب واحد", "1 cup", 100, 4, 25, 1.2, fiber=1, sugar=0, sodium=3, tags=["refined_carb", "contains_gluten"])
add("سباغيتي مطبوخة", "Cooked Spaghetti", "bread_grain", "grains", INTL, "كوب واحد", "1 cup", 140, 8, 43, 1.3, fiber=2.5, sugar=0.8, sodium=1, tags=["refined_carb", "contains_gluten"], quality="reference")
add("مكرونة قمح كامل مطبوخة", "Cooked Whole Wheat Pasta", "bread_grain", "grains", INTL, "كوب واحد", "1 cup", 140, 7.5, 37, 0.8, fiber=6.3, sugar=1, sodium=4, tags=["whole_grain", "high_fiber", "contains_gluten"], quality="reference")
add("دخن مطبوخ", "Cooked Millet", "bread_grain", "grains", ["yemen", "north_africa"], "كوب واحد", "1 cup", 174, 6.1, 41, 1.7, fiber=2.3, sugar=0, sodium=3, tags=["whole_grain"], quality="reference")
add("شوفان مطبوخ", "Cooked Oatmeal", "bread_grain", "grains", INTL, "كوب واحد", "1 cup", 234, 6, 27, 2.8, fiber=4, sugar=1, sodium=5, tags=["whole_grain", "heart_healthy"], quality="reference")
add("شوفان خام", "Raw Rolled Oats", "bread_grain", "grains", INTL, "نصف كوب", "1/2 cup", 40, 5, 27, 3.1, fiber=4.1, sugar=0.4, sodium=2, tags=["whole_grain", "heart_healthy"], quality="reference")
add("كينوا مطبوخة", "Cooked Quinoa", "bread_grain", "grains", INTL, "كوب واحد", "1 cup", 185, 8.1, 39.4, 3.6, fiber=5.2, sugar=1.6, sodium=13, tags=["whole_grain", "high_fiber", "high_protein"], quality="reference")
add("كورن فليكس", "Corn Flakes", "bread_grain", "breakfast_cereals", INTL, "كوب واحد", "1 cup", 30, 2, 24, 0.2, fiber=0.9, sugar=2.7, sodium=200, tags=["refined_carb", "processed"], quality="reference")
add("جرانولا", "Granola", "bread_grain", "breakfast_cereals", INTL, "نصف كوب", "1/2 cup", 60, 6, 32, 12, fiber=4.2, sugar=12, sodium=30, tags=["whole_grain", "contains_nuts"], quality="reference")
add("بسكويت دايجستف", "Digestive Biscuits", "bread_grain", "biscuits", INTL, "قطعتان", "2 pieces", 30, 2, 20, 4.2, fiber=1, sugar=5, sodium=110, tags=["processed", "refined_carb", "contains_gluten"])
add("بسكويت شاي سادة", "Plain Tea Biscuits", "bread_grain", "biscuits", ALL_ARAB + INTL, "4 قطع", "4 pieces", 32, 2, 22, 4, fiber=0.5, sugar=7, sodium=120, tags=["processed", "refined_carb", "contains_gluten"])
add("بسكويت الشوفان", "Oat Cookies", "bread_grain", "biscuits", INTL, "قطعتان", "2 pieces", 32, 2.5, 21, 5, fiber=1.5, sugar=8, sodium=90, tags=["processed", "contains_gluten"])
add("أرز بالشعيرية", "Rice with Vermicelli", "bread_grain", "grains", ["egypt", "levant"], "كوب واحد", "1 cup", 200, 5, 50, 4, fiber=1, sugar=0, sodium=300, tags=["refined_carb", "contains_gluten"])

# ===========================================================================
# 2) RICE & MAIN DISHES — أرز وأطباق رئيسية
# ===========================================================================
# --- Gulf & Yemen ---
add("كبسة دجاج", "Chicken Kabsa", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 400, 30, 85, 18, fiber=2, sugar=2, sodium=850, tags=["contains_gluten"])
add("كبسة لحم", "Meat Kabsa", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 420, 32, 85, 24, fiber=2, sugar=2, sodium=900, tags=["contains_gluten"])
add("كبسة سمك", "Fish Kabsa", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 400, 28, 85, 12, fiber=2, sugar=2, sodium=780, tags=["contains_seafood"])
add("مندي دجاج", "Chicken Mandi", "rice_main", "gulf_mains", ["gulf", "yemen"], "صحن وسط", "1 medium plate", 420, 32, 80, 20, fiber=1.5, sugar=1, sodium=820, tags=["contains_gluten"])
add("مندي لحم", "Meat Mandi", "rice_main", "gulf_mains", ["gulf", "yemen"], "صحن وسط", "1 medium plate", 430, 33, 80, 26, fiber=1.5, sugar=1, sodium=860)
add("مضغوط دجاج", "Chicken Madghout", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 400, 30, 82, 19, fiber=1.5, sugar=2, sodium=840)
add("برياني دجاج", "Chicken Biryani", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 400, 28, 80, 20, fiber=2, sugar=2, sodium=880)
add("برياني لحم", "Meat Biryani", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 410, 30, 80, 24, fiber=2, sugar=2, sodium=900)
add("مجبوس سمك", "Fish Majboos", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 400, 27, 84, 12, fiber=2, sugar=2, sodium=800, tags=["contains_seafood"])
add("مجبوس دجاج", "Chicken Majboos", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 400, 29, 84, 17, fiber=2, sugar=2, sodium=830)
add("جريش", "Jareesh (Crushed Wheat)", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium bowl", 300, 12, 55, 8, fiber=6, sugar=2, sodium=600, tags=["whole_grain", "contains_gluten"])
add("مرقوق", "Margoug", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 350, 18, 60, 10, fiber=4, sugar=3, sodium=750, tags=["contains_gluten"])
add("هريس", "Harees", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium bowl", 300, 20, 45, 14, fiber=3, sugar=1, sodium=550, tags=["contains_gluten"])
add("ثريد لحم", "Thareed with Meat", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 380, 24, 55, 16, fiber=4, sugar=3, sodium=780, tags=["contains_gluten"])
add("سليق", "Saleeg", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 350, 16, 60, 14, fiber=1, sugar=3, sodium=600, tags=["contains_lactose"])
add("حنيذ لحم", "Haneeth Meat with Rice", "rice_main", "gulf_mains", ["yemen"], "صحن وسط", "1 medium plate", 430, 34, 78, 24, fiber=1.5, sugar=1, sodium=840)
add("مظبي دجاج", "Chicken Muzbi", "rice_main", "gulf_mains", ["yemen"], "صحن وسط", "1 medium plate", 410, 31, 78, 19, fiber=1.5, sugar=1, sodium=820)
add("فحسة", "Fahsa", "rice_main", "gulf_mains", ["yemen"], "صحن وسط", "1 medium bowl", 300, 26, 12, 20, fiber=1, sugar=1, sodium=900, tags=["high_sodium"])
add("سلتة", "Saltah", "rice_main", "gulf_mains", ["yemen"], "صحن وسط", "1 medium bowl", 350, 20, 30, 16, fiber=4, sugar=3, sodium=820)
add("شفوت", "Shafout", "rice_main", "gulf_mains", ["yemen"], "صحن وسط", "1 medium bowl", 300, 10, 40, 8, fiber=2, sugar=4, sodium=550, tags=["contains_lactose", "contains_gluten"])
add("عقدة لحم", "Aqda with Meat", "rice_main", "gulf_mains", ["yemen"], "صحن وسط", "1 medium bowl", 320, 22, 40, 14, fiber=2, sugar=2, sodium=700)
add("مطازز لحم", "Mataziz with Meat", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 350, 20, 58, 12, fiber=3, sugar=3, sodium=720, tags=["contains_gluten"])
add("قرصان", "Qursan", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 350, 18, 58, 12, fiber=3, sugar=3, sodium=720, tags=["contains_gluten"])
add("كبسة روبيان", "Shrimp Kabsa", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 400, 26, 85, 12, fiber=2, sugar=2, sodium=860, tags=["contains_seafood"])
# --- Levant ---
add("منسف أردني", "Jordanian Mansaf", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 450, 35, 75, 28, fiber=1.5, sugar=2, sodium=950, tags=["contains_lactose"])
add("مقلوبة دجاج", "Chicken Maqluba", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 400, 28, 78, 18, fiber=3, sugar=3, sodium=780, tags=["fried"])
add("مقلوبة لحم", "Meat Maqluba", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 420, 30, 78, 22, fiber=3, sugar=3, sodium=800, tags=["fried"])
add("مسخن", "Musakhan", "rice_main", "levant_mains", ["levant"], "رغيف مع دجاج", "1 loaf with chicken", 380, 32, 60, 24, fiber=2, sugar=3, sodium=850, tags=["contains_gluten"])
add("فريكة بالدجاج", "Freekeh with Chicken", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 380, 30, 60, 12, fiber=6, sugar=2, sodium=700, tags=["whole_grain", "contains_gluten"])
add("مجدرة", "Mujadara", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 350, 14, 65, 10, fiber=8, sugar=2, sodium=550, tags=["high_fiber"])
add("مفتول فلسطيني", "Palestinian Maftoul", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 380, 24, 68, 14, fiber=5, sugar=2, sodium=720, tags=["contains_gluten"])
add("يالنجي (ورق عنب بزيت)", "Yalanji (Stuffed Vine Leaves)", "rice_main", "levant_mains", ["levant"], "8 أصابع", "8 rolls", 240, 4, 48, 12, fiber=4, sugar=3, sodium=800, tags=["heart_healthy"])
add("ورق عنب باللحم", "Vine Leaves with Meat", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 350, 20, 45, 16, fiber=4, sugar=3, sodium=850)
add("محاشي كوسا", "Stuffed Zucchini (Kousa Mahshi)", "rice_main", "levant_mains", ["levant", "egypt"], "6 قطع", "6 pieces", 300, 12, 45, 10, fiber=3, sugar=3, sodium=700)
add("محاشي مشكل", "Mixed Stuffed Vegetables", "rice_main", "levant_mains", ["levant", "egypt"], "صحن وسط", "1 medium plate", 350, 14, 50, 12, fiber=4, sugar=4, sodium=750)
add("شيش برك", "Shish Barak", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium bowl", 350, 18, 48, 14, fiber=2, sugar=4, sodium=780, tags=["contains_gluten", "contains_lactose"])
add("كبة لبنية", "Kibbeh Labanieh", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium bowl", 350, 22, 35, 18, fiber=2, sugar=4, sodium=750, tags=["contains_lactose", "contains_gluten"])
add("كبة مقلية", "Fried Kibbeh", "rice_main", "levant_mains", ["levant", "iraq"], "3 قطع", "3 pieces", 150, 12, 24, 16, fiber=1.5, sugar=1, sodium=550, tags=["fried", "contains_gluten"])
add("كبة مشوية", "Grilled Kibbeh", "rice_main", "levant_mains", ["levant"], "3 قطع", "3 pieces", 150, 13, 24, 10, fiber=1.5, sugar=1, sodium=520, tags=["contains_gluten"])
add("ملوخية بالدجاج", "Molokhia with Chicken", "rice_main", "levant_mains", ["levant", "egypt"], "صحن مع ربع دجاجة", "bowl with quarter chicken", 400, 30, 18, 14, fiber=5, sugar=2, sodium=780, tags=["high_fiber"])
add("بامية باللحم", "Okra Stew with Meat (Bamia)", "rice_main", "levant_mains", ALL_ARAB, "صحن وسط", "1 medium bowl", 320, 20, 20, 14, fiber=5, sugar=5, sodium=700)
add("فاصولياء بزيت", "Green Beans in Oil (Loubieh Bi Zeit)", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium bowl", 280, 5, 25, 12, fiber=7, sugar=6, sodium=450, tags=["high_fiber", "heart_healthy"])
add("فاصولياء بيضاء باللحم", "White Bean Stew with Meat (Fasolia)", "rice_main", "levant_mains", ["levant", "egypt"], "صحن وسط", "1 medium bowl", 320, 18, 35, 10, fiber=9, sugar=4, sodium=650, tags=["high_fiber"])
add("صيادية سمك", "Sayadieh (Fish with Rice)", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 420, 30, 75, 14, fiber=2, sugar=2, sodium=800, tags=["contains_seafood"])
add("فتة حمص", "Fattet Hummus", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium bowl", 350, 14, 45, 16, fiber=6, sugar=3, sodium=700, tags=["contains_lactose", "contains_gluten"])
add("مسبحة", "Msabbaha", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 280, 10, 30, 14, fiber=6, sugar=2, sodium=550)
# --- Egypt ---
add("كشري", "Koshari", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium plate", 400, 15, 90, 12, fiber=10, sugar=5, sodium=750, tags=["high_fiber", "contains_gluten"])
add("فول مدمس بالزيت", "Foul Medames with Oil", "rice_main", "egypt_mains", ["egypt", "levant"], "صحن وسط", "1 medium bowl", 250, 13, 33, 10, fiber=12, sugar=2, sodium=600, tags=["high_fiber", "heart_healthy"])
add("طعمية (فلافل مصرية)", "Taameya (Egyptian Falafel)", "rice_main", "egypt_mains", ["egypt"], "4 قطع", "4 pieces", 160, 8, 28, 12, fiber=7, sugar=1, sodium=480, tags=["fried", "high_fiber"])
add("مولوخية بالأرانب", "Molokhia with Rabbit", "rice_main", "egypt_mains", ["egypt"], "صحن مع قطعة أرنب", "bowl with rabbit piece", 400, 32, 16, 12, fiber=5, sugar=2, sodium=760, tags=["high_fiber"])
add("محشي كرنب", "Stuffed Cabbage (Mahshi Koronb)", "rice_main", "egypt_mains", ["egypt"], "8 أصابع", "8 rolls", 300, 8, 48, 8, fiber=5, sugar=4, sodium=700)
add("رقاق باللحمة المفرومة", "Roqaq with Minced Meat", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium plate", 350, 20, 40, 18, fiber=2, sugar=2, sodium=800, tags=["contains_gluten", "contains_lactose"])
add("حمام محشي", "Stuffed Pigeon (Hamam Mahshi)", "rice_main", "egypt_mains", ["egypt"], "حمامة واحدة", "1 pigeon", 350, 30, 45, 18, fiber=3, sugar=1, sodium=750, tags=["contains_gluten"])
add("ممبار محشي", "Stuffed Mombar", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium plate", 300, 12, 35, 20, fiber=2, sugar=1, sodium=900, tags=["fried", "processed", "high_sodium"])
add("فتة باللحمة", "Fattah with Meat", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium plate", 420, 28, 65, 18, fiber=3, sugar=3, sodium=850, tags=["contains_gluten"])
add("كشري الإسكندراني بالكبدة", "Alexandrian Koshari with Liver", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium plate", 420, 24, 85, 14, fiber=9, sugar=5, sodium=800, tags=["gout_caution", "contains_gluten"])
add("مكرونة بالبشاميل", "Macarona Bechamel", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium plate", 350, 18, 50, 18, fiber=2, sugar=4, sodium=700, tags=["contains_gluten", "contains_lactose"])
# --- Iraq ---
add("قوزي لحم", "Quzi with Meat", "rice_main", "iraq_mains", ["iraq"], "صحن وسط", "1 medium plate", 430, 32, 80, 22, fiber=2, sugar=3, sodium=880)
add("تمن باقلاء", "Timman Bagilla", "rice_main", "iraq_mains", ["iraq"], "صحن وسط", "1 medium plate", 380, 16, 72, 10, fiber=6, sugar=2, sodium=650)
add("دولمة عراقية", "Iraqi Dolma", "rice_main", "iraq_mains", ["iraq"], "صحن وسط", "1 medium plate", 350, 16, 45, 16, fiber=4, sugar=4, sodium=800)
add("كبة حامض", "Kubbat Hamudh", "rice_main", "iraq_mains", ["iraq"], "صحن وسط", "1 medium bowl", 350, 18, 40, 12, fiber=2, sugar=3, sodium=800)
add("عروق لحم", "Iraqi Uroog (Meat Patties)", "rice_main", "iraq_mains", ["iraq"], "3 قطع", "3 pieces", 180, 15, 18, 14, fiber=1, sugar=1, sodium=600, tags=["fried"])
add("مسقوف (سمك مشوي عراقي)", "Masgouf (Iraqi Grilled Fish)", "rice_main", "iraq_mains", ["iraq"], "صحن وسط", "1 medium plate", 400, 38, 8, 18, fiber=1, sugar=1, sodium=600, tags=["contains_seafood", "high_protein", "heart_healthy"])
add("ثريد عراقي", "Iraqi Thareed", "rice_main", "iraq_mains", ["iraq"], "صحن وسط", "1 medium plate", 380, 22, 55, 14, fiber=4, sugar=3, sodium=760, tags=["contains_gluten"])
# --- Maghreb & North Africa ---
add("كسكس بالخضار ولحم الضأن", "Couscous with Vegetables and Lamb", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium plate", 450, 28, 80, 16, fiber=7, sugar=6, sodium=780, tags=["contains_gluten"])
add("كسكس بالدجاج", "Couscous with Chicken", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium plate", 430, 28, 80, 12, fiber=7, sugar=6, sodium=750, tags=["contains_gluten"])
add("طاجين لحم بالبرقوق", "Lamb Tagine with Prunes", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium bowl", 350, 28, 30, 20, fiber=4, sugar=18, sodium=700)
add("طاجين دجاج بالزيتون والليمون", "Chicken Tagine with Olives and Lemon", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium bowl", 350, 30, 12, 18, fiber=3, sugar=3, sodium=850)
add("بسطيلة بالدجاج", "Chicken Bastilla", "rice_main", "maghreb_mains", ["maghreb"], "قطعة وسط", "1 medium piece", 250, 18, 35, 18, fiber=2, sugar=8, sodium=550, tags=["contains_gluten", "contains_nuts", "contains_egg"])
add("حريرة مغربية", "Harira Soup (Meal Portion)", "rice_main", "maghreb_mains", ["maghreb"], "صحن كبير", "1 large bowl", 400, 14, 55, 8, fiber=8, sugar=5, sodium=850, tags=["high_fiber"])
add("رفيسة", "Rfissa", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium plate", 400, 26, 60, 16, fiber=3, sugar=3, sodium=800, tags=["contains_gluten"])
add("شخشوخة", "Chakhchoukha", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium plate", 400, 22, 62, 14, fiber=4, sugar=4, sodium=820, tags=["contains_gluten"])
add("بريك بالبيض والتونة", "Brik with Egg and Tuna", "rice_main", "maghreb_mains", ["maghreb"], "قطعتان", "2 pieces", 180, 14, 30, 16, fiber=1, sugar=1, sodium=650, tags=["fried", "contains_egg", "contains_seafood", "contains_gluten"])
add("ملوخية تونسية باللحم", "Tunisian Mloukhia with Meat", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium bowl", 350, 26, 14, 22, fiber=4, sugar=2, sodium=800)
add("كفتة مغربية بالصلصة", "Moroccan Kefta in Sauce", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium bowl", 300, 22, 12, 20, fiber=2, sugar=4, sodium=750)
add("لبيا بالمرقاز", "Lbia Beans with Merguez", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium bowl", 350, 18, 40, 16, fiber=9, sugar=3, sodium=900, tags=["processed", "high_fiber"])
add("طواجن تونسية (تاجن)", "Tunisian Tajine (Egg Bake)", "rice_main", "maghreb_mains", ["maghreb"], "قطعة وسط", "1 medium piece", 200, 14, 10, 12, fiber=1, sugar=2, sodium=550, tags=["contains_egg"])
add("كسكسي بالحوت", "Couscous with Fish", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium plate", 430, 28, 78, 10, fiber=6, sugar=5, sodium=780, tags=["contains_seafood", "contains_gluten"])

# ===========================================================================
# 3) MEATS — لحوم
# ===========================================================================
add("لحم غنم مشوي", "Grilled Lamb", "meat", "grilled_meats", ALL_ARAB, "قطعة وسط (150 غ)", "1 medium piece (150g)", 150, 32, 0, 18, fiber=0, sugar=0, sodium=90, tags=["high_protein", "gout_caution"], quality="reference")
add("ريش غنم مشوية", "Grilled Lamb Chops", "meat", "grilled_meats", ALL_ARAB, "3 ريش", "3 chops", 150, 30, 0, 24, sodium=95, tags=["high_protein", "gout_caution"], quality="reference")
add("لحم بقري مشوي", "Grilled Beef", "meat", "grilled_meats", ALL_ARAB + INTL, "قطعة وسط (150 غ)", "1 medium piece (150g)", 150, 34, 0, 15, sodium=80, tags=["high_protein", "gout_caution"], quality="reference")
add("ستيك لحم بقري", "Beef Steak", "meat", "grilled_meats", INTL, "قطعة وسط (180 غ)", "1 medium steak (180g)", 180, 44, 0, 18, sodium=100, tags=["high_protein", "gout_caution"], quality="reference")
add("كباب لحم مشوي", "Grilled Meat Kebab", "meat", "grilled_meats", ALL_ARAB, "3 أسياخ", "3 skewers", 180, 30, 4, 22, sodium=550, tags=["high_protein", "gout_caution"])
add("كفتة مشوية", "Grilled Kofta", "meat", "grilled_meats", ALL_ARAB, "4 أصابع", "4 fingers", 160, 26, 6, 20, fiber=0.5, sodium=600, tags=["high_protein", "gout_caution"])
add("شيش كباب", "Shish Kebab", "meat", "grilled_meats", ALL_ARAB, "3 أسياخ", "3 skewers", 180, 34, 3, 16, sodium=500, tags=["high_protein"])
add("لحم مفروم قليل الدهن", "Lean Minced Beef", "meat", "minced_meats", ALL_ARAB + INTL, "100 غ مطبوخ", "100g cooked", 100, 26, 0, 10, sodium=75, tags=["high_protein"], quality="reference")
add("لحم مفروم عادي", "Regular Minced Beef", "meat", "minced_meats", ALL_ARAB + INTL, "100 غ مطبوخ", "100g cooked", 100, 24, 0, 17, sodium=75, tags=["high_protein"], quality="reference")
add("كبدة بقري مقلية", "Fried Beef Liver", "meat", "organ_meats", ALL_ARAB, "صحن وسط (120 غ)", "1 medium plate (120g)", 120, 24, 4, 12, fiber=0, sodium=480, tags=["gout_caution", "kidney_caution", "fried"], quality="reference")
add("كبدة إسكندراني", "Alexandrian Liver", "meat", "organ_meats", ["egypt"], "صحن وسط", "1 medium plate", 200, 28, 10, 14, sodium=650, tags=["gout_caution", "kidney_caution", "fried"])
add("كلاوي مقلية", "Fried Kidneys", "meat", "organ_meats", ALL_ARAB, "صحن وسط (100 غ)", "1 medium plate (100g)", 100, 20, 1, 8, sodium=350, tags=["gout_caution", "kidney_caution"], quality="reference")
add("قلوب دجاج مقلية", "Fried Chicken Hearts", "meat", "organ_meats", ALL_ARAB, "صحن وسط (100 غ)", "1 medium plate (100g)", 100, 22, 1, 9, sodium=300, tags=["gout_caution", "kidney_caution"], quality="reference")
add("موزات لحم مطبوخة", "Braised Lamb Shank", "meat", "stews", ["gulf"], "قطعة مع مرق (250 غ)", "1 piece with broth (250g)", 250, 38, 2, 22, sodium=600, tags=["high_protein"])
add("فخذ خروف مشوي", "Roast Leg of Lamb", "meat", "grilled_meats", ["gulf"], "قطعة وسط (180 غ)", "1 medium piece (180g)", 180, 40, 0, 22, sodium=110, tags=["high_protein", "gout_caution"])
add("كوارع مطبوخة", "Cooked Trotters (Kawareah)", "meat", "stews", ["egypt"], "صحن وسط مع مرق", "1 medium bowl with broth", 300, 22, 0, 18, sodium=700, tags=["kidney_caution"])
add("عكاوي مطبوخة", "Braised Oxtail", "meat", "stews", ALL_ARAB, "صحن وسط (200 غ)", "1 medium plate (200g)", 200, 30, 0, 24, sodium=550, tags=["high_protein"])
add("سجق لحم", "Beef Sujuk", "meat", "processed_meats", ["levant", "egypt"], "50 غ", "50g", 50, 10, 2, 14, sodium=650, tags=["processed", "high_sodium", "gout_caution"])
add("مرقاز مشوي", "Grilled Merguez", "meat", "processed_meats", ["maghreb"], "2 قطعة", "2 pieces", 100, 14, 2, 24, sodium=800, tags=["processed", "high_sodium"])
add("بسطرمة", "Bastirma", "meat", "processed_meats", ["egypt", "levant"], "5 شرائح (30 غ)", "5 slices (30g)", 30, 8, 1, 4, sodium=700, tags=["processed", "high_sodium"], quality="reference")
add("لانشون لحم", "Meat Luncheon", "meat", "processed_meats", ALL_ARAB, "3 شرائح (60 غ)", "3 slices (60g)", 60, 8, 2, 12, sodium=600, tags=["processed", "high_sodium"])
add("هوت دوغ (نقانق)", "Hot Dog Sausages", "meat", "processed_meats", INTL, "2 قطعة", "2 pieces", 100, 12, 2, 24, sodium=900, tags=["processed", "high_sodium"])
add("سلامي", "Salami", "meat", "processed_meats", INTL, "4 شرائح (40 غ)", "4 slices (40g)", 40, 9, 1, 14, sodium=750, tags=["processed", "high_sodium"])
add("لحم مقدد", "Qadid (Dried Salted Meat)", "meat", "processed_meats", ["maghreb"], "50 غ", "50g", 50, 15, 0, 10, sodium=1200, tags=["processed", "high_sodium"])
add("لحم ضأن مطبوخ بالمرق", "Lamb Stew Meat", "meat", "stews", ALL_ARAB, "صحن وسط (180 غ)", "1 medium plate (180g)", 180, 34, 3, 20, sodium=600, tags=["high_protein"])
add("شقف لحم بقري مطبوخ", "Braised Beef Cubes", "meat", "stews", ALL_ARAB, "صحن وسط (180 غ)", "1 medium plate (180g)", 180, 36, 2, 16, sodium=580, tags=["high_protein"])

# ===========================================================================
# 4) POULTRY — دواجن
# ===========================================================================
add("صدر دجاج مشوي (بالجلد)", "Grilled Chicken Breast (with Skin)", "poultry", "chicken", ALL_ARAB + INTL, "صدر وسط (150 غ)", "1 medium breast (150g)", 150, 34, 0, 7, sodium=90, tags=["high_protein", "heart_healthy"], quality="reference")
add("صدر دجاج مشوي (بدون جلد)", "Grilled Chicken Breast (Skinless)", "poultry", "chicken", ALL_ARAB + INTL, "صدر وسط (150 غ)", "1 medium breast (150g)", 150, 36, 0, 4, sodium=85, tags=["high_protein", "heart_healthy", "low_calorie"], quality="reference")
add("فخذ دجاج مشوي", "Grilled Chicken Thigh", "poultry", "chicken", ALL_ARAB + INTL, "فخذ وسط (130 غ)", "1 medium thigh (130g)", 130, 26, 0, 12, sodium=100, tags=["high_protein"], quality="reference")
add("أجنحة دجاج مشوية", "Grilled Chicken Wings", "poultry", "chicken", ALL_ARAB, "5 أجنحة", "5 wings", 150, 27, 0, 16, sodium=450, tags=["high_protein"])
add("دجاج مقلي (بروستد)", "Fried Chicken (Broasted)", "poultry", "chicken", ALL_ARAB, "قطعة وسط", "1 medium piece", 150, 26, 10, 20, fiber=0.5, sodium=600, tags=["fried", "processed"])
add("أصابع دجاج مقلية", "Chicken Strips", "poultry", "chicken", INTL, "4 أصابع", "4 strips", 120, 20, 12, 14, fiber=0.5, sodium=550, tags=["fried", "processed"])
add("شيش طاووق", "Shish Tawook", "poultry", "chicken", ["levant", "gulf"], "2 سيخ", "2 skewers", 180, 34, 4, 8, sodium=600, tags=["high_protein"])
add("دجاج محمر بالفرن", "Oven Roasted Chicken", "poultry", "chicken", ALL_ARAB, "ربع دجاجة", "1/4 chicken", 200, 40, 0, 16, sodium=500, tags=["high_protein"])
add("ديك رومي (حبش) مشوي", "Roast Turkey", "poultry", "turkey", INTL, "شريحتان (120 غ)", "2 slices (120g)", 120, 30, 0, 4, sodium=80, tags=["high_protein", "heart_healthy", "low_calorie"], quality="reference")
add("صدر ديك رومي مدخن", "Smoked Turkey Breast", "poultry", "turkey", INTL, "3 شرائح (60 غ)", "3 slices (60g)", 60, 12, 1, 1, sodium=600, tags=["processed", "high_sodium"], quality="reference")
add("بطة مشوية", "Roast Duck", "poultry", "duck", INTL, "قطعة وسط (150 غ)", "1 medium piece (150g)", 150, 24, 0, 26, sodium=120, tags=["gout_caution"], quality="reference")
add("كبد دجاج مقلي", "Fried Chicken Livers", "poultry", "organ", ALL_ARAB, "صحن وسط (100 غ)", "1 medium plate (100g)", 100, 22, 2, 8, sodium=350, tags=["gout_caution", "kidney_caution"], quality="reference")
add("قوانص دجاج مطبوخة", "Cooked Chicken Gizzards", "poultry", "organ", ALL_ARAB, "صحن وسط (100 غ)", "1 medium plate (100g)", 100, 26, 0, 4, sodium=300, tags=["gout_caution"], quality="reference")

# ===========================================================================
# 5) FISH & SEAFOOD — أسماك وثمار بحر
# ===========================================================================
add("هامور مشوي", "Grilled Hamour (Grouper)", "fish_seafood", "grilled_fish", ["gulf"], "قطعة وسط (180 غ)", "1 medium piece (180g)", 180, 38, 0, 5, sodium=120, tags=["contains_seafood", "high_protein", "heart_healthy"], quality="reference")
add("شعري مشوي", "Grilled Sheri (Emperor Fish)", "fish_seafood", "grilled_fish", ["gulf"], "سمكة وسط", "1 medium fish", 200, 40, 0, 6, sodium=130, tags=["contains_seafood", "high_protein", "heart_healthy"])
add("كنعد مشوي", "Grilled Kingfish", "fish_seafood", "grilled_fish", ["gulf"], "قطعة وسط (180 غ)", "1 medium piece (180g)", 180, 40, 0, 8, sodium=120, tags=["contains_seafood", "high_protein", "heart_healthy"])
add("صافي مقلي", "Fried Safi (Rabbitfish)", "fish_seafood", "fried_fish", ["gulf"], "سمكة وسط", "1 medium fish", 180, 30, 6, 14, sodium=400, tags=["contains_seafood", "fried"])
add("زبيدي مقلي", "Fried Zubaidi (Pomfret)", "fish_seafood", "fried_fish", ["gulf"], "سمكة وسط", "1 medium fish", 180, 30, 6, 16, sodium=380, tags=["contains_seafood", "fried"])
add("بلطي مقلي", "Fried Tilapia", "fish_seafood", "fried_fish", ["egypt"], "سمكة وسط", "1 medium fish", 200, 36, 6, 12, sodium=400, tags=["contains_seafood", "fried"])
add("بلطي مشوي", "Grilled Tilapia", "fish_seafood", "grilled_fish", ["egypt"], "سمكة وسط", "1 medium fish", 200, 38, 0, 5, sodium=120, tags=["contains_seafood", "high_protein", "heart_healthy"], quality="reference")
add("بوري مشوي", "Grilled Mullet", "fish_seafood", "grilled_fish", ["egypt"], "سمكة وسط", "1 medium fish", 200, 36, 0, 8, sodium=140, tags=["contains_seafood", "high_protein"])
add("سلمون مشوي", "Grilled Salmon", "fish_seafood", "grilled_fish", INTL, "قطعة وسط (150 غ)", "1 medium fillet (150g)", 150, 34, 0, 14, sodium=90, tags=["contains_seafood", "high_protein", "heart_healthy"], quality="reference")
add("ماكريل مشوي", "Grilled Mackerel", "fish_seafood", "grilled_fish", INTL, "قطعة وسط (150 غ)", "1 medium piece (150g)", 150, 30, 0, 18, sodium=120, tags=["contains_seafood", "high_protein", "heart_healthy", "gout_caution"], quality="reference")
add("تونة معلبة بالماء", "Canned Tuna in Water", "fish_seafood", "canned_fish", ALL_ARAB + INTL, "علبة صغيرة مصفاة (100 غ)", "1 small can drained (100g)", 100, 24, 0, 1, sodium=300, tags=["contains_seafood", "high_protein", "low_calorie", "processed"], quality="reference")
add("تونة معلبة بالزيت", "Canned Tuna in Oil", "fish_seafood", "canned_fish", ALL_ARAB + INTL, "علبة صغيرة مصفاة (100 غ)", "1 small can drained (100g)", 100, 26, 0, 8, sodium=320, tags=["contains_seafood", "high_protein", "processed"], quality="reference")
add("سردين معلب", "Canned Sardines", "fish_seafood", "canned_fish", ["maghreb", "north_africa"], "علبة (90 غ)", "1 can (90g)", 90, 20, 0, 10, sodium=400, tags=["contains_seafood", "high_protein", "gout_caution", "processed"], quality="reference")
add("فيليه سمك مشوي", "Grilled Fish Fillet", "fish_seafood", "grilled_fish", INTL, "قطعة وسط (150 غ)", "1 medium fillet (150g)", 150, 32, 0, 5, sodium=110, tags=["contains_seafood", "high_protein", "heart_healthy"], quality="reference")
add("فيليه سمك مقلي (بانيه)", "Breaded Fried Fish Fillet", "fish_seafood", "fried_fish", INTL, "قطعة وسط", "1 medium piece", 130, 18, 14, 14, fiber=0.5, sodium=450, tags=["contains_seafood", "fried", "contains_gluten"])
add("جمبري (روبيان) مشوي", "Grilled Shrimp", "fish_seafood", "shellfish", ALL_ARAB + INTL, "8 حبات وسط", "8 medium pieces", 120, 24, 1, 2, sodium=300, tags=["contains_seafood", "high_protein", "low_calorie", "gout_caution"], quality="reference")
add("جمبري مقلي", "Fried Shrimp", "fish_seafood", "shellfish", ALL_ARAB + INTL, "8 حبات وسط", "8 medium pieces", 140, 18, 12, 12, fiber=0.5, sodium=500, tags=["contains_seafood", "fried", "contains_gluten"])
add("كالماري مقلي", "Fried Calamari", "fish_seafood", "shellfish", INTL, "صحن وسط (150 غ)", "1 medium plate (150g)", 150, 20, 14, 14, fiber=0.5, sodium=550, tags=["contains_seafood", "fried", "contains_gluten"])
add("سلطعون مسلوق", "Boiled Crab", "fish_seafood", "shellfish", ALL_ARAB + INTL, "100 غ", "100g", 100, 20, 0, 2, sodium=350, tags=["contains_seafood", "high_protein", "gout_caution"], quality="reference")
add("محار", "Oysters", "fish_seafood", "shellfish", INTL, "6 حبات", "6 pieces", 90, 9, 5, 2, sodium=190, tags=["contains_seafood", "gout_caution", "low_calorie"], quality="reference")
add("بلح البحر", "Mussels", "fish_seafood", "shellfish", INTL, "صحن وسط (150 غ)", "1 medium plate (150g)", 150, 24, 6, 4, sodium=450, tags=["contains_seafood", "high_protein", "gout_caution"], quality="reference")
add("فسيخ (سمك مملح مخمر)", "Fesikh (Fermented Salted Fish)", "fish_seafood", "salted_fish", ["egypt"], "قطعة صغيرة (50 غ)", "1 small piece (50g)", 50, 12, 0, 4, sodium=2000, tags=["contains_seafood", "high_sodium", "processed", "kidney_caution"])
add("رنجة (سمك مملح)", "Renga (Salted Herring)", "fish_seafood", "salted_fish", ["egypt"], "قطعة وسط (80 غ)", "1 medium piece (80g)", 80, 16, 0, 8, sodium=2400, tags=["contains_seafood", "high_sodium", "processed", "kidney_caution"])
add("سالمون مدخن", "Smoked Salmon", "fish_seafood", "smoked_fish", INTL, "3 شرائح (60 غ)", "3 slices (60g)", 60, 12, 0, 5, sodium=700, tags=["contains_seafood", "high_sodium", "processed"], quality="reference")
add("أخطبوط مشوي", "Grilled Octopus", "fish_seafood", "shellfish", INTL, "صحن وسط (150 غ)", "1 medium plate (150g)", 150, 30, 4, 3, sodium=400, tags=["contains_seafood", "high_protein"], quality="reference")
add("حبار مشوي", "Grilled Squid", "fish_seafood", "shellfish", INTL, "صحن وسط (150 غ)", "1 medium plate (150g)", 150, 26, 5, 3, sodium=350, tags=["contains_seafood", "high_protein"], quality="reference")

# ===========================================================================
# 6) LEGUMES — بقوليات
# ===========================================================================
add("فول مدمس سادة", "Plain Fava Beans (Foul)", "legume", "cooked_legumes", ["egypt", "levant", "gulf"], "صحن وسط", "1 medium bowl", 200, 13, 33, 1.5, fiber=9, sugar=1, sodium=400, tags=["high_fiber", "heart_healthy"], quality="reference")
add("حمص مسلوق", "Boiled Chickpeas", "legume", "cooked_legumes", ALL_ARAB, "كوب واحد", "1 cup", 164, 15, 45, 4, fiber=12, sugar=8, sodium=6, tags=["high_fiber", "heart_healthy"], quality="reference")
add("عدس مطبوخ", "Cooked Lentils", "legume", "cooked_legumes", ALL_ARAB, "كوب واحد", "1 cup", 198, 18, 40, 0.8, fiber=16, sugar=3, sodium=4, tags=["high_fiber", "heart_healthy", "high_protein"], quality="reference")
add("فاصولياء حمراء مطبوخة", "Cooked Red Kidney Beans", "legume", "cooked_legumes", ALL_ARAB, "كوب واحد", "1 cup", 177, 15, 40, 0.5, fiber=13, sugar=1, sodium=2, tags=["high_fiber", "heart_healthy"], quality="reference")
add("فاصولياء بيضاء مطبوخة", "Cooked White Beans", "legume", "cooked_legumes", ALL_ARAB, "كوب واحد", "1 cup", 179, 17, 45, 0.6, fiber=11, sugar=1, sodium=4, tags=["high_fiber", "heart_healthy"], quality="reference")
add("لوبياء مطبوخة", "Cooked Black-Eyed Peas", "legume", "cooked_legumes", ["gulf", "egypt"], "كوب واحد", "1 cup", 171, 13, 35, 0.6, fiber=11, sugar=5, sodium=5, tags=["high_fiber"], quality="reference")
add("فول أخضر مطبوخ", "Cooked Green Fava Beans", "legume", "cooked_legumes", ["egypt", "levant"], "كوب واحد", "1 cup", 170, 13, 33, 0.6, fiber=9, sugar=3, sodium=10, tags=["high_fiber"], quality="reference")
add("بازلاء خضراء مطبوخة", "Cooked Green Peas", "legume", "cooked_legumes", ALL_ARAB, "كوب واحد", "1 cup", 160, 8, 25, 0.4, fiber=9, sugar=9, sodium=5, tags=["high_fiber"], quality="reference")
add("حمص بالطحينة", "Hummus with Tahini", "legume", "dips", ALL_ARAB, "4 ملاعق كبيرة", "4 tbsp", 100, 8, 14, 10, fiber=6, sugar=1, sodium=380, tags=["high_fiber", "heart_healthy"], quality="reference")
add("فلافل", "Falafel", "legume", "fried", ALL_ARAB, "4 قطع", "4 pieces", 120, 6, 20, 10, fiber=5, sugar=1, sodium=350, tags=["fried", "high_fiber"], quality="reference")
add("ترمس مسلوق", "Boiled Lupini Beans (Termos)", "legume", "snacks", ["egypt", "levant"], "كوب واحد", "1 cup", 166, 26, 16, 5, fiber=4, sugar=0, sodium=800, tags=["high_sodium", "high_protein"], quality="reference")
add("فول صحيح مسلوق", "Boiled Whole Fava Beans", "legume", "snacks", ["egypt", "levant"], "كوب واحد", "1 cup", 170, 12, 30, 1, fiber=9, sugar=1, sodium=500, tags=["high_fiber"], quality="reference")
add("دقة سودانية", "Sudanese Dakka (Fava Bean Dip)", "legume", "dips", ["north_africa"], "صحن صغير", "1 small plate", 150, 10, 25, 6, fiber=8, sugar=2, sodium=600, tags=["high_fiber"])
add("ماش مطبوخ", "Cooked Mung Beans", "legume", "cooked_legumes", INTL, "كوب واحد", "1 cup", 202, 14, 39, 0.8, fiber=15, sugar=4, sodium=4, tags=["high_fiber", "heart_healthy"], quality="reference")
add("فول الصويا مطبوخ", "Cooked Soybeans", "legume", "cooked_legumes", INTL, "كوب واحد", "1 cup", 172, 29, 17, 15, fiber=10, sugar=5, sodium=2, tags=["high_fiber", "high_protein", "heart_healthy"], quality="reference")

# ===========================================================================
# 7) VEGETABLES — خضروات (per-100g reference values, typical servings)
# ===========================================================================
VEG = [
    # name_ar, name_en, srv_ar, srv_en, grams, p, c, f, fiber, sugar, sodium
    ("طماطم", "Tomato", "حبة وسط", "1 medium", 123, 0.9, 3.9, 0.2, 1.2, 2.6, 5),
    ("خيار", "Cucumber", "حبة وسط", "1 medium", 150, 0.7, 3.6, 0.1, 0.5, 1.7, 2),
    ("خس", "Lettuce", "كوب مقطع", "1 cup chopped", 55, 1.4, 2.9, 0.2, 1.3, 0.8, 28),
    ("جرجير", "Arugula (Watercress)", "كوب واحد", "1 cup", 40, 2.6, 3.7, 0.7, 1.6, 2, 27),
    ("سبانخ طازجة", "Fresh Spinach", "كوب واحد", "1 cup", 30, 2.9, 3.6, 0.4, 2.2, 0.4, 79),
    ("بروكلي", "Broccoli", "كوب مقطع", "1 cup chopped", 91, 2.8, 6.6, 0.4, 2.6, 1.7, 33),
    ("قرنبيط", "Cauliflower", "كوب مقطع", "1 cup chopped", 107, 1.9, 5, 0.3, 2, 1.9, 30),
    ("جزر", "Carrot", "حبة وسط", "1 medium", 61, 0.9, 9.6, 0.2, 2.8, 4.7, 69),
    ("كوسا", "Zucchini", "حبة وسط", "1 medium", 196, 1.2, 3.1, 0.3, 1, 2.5, 8),
    ("باذنجان", "Eggplant", "كوب مكعبات", "1 cup cubes", 82, 1, 5.9, 0.2, 3, 3.5, 2),
    ("بامية", "Okra", "كوب شرائح", "1 cup sliced", 100, 1.9, 7.5, 0.2, 3.2, 1.5, 7),
    ("فاصوليا خضراء", "Green Beans", "كوب واحد", "1 cup", 100, 1.8, 7, 0.2, 2.7, 3.3, 6),
    ("ذرة حلوة", "Sweet Corn", "كوب واحد", "1 cup", 145, 5, 41, 2.2, 4.6, 9, 13),
    ("بطاطس مسلوقة", "Boiled Potato", "حبة وسط", "1 medium", 150, 3, 30, 0.1, 2.5, 1.5, 7),
    ("بطاطا حلوة مسلوقة", "Boiled Sweet Potato", "حبة وسط", "1 medium", 150, 2, 31, 0.2, 3.9, 10, 41),
    ("بصل", "Onion", "حبة وسط", "1 medium", 110, 1.1, 9.3, 0.1, 1.7, 4.2, 4),
    ("فلفل أخضر", "Green Bell Pepper", "حبة وسط", "1 medium", 119, 1, 4.6, 0.3, 1.7, 2.4, 3),
    ("فلفل أحمر", "Red Bell Pepper", "حبة وسط", "1 medium", 119, 1, 6, 0.3, 2.1, 4.2, 4),
    ("ملفوف (كرنب)", "Cabbage", "كوب مقطع", "1 cup chopped", 89, 1.3, 5.8, 0.1, 2.5, 3.2, 16),
    ("قرع عسلي", "Pumpkin", "كوب مكعبات", "1 cup cubes", 116, 1, 6.5, 0.1, 0.5, 2.8, 1),
    ("شمندر (بنجر)", "Beetroot", "حبة وسط", "1 medium", 82, 1.6, 9.6, 0.2, 2.8, 6.8, 78),
    ("لفت", "Turnip", "حبة وسط", "1 medium", 122, 0.9, 6.4, 0.1, 1.8, 3.8, 67),
    ("فجل", "Radish", "5 حبات", "5 pieces", 45, 0.7, 3.4, 0.1, 1.6, 1.9, 39),
    ("كراث", "Leek", "حبة وسط", "1 medium", 89, 1.5, 14.2, 0.3, 1.8, 3.9, 20),
    ("مشروم (فطر)", "Mushrooms", "كوب شرائح", "1 cup sliced", 70, 3.1, 3.3, 0.3, 1, 2, 5),
    ("هليون", "Asparagus", "5 أعواد", "5 spears", 75, 2.2, 3.9, 0.1, 2.1, 1.9, 2),
    ("كرنب بروكسل", "Brussels Sprouts", "كوب واحد", "1 cup", 88, 3.4, 8.9, 0.3, 3.8, 2.2, 25),
    ("كرفس", "Celery", "عودان", "2 stalks", 80, 0.7, 3, 0.2, 1.6, 1.3, 80),
    ("خرشوف", "Artichoke", "حبة وسط", "1 medium", 128, 3.3, 10.5, 0.4, 5.4, 1, 94),
    ("ملوخية ورق طازج", "Fresh Molokhia Leaves", "كوب مقطع", "1 cup chopped", 50, 2, 3, 0.2, 1.5, 0.5, 5),
    ("سلق", "Swiss Chard", "كوب مقطع", "1 cup chopped", 36, 1.8, 3.7, 0.2, 1.6, 1.1, 213),
    ("بقدونس", "Parsley", "ربطة صغيرة", "1 small bunch", 30, 3, 6.3, 0.8, 3.3, 0.9, 56),
    ("كزبرة خضراء", "Fresh Coriander", "ربطة صغيرة", "1 small bunch", 30, 2.1, 3.7, 0.5, 2.8, 0.9, 46),
    ("نعناع طازج", "Fresh Mint", "ربطة صغيرة", "1 small bunch", 30, 3.3, 8.4, 0.7, 6.8, 0, 31),
    ("زعتر أخضر", "Fresh Thyme", "ربطة صغيرة", "1 small bunch", 20, 5.6, 24.5, 1.7, 14, 0, 55),
]
for (ar, en, sa, se, g, p, c, f, fib, sug, na) in VEG:
    add100(ar, en, "vegetable", "fresh_vegetables", ALL_ARAB, sa, se, g, p, c, f,
           fib100=fib, sug100=sug, na100=na, tags=["heart_healthy", "low_calorie"])

# Cooked vegetable dishes (composite — estimated)
add("سبانخ مطبوخة بالثوم", "Sauteed Spinach with Garlic", "vegetable", "cooked_vegetables", ["levant", "egypt"], "صحن وسط", "1 medium bowl", 200, 4, 8, 6, fiber=5, sugar=1, sodium=350, tags=["high_fiber", "heart_healthy"])
add("بامية بزيت الزيتون", "Okra in Olive Oil", "vegetable", "cooked_vegetables", ["levant"], "صحن وسط", "1 medium bowl", 220, 3, 14, 8, fiber=6, sugar=5, sodium=300, tags=["high_fiber", "heart_healthy"])
add("مقلوبة خضار (بدون لحم)", "Vegetable Maqluba (No Meat)", "vegetable", "cooked_vegetables", ["levant"], "صحن وسط", "1 medium plate", 350, 8, 60, 12, fiber=5, sugar=5, sodium=550, tags=["fried"])
add("مسقعة باذنجان", "Eggplant Moussaka (Msaqqaa)", "vegetable", "cooked_vegetables", ["egypt", "levant"], "صحن وسط", "1 medium bowl", 280, 5, 20, 14, fiber=6, sugar=8, sodium=500, tags=["fried", "high_fiber"])
add("باذنجان مقلي", "Fried Eggplant", "vegetable", "cooked_vegetables", ALL_ARAB, "صحن وسط", "1 medium plate", 150, 2, 10, 14, fiber=4, sugar=4, sodium=250, tags=["fried"])
add("قرنبيط مقلي", "Fried Cauliflower", "vegetable", "cooked_vegetables", ALL_ARAB, "صحن وسط", "1 medium plate", 150, 4, 10, 12, fiber=4, sugar=3, sodium=280, tags=["fried"])
add("كوسا محشوة بالخضار", "Vegetarian Stuffed Zucchini", "vegetable", "cooked_vegetables", ["levant"], "5 قطع", "5 pieces", 300, 6, 40, 8, fiber=4, sugar=5, sodium=500)
add("خضار سوتيه مشكلة", "Mixed Sauteed Vegetables", "vegetable", "cooked_vegetables", INTL, "صحن وسط", "1 medium plate", 200, 4, 15, 7, fiber=6, sugar=6, sodium=300, tags=["high_fiber", "heart_healthy"])
add("بطاطس مهروسة (بوريه)", "Mashed Potatoes", "vegetable", "cooked_vegetables", INTL, "كوب واحد", "1 cup", 210, 4, 35, 9, fiber=3, sugar=3, sodium=350, tags=["contains_lactose"])
add("بطاطس مقلية منزلية", "Homemade Fried Potatoes", "vegetable", "cooked_vegetables", ALL_ARAB, "صحن وسط", "1 medium plate", 180, 4, 40, 15, fiber=4, sugar=1, sodium=300, tags=["fried"])
add("بطاطس بالفرن", "Oven Baked Potato Wedges", "vegetable", "cooked_vegetables", ALL_ARAB, "صحن وسط", "1 medium plate", 180, 4, 40, 6, fiber=4, sugar=1, sodium=280, tags=["heart_healthy"])
add("تقلية بصل", "Fried Onion Garnish", "vegetable", "cooked_vegetables", ["egypt"], "ملعقتان كبيرتان", "2 tbsp", 30, 0.5, 3, 5, fiber=0.5, sugar=1, sodium=60, tags=["fried"])
add("ذرة مسلوقة (كوز)", "Boiled Corn on the Cob", "vegetable", "cooked_vegetables", ["egypt", "levant"], "كوز وسط", "1 medium cob", 120, 4, 32, 2, fiber=4, sugar=7, sodium=15, tags=["whole_grain"], quality="reference")
add("شمندر مسلوق", "Boiled Beetroot", "vegetable", "cooked_vegetables", ALL_ARAB, "كوب شرائح", "1 cup sliced", 136, 2.2, 13, 0.2, fiber=3.8, sugar=9, sodium=106, tags=["heart_healthy"], quality="reference")
add("ورق دوالي مطبوخ", "Cooked Swiss Chard Rolls", "vegetable", "cooked_vegetables", ["levant"], "6 قطع", "6 pieces", 250, 5, 35, 8, fiber=4, sugar=3, sodium=600)
add("ملفوف محشو", "Stuffed Cabbage Rolls", "vegetable", "cooked_vegetables", ["levant", "egypt"], "6 أصابع", "6 rolls", 300, 7, 45, 8, fiber=5, sugar=4, sodium=650)

# ===========================================================================
# 8) SALADS — سلطات
# ===========================================================================
add("تبولة", "Tabbouleh", "salad", "arab_salads", ["levant"], "صحن وسط", "1 medium plate", 150, 3, 20, 8, fiber=5, sugar=3, sodium=300, tags=["high_fiber", "heart_healthy", "contains_gluten"])
add("فتوش", "Fattoush", "salad", "arab_salads", ["levant"], "صحن وسط", "1 medium plate", 180, 3, 18, 8, fiber=4, sugar=4, sodium=400, tags=["contains_gluten", "fried"])
add("سلطة خضراء", "Green Salad", "salad", "arab_salads", ALL_ARAB, "صحن وسط", "1 medium plate", 150, 2, 8, 5, fiber=4, sugar=3, sodium=100, tags=["heart_healthy", "low_calorie", "high_fiber"])
add("سلطة عربية", "Arabic Salad", "salad", "arab_salads", ALL_ARAB, "صحن وسط", "1 medium plate", 150, 2, 10, 6, fiber=3, sugar=4, sodium=150, tags=["heart_healthy", "low_calorie"])
add("سلطة زبادي بالخيار", "Cucumber Yogurt Salad", "salad", "arab_salads", ALL_ARAB, "صحن صغير", "1 small bowl", 150, 5, 8, 3, fiber=1, sugar=6, sodium=200, tags=["contains_lactose", "low_calorie"])
add("متبل باذنجان", "Mutabbal (Eggplant Dip)", "salad", "dips", ["levant"], "4 ملاعق كبيرة", "4 tbsp", 100, 2, 8, 8, fiber=3, sugar=3, sodium=300)
add("بابا غنوج", "Baba Ghanoush", "salad", "dips", ["levant"], "4 ملاعق كبيرة", "4 tbsp", 100, 2, 9, 7, fiber=3, sugar=3, sodium=280)
add("سلطة سيزر بالدجاج", "Chicken Caesar Salad", "salad", "international_salads", INTL, "صحن كبير", "1 large plate", 300, 28, 12, 16, fiber=3, sugar=2, sodium=700, tags=["high_protein", "contains_gluten", "contains_lactose"])
add("سلطة يونانية", "Greek Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 200, 5, 10, 12, fiber=3, sugar=5, sodium=500, tags=["contains_lactose", "heart_healthy"])
add("سلطة تونة", "Tuna Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium bowl", 200, 20, 6, 10, fiber=2, sugar=3, sodium=500, tags=["contains_seafood", "high_protein"])
add("سلطة بطاطس بالمايونيز", "Potato Salad with Mayo", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 200, 3, 28, 12, fiber=2, sugar=2, sodium=450)
add("كول سلو", "Coleslaw", "salad", "international_salads", INTL, "صحن صغير", "1 small bowl", 130, 1.5, 12, 10, fiber=2, sugar=8, sodium=300)
add("سلطة بنجر بالجوز", "Beetroot Walnut Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 180, 4, 16, 10, fiber=4, sugar=10, sodium=150, tags=["contains_nuts", "heart_healthy"])
add("سلطة كينوا بالخضار", "Quinoa Vegetable Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 220, 8, 32, 8, fiber=6, sugar=3, sodium=250, tags=["whole_grain", "high_fiber", "heart_healthy"])
add("سلطة عدس", "Lentil Salad", "salad", "arab_salads", ALL_ARAB, "صحن وسط", "1 medium plate", 200, 10, 28, 6, fiber=9, sugar=2, sodium=300, tags=["high_fiber", "heart_healthy"])
add("سلطة جرجير بالجرجير والرمان", "Arugula Pomegranate Salad", "salad", "arab_salads", ["levant"], "صحن وسط", "1 medium plate", 150, 3, 14, 7, fiber=3, sugar=8, sodium=100, tags=["heart_healthy", "low_calorie"])
add("سلطة حلوم مشوي", "Grilled Halloumi Salad", "salad", "international_salads", ["levant"], "صحن وسط", "1 medium plate", 220, 14, 8, 14, fiber=3, sugar=4, sodium=700, tags=["contains_lactose", "high_sodium"])
add("سلطة فواكه", "Fruit Salad", "salad", "fruit_salads", ALL_ARAB, "كوب واحد", "1 cup", 160, 1, 28, 0.3, fiber=3.5, sugar=22, sodium=5, tags=["heart_healthy"], quality="reference")
add("سلطة جزر بالزبيب", "Carrot Raisin Salad", "salad", "international_salads", INTL, "صحن صغير", "1 small bowl", 130, 1.5, 22, 6, fiber=3, sugar=16, sodium=120)
add("سلطة روسية", "Russian Salad (Salad Russe)", "salad", "international_salads", INTL, "صحن صغير", "1 small bowl", 150, 2.5, 14, 10, fiber=2, sugar=3, sodium=350)
add("محارة (سلطة حبار)", "Calamari Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 180, 16, 8, 8, fiber=1, sugar=2, sodium=450, tags=["contains_seafood", "high_protein"])
add("سلطة حمص بالخضار", "Chickpea Vegetable Salad", "salad", "arab_salads", ALL_ARAB, "صحن وسط", "1 medium plate", 200, 8, 26, 7, fiber=8, sugar=3, sodium=300, tags=["high_fiber", "heart_healthy"])
add("سلطة ذرة بالمايونيز", "Corn Mayo Salad", "salad", "international_salads", INTL, "صحن صغير", "1 small bowl", 130, 2, 18, 8, fiber=2, sugar=5, sodium=280)
add("سلطة أفوكادو", "Avocado Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 180, 3, 10, 14, fiber=7, sugar=2, sodium=120, tags=["heart_healthy", "high_fiber"])

# ===========================================================================
# 9) SOUPS — شوربات
# ===========================================================================
add("شوربة عدس", "Lentil Soup", "soup", "arab_soups", ALL_ARAB, "صحن وسط", "1 medium bowl", 300, 12, 35, 5, fiber=8, sugar=3, sodium=600, tags=["high_fiber", "heart_healthy"])
add("شوربة عدس بالليمون والكمون", "Lentil Soup with Lemon and Cumin", "soup", "arab_soups", ["egypt", "levant"], "صحن وسط", "1 medium bowl", 300, 12, 34, 4, fiber=8, sugar=2, sodium=580, tags=["high_fiber", "heart_healthy"])
add("شوربة دجاج بالخضار", "Chicken Vegetable Soup", "soup", "arab_soups", ALL_ARAB, "صحن وسط", "1 medium bowl", 300, 15, 12, 5, fiber=2, sugar=3, sodium=650, tags=["high_protein"])
add("شوربة خضار", "Vegetable Soup", "soup", "arab_soups", ALL_ARAB, "صحن وسط", "1 medium bowl", 300, 3, 18, 3, fiber=5, sugar=6, sodium=550, tags=["low_calorie", "heart_healthy"])
add("شوربة فريك", "Freekeh Soup", "soup", "arab_soups", ["levant"], "صحن وسط", "1 medium bowl", 300, 8, 30, 3, fiber=5, sugar=2, sodium=600, tags=["whole_grain", "contains_gluten"])
add("شوربة شعير", "Barley Soup", "soup", "arab_soups", ["gulf"], "صحن وسط", "1 medium bowl", 300, 6, 32, 3, fiber=6, sugar=2, sodium=600, tags=["whole_grain", "contains_gluten"])
add("شوربة لسان عصفور", "Orzo Soup (Lesan Asfour)", "soup", "arab_soups", ["egypt", "levant"], "صحن وسط", "1 medium bowl", 300, 8, 30, 5, fiber=2, sugar=2, sodium=650, tags=["contains_gluten"])
add("شوربة كوارع", "Trotter Soup", "soup", "arab_soups", ["egypt"], "صحن وسط", "1 medium bowl", 300, 16, 2, 12, fiber=0, sugar=0, sodium=750, tags=["kidney_caution"])
add("شوربة كريمة الفطر", "Cream of Mushroom Soup", "soup", "creamy_soups", INTL, "صحن وسط", "1 medium bowl", 300, 6, 18, 12, fiber=2, sugar=4, sodium=700, tags=["contains_lactose"])
add("شوربة كريمة الدجاج", "Cream of Chicken Soup", "soup", "creamy_soups", INTL, "صحن وسط", "1 medium bowl", 300, 10, 16, 12, fiber=1, sugar=3, sodium=750, tags=["contains_lactose"])
add("شوربة طماطم", "Tomato Soup", "soup", "international_soups", INTL, "صحن وسط", "1 medium bowl", 300, 4, 20, 5, fiber=3, sugar=10, sodium=600)
add("شوربة البروكلي", "Broccoli Soup", "soup", "creamy_soups", INTL, "صحن وسط", "1 medium bowl", 300, 8, 15, 10, fiber=4, sugar=3, sodium=650, tags=["contains_lactose"])
add("شوربة الذرة بالدجاج", "Chicken Corn Soup", "soup", "international_soups", INTL, "صحن وسط", "1 medium bowl", 300, 10, 22, 6, fiber=2, sugar=5, sodium=700, tags=["contains_egg"])
add("شوربة البصل الفرنسية", "French Onion Soup", "soup", "international_soups", INTL, "صحن وسط", "1 medium bowl", 300, 8, 25, 10, fiber=3, sugar=8, sodium=900, tags=["contains_gluten", "contains_lactose", "high_sodium"])
add("شوربة روبيان", "Shrimp Soup", "soup", "international_soups", INTL, "صحن وسط", "1 medium bowl", 300, 16, 10, 6, fiber=1, sugar=2, sodium=800, tags=["contains_seafood", "high_protein"])
add("مرق لحم صافي", "Clear Meat Broth", "soup", "broths", ALL_ARAB, "كوب واحد", "1 cup", 240, 10, 0, 3, fiber=0, sugar=0, sodium=800, tags=["low_calorie"])
add("مرق دجاج صافي", "Clear Chicken Broth", "soup", "broths", ALL_ARAB, "كوب واحد", "1 cup", 240, 8, 1, 2, fiber=0, sugar=0, sodium=750, tags=["low_calorie"])
add("شوربة جريش بالدجاج", "Jareesh Chicken Soup", "soup", "arab_soups", ["gulf"], "صحن وسط", "1 medium bowl", 300, 12, 30, 5, fiber=4, sugar=2, sodium=620, tags=["whole_grain", "contains_gluten"])
add("شوربة الحب", "Mixed Grain Soup (Shorbat Al Hob)", "soup", "arab_soups", ["gulf"], "صحن وسط", "1 medium bowl", 300, 10, 28, 6, fiber=4, sugar=2, sodium=650)
add("شوربة الفطر بالشوفان", "Mushroom Oat Soup", "soup", "international_soups", INTL, "صحن وسط", "1 medium bowl", 300, 7, 22, 6, fiber=4, sugar=2, sodium=600, tags=["whole_grain"])

# ===========================================================================
# 10) FRUITS — فواكه (per-100g reference values)
# ===========================================================================
FRUITS = [
    # name_ar, name_en, srv_ar, srv_en, grams, p, c, f, fiber, sugar, sodium
    ("تفاح", "Apple", "حبة وسط", "1 medium", 182, 0.3, 13.8, 0.2, 2.4, 10.4, 1),
    ("موز", "Banana", "حبة وسط", "1 medium", 118, 1.1, 22.8, 0.3, 2.6, 12.2, 1),
    ("برتقال", "Orange", "حبة وسط", "1 medium", 131, 0.9, 11.8, 0.1, 2.4, 9.4, 0),
    ("يوسفي (كلمنتينا)", "Mandarin (Clementine)", "حبتان", "2 pieces", 148, 0.8, 13.3, 0.2, 1.8, 9.2, 1),
    ("عنب", "Grapes", "كوب واحد", "1 cup", 151, 0.7, 18.1, 0.2, 0.9, 15.5, 2),
    ("فراولة", "Strawberries", "كوب واحد", "1 cup", 152, 0.7, 7.7, 0.3, 2, 4.9, 1),
    ("توت أزرق", "Blueberries", "كوب واحد", "1 cup", 148, 0.7, 14.5, 0.3, 2.4, 10, 1),
    ("توت أسود", "Blackberries", "كوب واحد", "1 cup", 144, 1.4, 9.6, 0.5, 5.3, 4.9, 1),
    ("توت بري مجفف", "Dried Cranberries", "ربع كوب", "1/4 cup", 40, 0, 82.5, 0, 5, 65, 5),
    ("توت", "Mulberries", "كوب واحد", "1 cup", 140, 1.4, 9.8, 0.4, 1.7, 8.1, 10),
    ("بطيخ", "Watermelon", "شريحة وسط", "1 medium slice", 286, 0.6, 7.6, 0.2, 0.4, 6.2, 1),
    ("شمام (بطيخ أصفر)", "Cantaloupe Melon", "كوب مكعبات", "1 cup cubes", 160, 0.8, 8.2, 0.2, 0.9, 7.9, 16),
    ("مانجو", "Mango", "حبة وسط", "1 medium", 207, 0.8, 15, 0.4, 1.6, 13.7, 2),
    ("أناناس", "Pineapple", "كوب مكعبات", "1 cup cubes", 165, 0.5, 13.1, 0.1, 1.4, 9.9, 1),
    ("رمان", "Pomegranate", "حبة وسط", "1 medium", 282, 1.7, 18.7, 1.2, 4, 13.7, 3),
    ("كيوي", "Kiwi", "حبتان", "2 pieces", 138, 1.1, 14.7, 0.5, 3, 9, 3),
    ("خوخ", "Peach", "حبة وسط", "1 medium", 150, 0.9, 9.5, 0.3, 1.5, 8.4, 0),
    ("نكتارين", "Nectarine", "حبة وسط", "1 medium", 142, 1.1, 10.6, 0.3, 1.7, 7.9, 0),
    ("مشمش", "Apricot", "3 حبات", "3 pieces", 105, 1.4, 11.1, 0.4, 2, 9.2, 1),
    ("برقوق (خوخ مجفف غير)", "Plum", "حبتان", "2 pieces", 132, 0.7, 11.4, 0.3, 1.4, 9.9, 0),
    ("كرز", "Cherries", "كوب واحد", "1 cup", 138, 1.1, 16, 0.2, 2.1, 12.8, 0),
    ("كمثرى", "Pear", "حبة وسط", "1 medium", 178, 0.4, 15.2, 0.1, 3.1, 9.8, 1),
    ("جوافة", "Guava", "حبة وسط", "1 medium", 110, 2.6, 14.3, 1, 5.4, 8.9, 2),
    ("بابايا", "Papaya", "كوب مكعبات", "1 cup cubes", 145, 0.5, 10.8, 0.3, 1.7, 7.8, 8),
    ("تين طازج", "Fresh Figs", "3 حبات", "3 pieces", 150, 0.8, 19.2, 0.3, 2.9, 16.3, 1),
    ("تين شوكي", "Prickly Pear", "حبتان", "2 pieces", 160, 0.7, 9.6, 0.5, 3.7, 5, 5),
    ("كاكا (برسيمون)", "Persimmon", "حبة وسط", "1 medium", 168, 0.6, 18.6, 0.2, 3.6, 12.5, 1),
    ("ليمون", "Lemon", "حبة وسط", "1 medium", 84, 1.1, 9.3, 0.3, 2.8, 2.5, 2),
    ("جريب فروت", "Grapefruit", "نصف حبة", "1/2 fruit", 123, 0.8, 10.7, 0.1, 1.6, 8.9, 0),
    ("تمر خلاص", "Khalas Dates", "3 تمرات", "3 dates", 24, 0.8, 75, 0.1, 6.7, 63, 1),
    ("تمر سكري", "Sukkari Dates", "3 تمرات", "3 dates", 24, 0.8, 75, 0.1, 6.7, 65, 1),
    ("تمر مجهول", "Medjool Dates", "2 تمرة", "2 dates", 48, 0.8, 75, 0, 6.7, 66, 1),
    ("رطب", "Fresh Dates (Rutab)", "5 حبات", "5 pieces", 50, 0.8, 55, 0.1, 5, 45, 1),
    ("زبيب", "Raisins", "ربع كوب", "1/4 cup", 40, 0.9, 79.3, 0.1, 4, 59, 10),
    ("تين مجفف", "Dried Figs", "3 حبات", "3 pieces", 60, 0.5, 63.9, 0.4, 9.8, 47.9, 2),
    ("مشمش مجفف", "Dried Apricots", "5 حبات", "5 pieces", 40, 0.5, 62.6, 0.1, 7.3, 53.4, 3),
    ("قراصيا (برقوق مجفف)", "Prunes", "4 حبات", "4 pieces", 40, 0.6, 63.9, 0.1, 7.1, 38.1, 1),
    ("أفوكادو", "Avocado", "نصف حبة", "1/2 fruit", 100, 2, 8.5, 14.7, 6.7, 0.7, 7),
    ("جوز الهند الطازج", "Fresh Coconut", "ربع كوب مبشور", "1/4 cup shredded", 40, 3.3, 15.2, 33.5, 9, 6.2, 20),
    ("تمر هندي (لب)", "Tamarind Pulp", "ملعقتان كبيرتان", "2 tbsp", 30, 2.8, 62.5, 0.6, 5.1, 38, 28),
]
for (ar, en, sa, se, g, p, c, f, fib, sug, na) in FRUITS:
    tg = ["heart_healthy"]
    if sug >= 40:
        tg.append("high_sugar")
    add100(ar, en, "fruit", "fresh_fruits", ALL_ARAB, sa, se, g, p, c, f,
           fib100=fib, sug100=sug, na100=na, tags=tg)

# ===========================================================================
# 11) DAIRY — ألبان وأجبان
# ===========================================================================
add("حليب كامل الدسم", "Whole Milk", "dairy", "milk", ALL_ARAB + INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 8, 12, 8, fiber=0, sugar=12, sodium=100, tags=["contains_lactose"], quality="reference")
add("حليب قليل الدسم (1.5%)", "Low-Fat Milk (1.5%)", "dairy", "milk", ALL_ARAB + INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 8.5, 12, 3.5, sugar=12, sodium=105, tags=["contains_lactose", "heart_healthy"], quality="reference")
add("حليب خالي الدسم", "Skim Milk", "dairy", "milk", ALL_ARAB + INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 8.7, 12, 0.3, sugar=12, sodium=110, tags=["contains_lactose", "low_calorie"], quality="reference")
add("لبن رائب (روب)", "Fermented Milk (Rayeb)", "dairy", "milk", ["egypt", "levant", "gulf"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 8, 11, 7, sugar=11, sodium=100, tags=["contains_lactose"], quality="reference")
add("عيران (لبن مخيض)", "Ayran (Buttermilk Drink)", "dairy", "milk", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 6, 8, 4, sugar=8, sodium=250, tags=["contains_lactose", "low_calorie"], quality="reference")
add("شنينة", "Shenina (Churned Yogurt Drink)", "dairy", "milk", ["gulf"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 7, 9, 4, sugar=9, sodium=150, tags=["contains_lactose"], quality="reference")
add("زبادي كامل الدسم", "Full-Fat Yogurt", "dairy", "yogurt", ALL_ARAB, "علبة (170 غ)", "1 pot (170g)", 170, 6, 8, 6, sugar=8, sodium=80, tags=["contains_lactose"], quality="reference")
add("زبادي قليل الدسم", "Low-Fat Yogurt", "dairy", "yogurt", ALL_ARAB, "علبة (170 غ)", "1 pot (170g)", 170, 7, 9, 2.5, sugar=9, sodium=85, tags=["contains_lactose", "low_calorie"], quality="reference")
add("زبادي يوناني", "Greek Yogurt", "dairy", "yogurt", INTL, "علبة (170 غ)", "1 pot (170g)", 170, 17, 6, 4, sugar=6, sodium=60, tags=["contains_lactose", "high_protein"], quality="reference")
add("زبادي بالفواكه", "Fruit Yogurt", "dairy", "yogurt", ALL_ARAB, "علبة (170 غ)", "1 pot (170g)", 170, 5, 24, 2.5, sugar=22, sodium=70, tags=["contains_lactose", "high_sugar"])
add("لبنة", "Labneh", "dairy", "cheeses", ALL_ARAB, "ملعقتان كبيرتان", "2 tbsp", 40, 4, 2, 5, sugar=2, sodium=200, tags=["contains_lactose"], quality="reference")
add("جبنة عكاوي", "Akkawi Cheese", "dairy", "cheeses", ["levant", "egypt"], "قطعة وسط (40 غ)", "1 medium piece (40g)", 40, 8, 1, 7, sugar=0.5, sodium=350, tags=["contains_lactose"], quality="reference")
add("جبنة حلوم", "Halloumi Cheese", "dairy", "cheeses", ["levant"], "شريحتان (50 غ)", "2 slices (50g)", 50, 11, 1, 12, sugar=0.5, sodium=650, tags=["contains_lactose", "high_sodium"], quality="reference")
add("جبنة فيتا", "Feta Cheese", "dairy", "cheeses", ["levant"], "قطعة (40 غ)", "1 piece (40g)", 40, 6, 1.5, 8.5, sugar=1, sodium=450, tags=["contains_lactose"], quality="reference")
add("جبنة بيضاء قليلة الملح", "White Cheese Low Salt", "dairy", "cheeses", ["egypt"], "قطعة وسط (40 غ)", "1 medium piece (40g)", 40, 7, 1, 6, sugar=0.5, sodium=250, tags=["contains_lactose"], quality="reference")
add("جبنة رومي", "Roumy Cheese", "dairy", "cheeses", ["egypt"], "قطعة (30 غ)", "1 piece (30g)", 30, 9, 1, 9, sugar=0, sodium=400, tags=["contains_lactose", "high_sodium"], quality="reference")
add("جبنة قريش", "Qareesh Cheese (Cottage-style)", "dairy", "cheeses", ["egypt"], "نصف كوب (100 غ)", "1/2 cup (100g)", 100, 14, 3, 1, sugar=3, sodium=350, tags=["contains_lactose", "high_protein", "low_calorie"], quality="reference")
add("جبنة شرائح (شيدر مصنعة)", "Processed Cheese Slices", "dairy", "cheeses", ALL_ARAB, "شريحتان (40 غ)", "2 slices (40g)", 40, 6, 2, 7, sugar=1, sodium=450, tags=["contains_lactose", "processed"], quality="reference")
add("جبنة شيدر", "Cheddar Cheese", "dairy", "cheeses", INTL, "قطعة (30 غ)", "1 piece (30g)", 30, 7, 0.4, 10, sugar=0.1, sodium=190, tags=["contains_lactose"], quality="reference")
add("جبنة موزاريلا", "Mozzarella Cheese", "dairy", "cheeses", INTL, "ربع كوب مبشور (30 غ)", "1/4 cup shredded (30g)", 30, 7, 1, 6, sugar=0.3, sodium=150, tags=["contains_lactose"], quality="reference")
add("جبنة كريمية (مثل كيري)", "Cream Cheese Triangle", "dairy", "cheeses", ALL_ARAB, "مثلثان (32 غ)", "2 triangles (32g)", 32, 3, 2, 8, sugar=2, sodium=250, tags=["contains_lactose", "processed"], quality="reference")
add("قشطة", "Qishta (Clotted Cream)", "dairy", "creams", ALL_ARAB, "ملعقتان كبيرتان", "2 tbsp", 40, 1.5, 2, 12, sugar=2, sodium=30, tags=["contains_lactose"], quality="reference")
add("قيمر", "Gaymar (Iraqi Clotted Cream)", "dairy", "creams", ["iraq"], "ملعقتان كبيرتان", "2 tbsp", 40, 1.5, 2, 13, sugar=2, sodium=25, tags=["contains_lactose"], quality="reference")
add("كريمة طازجة", "Fresh Cream", "dairy", "creams", ALL_ARAB, "ملعقتان كبيرتان", "2 tbsp", 30, 0.6, 1, 10, sugar=1, sodium=10, tags=["contains_lactose"], quality="reference")
add("حليب مكثف محلى", "Sweetened Condensed Milk", "dairy", "milk", ALL_ARAB, "ملعقتان كبيرتان", "2 tbsp", 38, 3, 21, 3, sugar=21, sodium=50, tags=["contains_lactose", "high_sugar"], quality="reference")
add("مشروب حليب بالشوكولاتة", "Chocolate Milk", "dairy", "milk", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 8, 26, 5, fiber=1, sugar=24, sodium=150, tags=["contains_lactose", "high_sugar"], quality="reference")
add("حليب الصويا", "Soy Milk", "dairy", "plant_milk", INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 7, 4, 4, fiber=1.5, sugar=1, sodium=100, tags=["heart_healthy", "low_calorie"], quality="reference")
add("حليب اللوز غير المحلى", "Unsweetened Almond Milk", "dairy", "plant_milk", INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 1, 1.5, 2.5, fiber=0.5, sugar=0, sodium=160, tags=["contains_nuts", "low_calorie", "diabetic_friendly"], quality="reference")
add("حليب الشوفان", "Oat Milk", "dairy", "plant_milk", INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 3, 16, 3, fiber=2, sugar=7, sodium=100, tags=["whole_grain"], quality="reference")
add("مشروب زبادي بالملح (دوغ)", "Doogh (Salted Yogurt Drink)", "dairy", "milk", INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 6, 8, 3, sugar=7, sodium=350, tags=["contains_lactose", "low_calorie"], quality="reference")

# ===========================================================================
# 12) EGGS & BREAKFAST — بيض وأطباق فطور
# ===========================================================================
add("بيض مسلوق", "Boiled Egg", "egg_breakfast", "eggs", ALL_ARAB + INTL, "بيضة واحدة", "1 egg", 50, 6.3, 0.6, 5.3, fiber=0, sugar=0.3, sodium=62, tags=["contains_egg", "high_protein"], quality="reference")
add("بيض مقلي", "Fried Egg", "egg_breakfast", "eggs", ALL_ARAB + INTL, "بيضة واحدة", "1 egg", 50, 6.3, 0.6, 8, sugar=0.3, sodium=70, tags=["contains_egg", "fried"], quality="reference")
add("بيض عيون (2 بيضة)", "Sunny Side Up (2 eggs)", "egg_breakfast", "eggs", ALL_ARAB, "بيضتان", "2 eggs", 100, 12.6, 1.2, 16, sugar=0.6, sodium=140, tags=["contains_egg", "fried"])
add("أومليت بالخضار", "Vegetable Omelette", "egg_breakfast", "eggs", ALL_ARAB + INTL, "بيضتان مع خضار", "2 eggs with vegetables", 150, 13, 4, 13, fiber=1, sugar=2, sodium=250, tags=["contains_egg", "high_protein"])
add("أومليت بالجبن", "Cheese Omelette", "egg_breakfast", "eggs", ALL_ARAB + INTL, "بيضتان مع جبن", "2 eggs with cheese", 150, 16, 2, 18, sugar=1, sodium=450, tags=["contains_egg", "contains_lactose", "high_protein"])
add("سكرمبل (بيض مخفوق)", "Scrambled Eggs", "egg_breakfast", "eggs", ALL_ARAB + INTL, "بيضتان", "2 eggs", 120, 13, 2, 15, sugar=1, sodium=250, tags=["contains_egg", "contains_lactose", "high_protein"])
add("شكشوكة", "Shakshuka", "egg_breakfast", "breakfast_dishes", ALL_ARAB + INTL, "صحن وسط (بيضتان)", "1 medium plate (2 eggs)", 250, 13, 12, 14, fiber=3, sugar=6, sodium=500, tags=["contains_egg"])
add("بيض بالطماطم (عجة مصرية)", "Egyptian Eggah Omelette", "egg_breakfast", "breakfast_dishes", ["egypt"], "قطعة وسط", "1 medium piece", 180, 12, 6, 14, fiber=1, sugar=2, sodium=400, tags=["contains_egg"])
add("بيض بالبسطرمة", "Eggs with Bastirma", "egg_breakfast", "breakfast_dishes", ["egypt"], "بيضتان مع شرائح", "2 eggs with slices", 150, 16, 2, 18, sugar=0.5, sodium=700, tags=["contains_egg", "processed", "high_sodium"])
add("فول بالليمون والكمون", "Foul with Lemon and Cumin", "egg_breakfast", "breakfast_dishes", ["egypt"], "صحن وسط", "1 medium bowl", 250, 13, 33, 4, fiber=11, sugar=2, sodium=550, tags=["high_fiber", "heart_healthy"])
add("فول إسكندراني", "Alexandrian Foul", "egg_breakfast", "breakfast_dishes", ["egypt"], "صحن وسط", "1 medium bowl", 250, 13, 32, 8, fiber=11, sugar=2, sodium=650, tags=["high_fiber"])
add("بليلة بالحليب", "Belila with Milk (Wheat Porridge)", "egg_breakfast", "breakfast_dishes", ["egypt"], "كوب واحد", "1 cup", 250, 8, 40, 5, fiber=5, sugar=14, sodium=100, tags=["whole_grain", "contains_lactose"])
add("عصيدة تمر", "Aseeda with Dates", "egg_breakfast", "breakfast_dishes", ["gulf", "north_africa"], "صحن وسط", "1 medium bowl", 250, 6, 55, 12, fiber=3, sugar=20, sodium=150, tags=["contains_gluten", "high_sugar"])
add("معصوب", "Masoub (Banana Bread Mash)", "egg_breakfast", "breakfast_dishes", ["yemen", "gulf"], "صحن وسط", "1 medium bowl", 300, 8, 65, 10, fiber=4, sugar=30, sodium=200, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("بنت الصحن", "Bint Al-Sahn (Honey Cake)", "egg_breakfast", "breakfast_dishes", ["yemen"], "قطعة وسط", "1 medium piece", 150, 6, 45, 14, fiber=1, sugar=25, sodium=180, tags=["contains_gluten", "contains_egg", "high_sugar"])
add("فطور لبناني (لبنة وزعتر وزيتون)", "Lebanese Breakfast (Labneh, Zaatar, Olives)", "egg_breakfast", "breakfast_dishes", ["levant"], "صحن مشكل", "1 mixed plate", 200, 10, 15, 18, fiber=2, sugar=3, sodium=700, tags=["contains_lactose", "contains_gluten"])
add("كشك مصري", "Kishk (Fermented Wheat Porridge)", "egg_breakfast", "breakfast_dishes", ["egypt"], "صحن وسط", "1 medium bowl", 300, 10, 45, 8, fiber=4, sugar=5, sodium=600, tags=["whole_grain", "contains_lactose", "contains_gluten"])
add("فتة بالسمن والعسل", "Fatta with Ghee and Honey", "egg_breakfast", "breakfast_dishes", ["gulf"], "صحن وسط", "1 medium bowl", 250, 6, 50, 14, fiber=2, sugar=28, sodium=200, tags=["contains_gluten", "high_sugar"])
add("هريس صباحي بالحليب", "Harees Breakfast with Milk", "egg_breakfast", "breakfast_dishes", ["gulf"], "صحن وسط", "1 medium bowl", 250, 8, 40, 8, fiber=3, sugar=12, sodium=150, tags=["contains_gluten", "contains_lactose"])
add("جبن وزيتون مع خبز", "Cheese and Olives with Bread", "egg_breakfast", "breakfast_dishes", ALL_ARAB, "صحن مشكل", "1 mixed plate", 180, 10, 35, 12, fiber=2, sugar=2, sodium=650, tags=["contains_lactose", "contains_gluten"])
add("شوفان بالحليب والموز", "Oatmeal with Milk and Banana", "egg_breakfast", "breakfast_dishes", INTL, "صحن وسط", "1 medium bowl", 300, 10, 45, 7, fiber=6, sugar=18, sodium=100, tags=["whole_grain", "contains_lactose", "heart_healthy"])
add("بان كيك (3 قطع)", "Pancakes (3 pieces)", "egg_breakfast", "breakfast_dishes", INTL, "3 قطع وسط", "3 medium pieces", 150, 8, 45, 8, fiber=1.5, sugar=10, sodium=450, tags=["contains_gluten", "contains_egg", "contains_lactose", "refined_carb"])
add("وافل بالعسل", "Waffle with Honey", "egg_breakfast", "breakfast_dishes", INTL, "قطعة واحدة", "1 piece", 100, 6, 35, 10, fiber=1, sugar=18, sodium=350, tags=["contains_gluten", "contains_egg", "high_sugar"])
add("توست فرنسي (فرنش توست)", "French Toast", "egg_breakfast", "breakfast_dishes", INTL, "شريحتان", "2 slices", 120, 9, 30, 10, fiber=1, sugar=12, sodium=350, tags=["contains_gluten", "contains_egg", "contains_lactose"])
add("عصيدة بالحليب", "Aseeda with Milk", "egg_breakfast", "breakfast_dishes", ["gulf", "north_africa"], "صحن وسط", "1 medium bowl", 250, 7, 50, 10, fiber=2, sugar=15, sodium=140, tags=["contains_gluten", "contains_lactose"])

# ===========================================================================
# 13) NUTS & SEEDS — مكسرات وبذور
# ===========================================================================
NUTS = [
    # name_ar, name_en, p, c, f, fiber, sugar, sodium (per 100g), extra tags
    ("لوز نيء", "Raw Almonds", 21.2, 21.6, 49.9, 12.5, 4.4, 1, ["heart_healthy"]),
    ("جوز عين جمل", "Walnuts", 15.2, 13.7, 65.2, 6.7, 2.6, 2, ["heart_healthy"]),
    ("كاجو محمص", "Roasted Cashews", 15.3, 30.2, 46.4, 3.3, 5.9, 12, []),
    ("فستق حلبي", "Pistachios", 20.2, 27.2, 45.3, 10.6, 7.7, 1, ["heart_healthy"]),
    ("بندق", "Hazelnuts", 15, 16.7, 60.8, 9.7, 4.3, 0, ["heart_healthy"]),
    ("مكاديميا", "Macadamia Nuts", 7.9, 13.8, 75.8, 8.6, 4.6, 5, []),
    ("صنوبر", "Pine Nuts", 13.7, 13.1, 68.4, 3.7, 3.6, 2, []),
    ("فول سوداني", "Peanuts", 25.8, 16.1, 49.2, 8.5, 4.7, 5, ["high_protein"]),
    ("فول سوداني مملح", "Salted Peanuts", 24.4, 21.5, 49.7, 8, 4.2, 450, ["high_sodium", "processed"]),
    ("بقان (جوز أمريكي)", "Pecans", 9.2, 13.9, 72, 9.6, 4, 0, ["heart_healthy"]),
    ("كستناء محمصة", "Roasted Chestnuts", 3.2, 53, 2.2, 5.1, 10.6, 2, ["low_calorie"]),
]
for (ar, en, p, c, f, fib, sug, na, xt) in NUTS:
    add100(ar, en, "nuts_seeds", "nuts", ALL_ARAB + INTL, "قبضة صغيرة (30 غ)", "1 small handful (30g)",
           30, p, c, f, fib100=fib, sug100=sug, na100=na,
           tags=["contains_nuts", "heart_healthy"] + xt, sizes="default")

SEEDS = [
    ("بذور دوار الشمس", "Sunflower Seeds", 20.8, 20, 51.5, 8.6, 2.6, 9),
    ("بذور اليقطين", "Pumpkin Seeds", 30.2, 10.7, 49.1, 6, 1.4, 7),
    ("بذور الكتان", "Flaxseeds", 18.3, 28.9, 42.2, 27.3, 1.6, 30),
    ("بذور الشيا", "Chia Seeds", 16.5, 42.1, 30.7, 34.4, 0, 16),
    ("سمسم", "Sesame Seeds", 17.7, 23.4, 49.7, 11.8, 0.3, 11),
    ("لب البطيخ", "Watermelon Seeds", 28.3, 15.3, 47.4, 4, 0, 99),
]
for (ar, en, p, c, f, fib, sug, na) in SEEDS:
    add100(ar, en, "nuts_seeds", "seeds", ALL_ARAB, "ملعقتان كبيرتان (20 غ)", "2 tbsp (20g)",
           20, p, c, f, fib100=fib, sug100=sug, na100=na,
           tags=["heart_healthy", "high_fiber"])

add("طحينة", "Tahini", "nuts_seeds", "spreads", ALL_ARAB, "ملعقة كبيرة (15 غ)", "1 tbsp (15g)", 15, 2.6, 3.2, 8, fiber=1.4, sugar=0.1, sodium=5, tags=["heart_healthy"], quality="reference")
add("زبدة الفول السوداني", "Peanut Butter", "nuts_seeds", "spreads", ALL_ARAB + INTL, "ملعقة كبيرة (16 غ)", "1 tbsp (16g)", 16, 4, 3, 8, fiber=1, sugar=1.5, sodium=70, tags=["contains_nuts"], quality="reference")
add("زبدة اللوز", "Almond Butter", "nuts_seeds", "spreads", INTL, "ملعقة كبيرة (16 غ)", "1 tbsp (16g)", 16, 3.4, 3, 9, fiber=1.6, sugar=1, sodium=2, tags=["contains_nuts", "heart_healthy"], quality="reference")
add("خلطة مكسرات مشكلة", "Mixed Nuts", "nuts_seeds", "nuts", ALL_ARAB, "قبضة صغيرة (30 غ)", "1 small handful (30g)", 30, 5, 6, 15, fiber=2.5, sugar=1.5, sodium=2, tags=["contains_nuts", "heart_healthy"], quality="reference")
add("مقلي عراقي (مكسرات مخلوطة مملحة)", "Iraqi Maqli (Salted Nut Mix)", "nuts_seeds", "nuts", ["iraq"], "قبضة صغيرة (30 غ)", "1 small handful (30g)", 30, 5, 7, 14, fiber=2, sugar=1, sodium=300, tags=["contains_nuts", "high_sodium", "processed"])
add("جوز هند مبشور", "Shredded Coconut", "nuts_seeds", "nuts", ALL_ARAB, "ربع كوب (20 غ)", "1/4 cup (20g)", 20, 0.7, 3, 6.7, fiber=1.8, sugar=1.2, sodium=4, tags=[], quality="reference")

# ===========================================================================
# 14) OILS & FATS — زيوت ودهون (per tablespoon unless noted)
# ===========================================================================
FATS = [
    ("زيت زيتون", "Olive Oil", 0, 0, 100, 0, ["heart_healthy"]),
    ("زيت دوار الشمس", "Sunflower Oil", 0, 0, 100, 0, []),
    ("زيت ذرة", "Corn Oil", 0, 0, 100, 0, []),
    ("زيت كانولا", "Canola Oil", 0, 0, 100, 0, ["heart_healthy"]),
    ("زيت سمسم", "Sesame Oil", 0, 0, 100, 0, []),
    ("زيت جوز الهند", "Coconut Oil", 0, 0, 100, 0, []),
    ("زيت فول سوداني", "Peanut Oil", 0, 0, 100, 0, ["contains_nuts"]),
    ("زيت الأفوكادو", "Avocado Oil", 0, 0, 100, 0, ["heart_healthy"]),
    ("زيت الكتان", "Flaxseed Oil", 0, 0, 100, 0, ["heart_healthy"]),
    ("سمن بقري (سمن بلدي)", "Ghee (Clarified Butter)", 0, 0, 100, 0, ["contains_lactose"]),
    ("سمن نباتي", "Vegetable Ghee (Shortening)", 0, 0, 100, 0, ["processed"]),
    ("زبدة", "Butter", 0.9, 0.1, 81, 0, ["contains_lactose"]),
    ("مارجرين", "Margarine", 0.2, 0.7, 80, 0, ["processed"]),
    ("دهن لية", "Rendered Tail Fat", 0, 0, 100, 0, []),
]
for (ar, en, p, c, f, na, xt) in FATS:
    add100(ar, en, "oil_fat", "oils_fats", ALL_ARAB, "ملعقة كبيرة (14 غ)", "1 tbsp (14g)",
           14, p, c, f, na100=na, tags=xt, sizes=[("ملعقة صغيرة", "1 tsp", 0.33), ("ملعقتان كبيرتان", "2 tbsp", 2.0)])

add("زيتون أخضر", "Green Olives", "oil_fat", "olives", ALL_ARAB, "8 حبات", "8 pieces", 40, 0.4, 1.5, 4.5, fiber=1.3, sugar=0, sodium=600, tags=["high_sodium", "heart_healthy"], quality="reference")
add("زيتون أسود", "Black Olives", "oil_fat", "olives", ALL_ARAB, "8 حبات", "8 pieces", 40, 0.3, 2.4, 4.6, fiber=1.3, sugar=0, sodium=550, tags=["high_sodium", "heart_healthy"], quality="reference")

# ===========================================================================
# 15) SWEETS & DESSERTS — حلويات
# ===========================================================================
add("كنافة نابلسية بالجبن", "Nabulsi Kunafa with Cheese", "sweets", "arab_sweets", ["levant"], "قطعة وسط", "1 medium piece", 150, 8, 45, 18, fiber=1, sugar=30, sodium=350, tags=["contains_gluten", "contains_lactose", "high_sugar", "fried"])
add("كنافة بالقشطة", "Kunafa with Cream", "sweets", "arab_sweets", ["levant"], "قطعة وسط", "1 medium piece", 150, 6, 48, 18, fiber=1, sugar=32, sodium=200, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("كنافة بالمكسرات", "Kunafa with Nuts", "sweets", "arab_sweets", ["levant", "gulf"], "قطعة وسط", "1 medium piece", 150, 7, 45, 20, fiber=1.5, sugar=30, sodium=150, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("بقلاوة بالفستق", "Baklava with Pistachios", "sweets", "arab_sweets", ALL_ARAB, "2 قطعة", "2 pieces", 80, 4, 30, 16, fiber=1.5, sugar=20, sodium=120, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("بقلاوة بالجوز", "Baklava with Walnuts", "sweets", "arab_sweets", ALL_ARAB, "2 قطعة", "2 pieces", 80, 4, 30, 16, fiber=1.5, sugar=20, sodium=120, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("بقلاوة بالكاجو", "Baklava with Cashews", "sweets", "arab_sweets", ["gulf"], "2 قطعة", "2 pieces", 80, 4, 31, 16, fiber=1, sugar=21, sodium=120, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("معمول تمر", "Maamoul with Dates", "sweets", "arab_sweets", ["levant", "gulf", "iraq"], "3 قطع", "3 pieces", 90, 4, 45, 12, fiber=2, sugar=24, sodium=80, tags=["contains_gluten", "high_sugar"])
add("معمول فستق", "Maamoul with Pistachios", "sweets", "arab_sweets", ["levant"], "3 قطع", "3 pieces", 90, 5, 42, 14, fiber=1.5, sugar=22, sodium=80, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("معمول جوز", "Maamoul with Walnuts", "sweets", "arab_sweets", ["levant"], "3 قطع", "3 pieces", 90, 5, 42, 14, fiber=1.5, sugar=22, sodium=80, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("أم علي", "Umm Ali", "sweets", "arab_sweets", ["egypt"], "صحن وسط", "1 medium bowl", 200, 7, 45, 16, fiber=1, sugar=28, sodium=200, tags=["contains_gluten", "contains_lactose", "contains_nuts", "high_sugar"])
add("أم علي بالمكسرات والقشطة", "Umm Ali with Nuts and Cream", "sweets", "arab_sweets", ["egypt"], "صحن وسط", "1 medium bowl", 220, 8, 46, 20, fiber=1.5, sugar=28, sodium=200, tags=["contains_gluten", "contains_lactose", "contains_nuts", "high_sugar"])
add("لقيمات", "Luqaimat", "sweets", "arab_sweets", ["gulf"], "6 حبات", "6 pieces", 120, 3, 40, 10, fiber=1, sugar=25, sodium=150, tags=["contains_gluten", "high_sugar", "fried"])
add("بلح الشام", "Balah El Sham", "sweets", "arab_sweets", ["egypt", "levant"], "3 أصابع", "3 fingers", 90, 2.5, 35, 10, fiber=0.5, sugar=20, sodium=100, tags=["contains_gluten", "high_sugar", "fried"])
add("زلابية (عوامة)", "Zalabia (Awameh)", "sweets", "arab_sweets", ["levant", "egypt"], "6 حبات", "6 pieces", 120, 3, 42, 10, fiber=1, sugar=26, sodium=120, tags=["contains_gluten", "high_sugar", "fried"])
add("قطايف بالجوز", "Qatayef with Walnuts", "sweets", "arab_sweets", ["levant", "egypt"], "3 قطع", "3 pieces", 120, 5, 42, 12, fiber=1.5, sugar=22, sodium=100, tags=["contains_gluten", "contains_nuts", "high_sugar", "fried"])
add("قطايف بالقشطة", "Qatayef with Cream", "sweets", "arab_sweets", ["levant", "egypt"], "3 قطع", "3 pieces", 130, 4, 45, 10, fiber=1, sugar=24, sodium=90, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("مشبك", "Meshabak", "sweets", "arab_sweets", ["egypt"], "2 قطعة", "2 pieces", 100, 2.5, 40, 10, fiber=0.5, sugar=24, sodium=100, tags=["contains_gluten", "high_sugar", "fried"])
add("بسبوسة", "Basbousa", "sweets", "arab_sweets", ["egypt", "levant", "gulf"], "قطعة وسط", "1 medium piece", 100, 3, 45, 10, fiber=1, sugar=30, sodium=120, tags=["contains_gluten", "high_sugar"])
add("هريسة (حلوى السميد)", "Harisa (Semolina Cake)", "sweets", "arab_sweets", ["levant"], "قطعة وسط", "1 medium piece", 100, 3, 44, 10, fiber=1, sugar=29, sodium=120, tags=["contains_gluten", "high_sugar"])
add("وربات بالفستق", "Warbat with Pistachios", "sweets", "arab_sweets", ["levant"], "2 قطعة", "2 pieces", 90, 4, 32, 14, fiber=1, sugar=20, sodium=130, tags=["contains_gluten", "contains_nuts", "contains_lactose", "high_sugar"])
add("غريبة", "Ghorayeba (Shortbread)", "sweets", "arab_sweets", ["egypt", "levant"], "4 قطع", "4 pieces", 60, 3, 26, 12, fiber=0.5, sugar=12, sodium=60, tags=["contains_gluten", "high_sugar"])
add("كحك العيد", "Kahk (Eid Cookies)", "sweets", "arab_sweets", ["egypt"], "3 قطع", "3 pieces", 90, 4, 40, 14, fiber=1, sugar=18, sodium=70, tags=["contains_gluten", "high_sugar"])
add("كحك محشي تمر", "Kahk Stuffed with Dates", "sweets", "arab_sweets", ["egypt"], "3 قطع", "3 pieces", 100, 4, 45, 13, fiber=2, sugar=22, sodium=70, tags=["contains_gluten", "high_sugar"])
add("بيتي فور", "Petit Four", "sweets", "arab_sweets", ["egypt"], "5 قطع", "5 pieces", 50, 3, 25, 10, fiber=0.5, sugar=14, sodium=60, tags=["contains_gluten", "high_sugar"])
add("كليجة عراقية", "Iraqi Kleicha", "sweets", "arab_sweets", ["iraq"], "3 قطع", "3 pieces", 90, 4, 42, 12, fiber=1.5, sugar=20, sodium=90, tags=["contains_gluten", "high_sugar"])
add("شباكية مغربية", "Chebakia", "sweets", "arab_sweets", ["maghreb"], "2 قطعة", "2 pieces", 90, 3, 38, 12, fiber=1, sugar=22, sodium=80, tags=["contains_gluten", "high_sugar", "fried"])
add("مقروض بالتمر", "Makroud with Dates", "sweets", "arab_sweets", ["maghreb"], "2 قطعة", "2 pieces", 100, 3, 42, 12, fiber=2, sugar=22, sodium=60, tags=["contains_gluten", "high_sugar", "fried"])
add("بريوات باللوز", "Briouats with Almonds", "sweets", "arab_sweets", ["maghreb"], "3 قطع", "3 pieces", 75, 4, 28, 12, fiber=1.5, sugar=18, sodium=70, tags=["contains_gluten", "contains_nuts", "high_sugar", "fried"])
add("حلاوة طحينية", "Halawa (Tahini Halva)", "sweets", "arab_sweets", ALL_ARAB, "قطعة (40 غ)", "1 piece (40g)", 40, 4, 20, 8, fiber=1, sugar=16, sodium=20, tags=["high_sugar"], quality="reference")
add("حلاوة بالفستق", "Halva with Pistachios", "sweets", "arab_sweets", ALL_ARAB, "قطعة (40 غ)", "1 piece (40g)", 40, 5, 19, 9, fiber=1.5, sugar=15, sodium=20, tags=["contains_nuts", "high_sugar"])
add("رهش", "Rahash", "sweets", "arab_sweets", ["gulf"], "قطعة (40 غ)", "1 piece (40g)", 40, 4, 18, 9, fiber=1, sugar=14, sodium=25, tags=["high_sugar"])
add("مهلبية", "Muhallabia (Milk Pudding)", "sweets", "puddings", ALL_ARAB, "كوب صغير", "1 small cup", 150, 4, 24, 4, fiber=0, sugar=18, sodium=80, tags=["contains_lactose", "high_sugar"])
add("مهلبية بالمكسرات", "Muhallabia with Nuts", "sweets", "puddings", ALL_ARAB, "كوب صغير", "1 small cup", 160, 5, 24, 6, fiber=0.5, sugar=18, sodium=80, tags=["contains_lactose", "contains_nuts", "high_sugar"])
add("رز بحليب", "Rice Pudding (Roz Bel Laban)", "sweets", "puddings", ["egypt", "levant"], "كوب صغير", "1 small cup", 150, 4, 26, 4, fiber=0.3, sugar=16, sodium=80, tags=["contains_lactose", "high_sugar"])
add("كاسترد", "Custard", "sweets", "puddings", INTL, "كوب صغير", "1 small cup", 150, 5, 22, 5, fiber=0, sugar=17, sodium=90, tags=["contains_lactose", "contains_egg", "high_sugar"])
add("كريم كراميل", "Creme Caramel", "sweets", "puddings", ALL_ARAB, "قطعة وسط", "1 medium piece", 130, 4, 26, 4, fiber=0, sugar=24, sodium=100, tags=["contains_lactose", "contains_egg", "high_sugar"])
add("بلاليط", "Balaleet (Sweet Vermicelli)", "sweets", "arab_sweets", ["gulf"], "صحن وسط", "1 medium plate", 200, 6, 55, 8, fiber=1, sugar=25, sodium=150, tags=["contains_gluten", "high_sugar"])
add("حنيني", "Haneeni (Date Bulgur Dessert)", "sweets", "arab_sweets", ["gulf"], "صحن وسط", "1 medium bowl", 200, 5, 50, 10, fiber=4, sugar=26, sodium=100, tags=["whole_grain", "contains_gluten", "high_sugar"])
add("خبيصة", "Khabeesa", "sweets", "arab_sweets", ["gulf"], "صحن صغير", "1 small bowl", 150, 3, 40, 8, fiber=1, sugar=24, sodium=80, tags=["contains_gluten", "high_sugar"])
add("حلاوة الجزر", "Carrot Halwa", "sweets", "arab_sweets", ["gulf"], "صحن صغير", "1 small bowl", 150, 3, 35, 8, fiber=2, sugar=26, sodium=60, tags=["contains_lactose", "high_sugar"])
add("أصابع زينب", "Zainab Fingers", "sweets", "arab_sweets", ["levant"], "3 أصابع", "3 fingers", 90, 3, 35, 10, fiber=1, sugar=22, sodium=90, tags=["contains_gluten", "high_sugar", "fried"])
add("جلاش بالمكسرات", "Goulash with Nuts", "sweets", "arab_sweets", ["egypt"], "قطعة وسط", "1 medium piece", 90, 4, 32, 14, fiber=1, sugar=20, sodium=100, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("عش البلبل", "Osh Al Bolbol (Bird's Nest)", "sweets", "arab_sweets", ["levant"], "3 قطع", "3 pieces", 75, 4, 28, 12, fiber=1.5, sugar=18, sodium=80, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("مدلوقة", "Madlouka", "sweets", "arab_sweets", ["levant"], "قطعة وسط", "1 medium piece", 100, 4, 40, 12, fiber=1, sugar=26, sodium=100, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("راحة الحلقوم", "Turkish Delight (Raha)", "sweets", "arab_sweets", ALL_ARAB, "4 قطع", "4 pieces", 60, 0.2, 30, 0.5, fiber=0, sugar=24, sodium=10, tags=["high_sugar"])
add("راحة بالفستق", "Turkish Delight with Pistachios", "sweets", "arab_sweets", ALL_ARAB, "4 قطع", "4 pieces", 70, 2, 28, 4, fiber=1, sugar=22, sodium=10, tags=["contains_nuts", "high_sugar"])
add("نوغا (نوجا)", "Nougat", "sweets", "arab_sweets", ALL_ARAB, "2 قطعة", "2 pieces", 40, 3, 22, 6, fiber=0.5, sugar=18, sodium=15, tags=["contains_nuts", "high_sugar"])
add("ملبن", "Malban (Grape Molasses Sweet)", "sweets", "arab_sweets", ["levant"], "4 قطع", "4 pieces", 60, 1, 28, 2, fiber=0.5, sugar=20, sodium=10, tags=["high_sugar"])
add("عسل طبيعي", "Natural Honey", "sweets", "sweeteners", ALL_ARAB, "ملعقة كبيرة", "1 tbsp", 21, 0, 17, 0, fiber=0, sugar=17, sodium=1, tags=["high_sugar"], quality="reference")
add("عسل سدر", "Sidr Honey", "sweets", "sweeteners", ["gulf", "yemen"], "ملعقة كبيرة", "1 tbsp", 21, 0, 17, 0, fiber=0, sugar=17, sodium=1, tags=["high_sugar"], quality="reference")
add("دبس تمر", "Date Molasses (Dibs)", "sweets", "sweeteners", ["iraq", "gulf"], "ملعقة كبيرة", "1 tbsp", 20, 0, 16, 0, fiber=0.5, sugar=14, sodium=5, tags=["high_sugar"], quality="reference")
add("دبس رمان", "Pomegranate Molasses", "sweets", "sweeteners", ["levant"], "ملعقة كبيرة", "1 tbsp", 20, 0, 15, 0, fiber=0, sugar=12, sodium=10, tags=["high_sugar"], quality="reference")
add("سكر أبيض", "White Sugar", "sweets", "sweeteners", ALL_ARAB + INTL, "ملعقة صغيرة", "1 tsp", 4, 0, 4, 0, fiber=0, sugar=4, sodium=0, tags=["high_sugar", "refined_carb"], quality="reference")
add("مربى فراولة", "Strawberry Jam", "sweets", "sweeteners", ALL_ARAB, "ملعقة كبيرة", "1 tbsp", 20, 0, 13, 0, fiber=0.2, sugar=10, sodium=5, tags=["high_sugar"], quality="reference")
add("مربى مشمش", "Apricot Jam", "sweets", "sweeteners", ALL_ARAB, "ملعقة كبيرة", "1 tbsp", 20, 0, 13, 0, fiber=0.2, sugar=10, sodium=5, tags=["high_sugar"], quality="reference")
add("شوكولاتة بالحليب", "Milk Chocolate", "sweets", "chocolate", ALL_ARAB + INTL, "قطعة (30 غ)", "1 bar (30g)", 30, 2.2, 17, 9, fiber=0.7, sugar=15, sodium=25, tags=["contains_lactose", "high_sugar", "caffeine"], quality="reference")
add("شوكولاتة داكنة 70%", "Dark Chocolate 70%", "sweets", "chocolate", INTL, "قطعة (30 غ)", "1 bar (30g)", 30, 2.4, 12, 13, fiber=3, sugar=8, sodium=5, tags=["heart_healthy", "caffeine"], quality="reference")
add("شوكولاتة بالبندق", "Hazelnut Chocolate Bar", "sweets", "chocolate", INTL, "قطعة (30 غ)", "1 bar (30g)", 30, 3, 16, 10, fiber=1, sugar=14, sodium=25, tags=["contains_nuts", "contains_lactose", "high_sugar"], quality="reference")
add("كريمة البندق (نوتيلا)", "Hazelnut Spread (Nutella)", "sweets", "chocolate", INTL, "ملعقة كبيرة", "1 tbsp", 20, 1.5, 11.5, 7, fiber=0.8, sugar=10.5, sodium=8, tags=["contains_nuts", "contains_lactose", "high_sugar"], quality="reference")
add("كيك شوكولاتة", "Chocolate Cake", "sweets", "cakes", INTL, "قطعة وسط", "1 medium slice", 100, 5, 40, 16, fiber=2, sugar=28, sodium=250, tags=["contains_gluten", "contains_egg", "contains_lactose", "high_sugar"])
add("كيك فانيلا", "Vanilla Cake", "sweets", "cakes", INTL, "قطعة وسط", "1 medium slice", 100, 4, 42, 14, fiber=0.5, sugar=28, sodium=240, tags=["contains_gluten", "contains_egg", "contains_lactose", "high_sugar"])
add("كيك التمر", "Date Cake", "sweets", "cakes", ["gulf"], "قطعة وسط", "1 medium slice", 100, 4, 42, 12, fiber=2, sugar=26, sodium=200, tags=["contains_gluten", "contains_egg", "high_sugar"])
add("كيك الجزر", "Carrot Cake", "sweets", "cakes", INTL, "قطعة وسط", "1 medium slice", 100, 4, 38, 16, fiber=1.5, sugar=26, sodium=250, tags=["contains_gluten", "contains_egg", "contains_nuts", "high_sugar"])
add("تشيز كيك", "Cheesecake", "sweets", "cakes", INTL, "قطعة وسط", "1 medium slice", 110, 6, 30, 18, fiber=0.5, sugar=22, sodium=250, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("تيراميسو", "Tiramisu", "sweets", "cakes", INTL, "قطعة وسط", "1 medium piece", 110, 5, 28, 16, fiber=0.5, sugar=18, sodium=150, tags=["contains_gluten", "contains_lactose", "contains_egg", "caffeine", "high_sugar"])
add("مافن بالتوت", "Blueberry Muffin", "sweets", "cakes", INTL, "قطعة واحدة", "1 piece", 90, 4, 35, 12, fiber=1, sugar=20, sodium=250, tags=["contains_gluten", "contains_egg", "high_sugar"])
add("دونات محلاة", "Glazed Donut", "sweets", "cakes", INTL, "قطعة واحدة", "1 piece", 75, 3, 32, 14, fiber=1, sugar=18, sodium=200, tags=["contains_gluten", "high_sugar", "fried"])
add("إكلير", "Eclair", "sweets", "cakes", INTL, "قطعة واحدة", "1 piece", 80, 4, 25, 14, fiber=0.5, sugar=16, sodium=150, tags=["contains_gluten", "contains_egg", "contains_lactose", "high_sugar"])
add("براوني", "Brownie", "sweets", "cakes", INTL, "قطعة وسط", "1 medium piece", 60, 3, 24, 12, fiber=1, sugar=18, sodium=120, tags=["contains_gluten", "contains_egg", "high_sugar"])
add("كوكيز بالشوكولاتة", "Chocolate Chip Cookies", "sweets", "cakes", INTL, "3 قطع", "3 pieces", 48, 2.5, 24, 8, fiber=1, sugar=14, sodium=120, tags=["contains_gluten", "contains_egg", "high_sugar"])
add("كريب بالنوتيلا", "Crepe with Nutella", "sweets", "cakes", INTL, "قطعة واحدة", "1 piece", 150, 7, 50, 18, fiber=2, sugar=28, sodium=200, tags=["contains_gluten", "contains_egg", "contains_nuts", "high_sugar"])
add("آيس كريم فانيلا", "Vanilla Ice Cream", "sweets", "ice_cream", ALL_ARAB + INTL, "كوبتان (2 سكوب)", "2 scoops", 130, 4, 26, 12, fiber=0.5, sugar=24, sodium=90, tags=["contains_lactose", "high_sugar"], quality="reference")
add("آيس كريم شوكولاتة", "Chocolate Ice Cream", "sweets", "ice_cream", ALL_ARAB + INTL, "كوبتان (2 سكوب)", "2 scoops", 130, 4.5, 28, 13, fiber=1, sugar=25, sodium=85, tags=["contains_lactose", "high_sugar", "caffeine"], quality="reference")
add("بوظة عربية بالفستق", "Arabic Booza with Pistachios", "sweets", "ice_cream", ["levant"], "كوبتان (2 سكوب)", "2 scoops", 140, 5, 28, 13, fiber=1, sugar=24, sodium=80, tags=["contains_lactose", "contains_nuts", "high_sugar"])
add("آيس كريم ماء (سلاش)", "Fruit Sorbet", "sweets", "ice_cream", INTL, "كوبتان (2 سكوب)", "2 scoops", 120, 0.5, 30, 0.2, fiber=1, sugar=26, sodium=10, tags=["high_sugar", "low_calorie"], quality="reference")
add("جيلي (جيلاتين)", "Jelly (Gelatin Dessert)", "sweets", "puddings", ALL_ARAB, "كوب صغير", "1 small cup", 120, 2, 24, 0, fiber=0, sugar=22, sodium=30, tags=["high_sugar"], quality="reference")
add("كنافة بالمانجو", "Kunafa with Mango", "sweets", "arab_sweets", ["egypt"], "قطعة وسط", "1 medium piece", 160, 6, 50, 16, fiber=1.5, sugar=32, sodium=180, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("سوابع كنفر", "Konafa Fingers (Asabi)", "sweets", "arab_sweets", ["egypt"], "3 قطع", "3 pieces", 90, 4, 32, 12, fiber=1, sugar=20, sodium=100, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("حلوى شعرية (كنافة شعر)", "Kadayif (Shredded Pastry)", "sweets", "arab_sweets", ["levant"], "قطعة وسط", "1 medium piece", 100, 4, 36, 14, fiber=1, sugar=22, sodium=110, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("هريس حجازي", "Hijazi Harees Dessert", "sweets", "arab_sweets", ["gulf"], "صحن صغير", "1 small bowl", 150, 4, 38, 10, fiber=2, sugar=22, sodium=90, tags=["contains_gluten", "high_sugar"])
add("ساقو (تبيوكة بالحليب)", "Sago Pudding with Milk", "sweets", "puddings", ["gulf"], "كوب صغير", "1 small cup", 150, 3, 26, 4, fiber=0, sugar=16, sodium=70, tags=["contains_lactose", "high_sugar"])
add("دقلو سوداني", "Sudanese Dagolo (Sesame Sweet)", "sweets", "arab_sweets", ["north_africa"], "2 قطعة", "2 pieces", 50, 3, 22, 8, fiber=1.5, sugar=16, sodium=15, tags=["high_sugar"])
add("كعك بالسمسم", "Sesame Cookies (Kaak)", "sweets", "arab_sweets", ["levant", "iraq"], "3 قطع", "3 pieces", 75, 4, 30, 10, fiber=1.5, sugar=12, sodium=90, tags=["contains_gluten", "high_sugar"])
add("عرايس تمر (مقروط)", "Date Stuffed Semolina Bars", "sweets", "arab_sweets", ["maghreb"], "2 قطعة", "2 pieces", 90, 2.5, 38, 10, fiber=2, sugar=20, sodium=60, tags=["contains_gluten", "high_sugar", "fried"])
add("بسبوسة بالقشطة", "Basbousa with Cream", "sweets", "arab_sweets", ["egypt"], "قطعة وسط", "1 medium piece", 110, 4, 45, 13, fiber=1, sugar=30, sodium=130, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("كنافة عثملية", "Osmalieh with Cream", "sweets", "arab_sweets", ["levant"], "قطعة وسط", "1 medium piece", 130, 5, 42, 15, fiber=1, sugar=26, sodium=120, tags=["contains_gluten", "contains_lactose", "high_sugar"])

# ===========================================================================
# 16) BEVERAGES — مشروبات
# ===========================================================================
add("ماء", "Water", "beverage", "water", ALL_ARAB + INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 0, 0, fiber=0, sugar=0, sodium=0, tags=["diabetic_friendly", "low_calorie"], quality="reference", sizes="drink")
add("قهوة عربية (بدون سكر)", "Arabic Coffee (Unsweetened)", "beverage", "coffee", ["gulf"], "فنجان (60 مل)", "1 cup (60ml)", 60, 0.2, 0.5, 0, sugar=0, sodium=2, tags=["caffeine", "diabetic_friendly", "low_calorie"], quality="reference", sizes="drink")
add("قهوة تركية (بدون سكر)", "Turkish Coffee (Unsweetened)", "beverage", "coffee", ["levant", "egypt"], "فنجان (60 مل)", "1 cup (60ml)", 60, 0.3, 1, 0, sugar=0, sodium=2, tags=["caffeine", "diabetic_friendly", "low_calorie"], quality="reference", sizes="drink")
add("قهوة تركية بالسكر", "Turkish Coffee with Sugar", "beverage", "coffee", ["levant", "egypt"], "فنجان (60 مل)", "1 cup (60ml)", 60, 0.3, 6, 0, sugar=5, sodium=2, tags=["caffeine"], sizes="drink")
add("إسبريسو", "Espresso", "beverage", "coffee", INTL, "شوت (30 مل)", "1 shot (30ml)", 30, 0.1, 0.5, 0, sugar=0, sodium=5, tags=["caffeine", "diabetic_friendly", "low_calorie"], quality="reference", sizes=[])
add("قهوة أمريكانو", "Americano", "beverage", "coffee", INTL, "كوب وسط (350 مل)", "1 medium cup (350ml)", 350, 0.5, 2, 0, sugar=0, sodium=10, tags=["caffeine", "diabetic_friendly", "low_calorie"], quality="reference", sizes="drink")
add("لاتيه", "Latte", "beverage", "coffee", INTL, "كوب وسط (350 مل)", "1 medium cup (350ml)", 350, 10, 15, 7, sugar=14, sodium=130, tags=["caffeine", "contains_lactose"], sizes="drink")
add("كابتشينو", "Cappuccino", "beverage", "coffee", INTL, "كوب وسط (240 مل)", "1 medium cup (240ml)", 240, 6, 8, 4, sugar=7, sodium=80, tags=["caffeine", "contains_lactose"], sizes="drink")
add("موكا", "Caffe Mocha", "beverage", "coffee", INTL, "كوب وسط (350 مل)", "1 medium cup (350ml)", 350, 10, 30, 9, sugar=26, sodium=140, tags=["caffeine", "contains_lactose", "high_sugar"], sizes="drink")
add("كراميل ماكياتو", "Caramel Macchiato", "beverage", "coffee", INTL, "كوب وسط (350 مل)", "1 medium cup (350ml)", 350, 9, 34, 8, sugar=30, sodium=150, tags=["caffeine", "contains_lactose", "high_sugar"], sizes="drink")
add("فرابتشينو", "Frappuccino", "beverage", "coffee", INTL, "كوب وسط (350 مل)", "1 medium cup (350ml)", 350, 5, 45, 12, sugar=40, sodium=160, tags=["caffeine", "contains_lactose", "high_sugar"], sizes="drink")
add("هوت شوكليت", "Hot Chocolate", "beverage", "coffee", INTL, "كوب وسط (300 مل)", "1 medium cup (300ml)", 300, 9, 32, 9, fiber=2, sugar=28, sodium=160, tags=["contains_lactose", "high_sugar", "caffeine"], sizes="drink")
add("شاي أسود (بدون سكر)", "Black Tea (Unsweetened)", "beverage", "tea", ALL_ARAB + INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 0.5, 0, sugar=0, sodium=5, tags=["caffeine", "diabetic_friendly", "low_calorie"], quality="reference", sizes="drink")
add("شاي بالسكر", "Tea with Sugar", "beverage", "tea", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 10.5, 0, sugar=10, sodium=5, tags=["caffeine"], sizes="drink")
add("شاي كرك", "Karak Tea", "beverage", "tea", ["gulf"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 4, 18, 5, sugar=16, sodium=80, tags=["caffeine", "contains_lactose"], sizes="drink")
add("شاي كرك بالزعفران", "Saffron Karak Tea", "beverage", "tea", ["gulf"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 4, 20, 5, sugar=18, sodium=80, tags=["caffeine", "contains_lactose", "high_sugar"], sizes="drink")
add("شاي مغربي بالنعناع", "Moroccan Mint Tea", "beverage", "tea", ["maghreb"], "كوب صغير (150 مل)", "1 small glass (150ml)", 150, 0, 8, 0, sugar=8, sodium=3, tags=["caffeine"], sizes="drink")
add("شاي بالحليب", "Tea with Milk", "beverage", "tea", ["egypt"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 3, 12, 3, sugar=10, sodium=60, tags=["caffeine", "contains_lactose"], sizes="drink")
add("شاي أخضر", "Green Tea", "beverage", "tea", INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 0.3, 0, sugar=0, sodium=2, tags=["caffeine", "diabetic_friendly", "low_calorie", "heart_healthy"], quality="reference", sizes="drink")
add("شاي مثلج محلى", "Iced Tea Sweetened", "beverage", "tea", INTL, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 22, 0, sugar=21, sodium=10, tags=["caffeine", "high_sugar"], sizes="drink")
add("ماتشا لاتيه", "Matcha Latte", "beverage", "tea", INTL, "كوب وسط (300 مل)", "1 medium cup (300ml)", 300, 8, 20, 6, fiber=1, sugar=18, sodium=100, tags=["caffeine", "contains_lactose"], sizes="drink")
add("كركديه بارد", "Cold Hibiscus (Karkadeh)", "beverage", "herbal", ["egypt", "north_africa"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 12, 0, sugar=11, sodium=5, tags=[], sizes="drink")
add("كركديه ساخن (بدون سكر)", "Hot Hibiscus (Unsweetened)", "beverage", "herbal", ["egypt", "north_africa"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 1, 0, sugar=0, sodium=5, tags=["diabetic_friendly", "low_calorie"], quality="reference", sizes="drink")
add("ينسون مغلي", "Anise Infusion (Yansoon)", "beverage", "herbal", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 2, 0, sugar=1, sodium=3, tags=["low_calorie", "diabetic_friendly"], quality="reference", sizes="drink")
add("نعناع مغلي", "Mint Infusion", "beverage", "herbal", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 1, 0, sugar=0, sodium=3, tags=["low_calorie", "diabetic_friendly"], quality="reference", sizes="drink")
add("بابونج مغلي", "Chamomile Infusion", "beverage", "herbal", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 1, 0, sugar=0, sodium=3, tags=["low_calorie", "diabetic_friendly"], quality="reference", sizes="drink")
add("زنجبيل مغلي", "Ginger Infusion", "beverage", "herbal", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 3, 0, sugar=1, sodium=4, tags=["low_calorie", "diabetic_friendly"], quality="reference", sizes="drink")
add("قرفة مغلية", "Cinnamon Infusion", "beverage", "herbal", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 2, 0, sugar=0.5, sodium=3, tags=["low_calorie", "diabetic_friendly"], quality="reference", sizes="drink")
add("حلبة مغلية", "Fenugreek Infusion (Helba)", "beverage", "herbal", ["egypt", "yemen"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 2, 5, 1, sugar=1, sodium=10, tags=["low_calorie"], sizes="drink")
add("سحلب", "Sahlab", "beverage", "hot_drinks", ["levant", "egypt"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 6, 28, 5, sugar=24, sodium=100, tags=["contains_lactose", "high_sugar", "contains_nuts"], sizes="drink")
add("قهوة بالحليب (بياض)", "White Coffee with Milk", "beverage", "coffee", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 7, 14, 6, sugar=12, sodium=100, tags=["caffeine", "contains_lactose"], sizes="drink")
add("عصير برتقال طازج", "Fresh Orange Juice", "beverage", "juices", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 1.7, 26, 0.3, fiber=0.5, sugar=21, sodium=2, tags=["high_sugar"], quality="reference", sizes="drink")
add("عصير تفاح طازج", "Fresh Apple Juice", "beverage", "juices", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0.2, 28, 0.3, fiber=0.2, sugar=24, sodium=10, tags=["high_sugar"], quality="reference", sizes="drink")
add("عصير مانجو طازج", "Fresh Mango Juice", "beverage", "juices", ["egypt"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 1, 30, 0.5, fiber=1, sugar=26, sodium=5, tags=["high_sugar"], sizes="drink")
add("عصير فراولة طازج", "Fresh Strawberry Juice", "beverage", "juices", ["egypt"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 1, 24, 0.3, fiber=1, sugar=20, sodium=3, tags=["high_sugar"], sizes="drink")
add("عصير جوافة طازج", "Fresh Guava Juice", "beverage", "juices", ["egypt"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 2, 26, 0.5, fiber=3, sugar=20, sodium=5, tags=["high_fiber"], sizes="drink")
add("عصير رمان طازج", "Fresh Pomegranate Juice", "beverage", "juices", ["levant"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0.5, 32, 0.3, fiber=0.2, sugar=30, sodium=8, tags=["high_sugar", "heart_healthy"], quality="reference", sizes="drink")
add("عصير ليمون طازج", "Fresh Lemonade", "beverage", "juices", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0.3, 22, 0, fiber=0.2, sugar=20, sodium=3, tags=["high_sugar"], sizes="drink")
add("ليمون بالنعناع", "Lemon Mint Juice", "beverage", "juices", ["levant"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0.3, 20, 0, fiber=0.5, sugar=18, sodium=3, tags=[], sizes="drink")
add("عصير عنب طازج", "Fresh Grape Juice", "beverage", "juices", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0.6, 37, 0.2, fiber=0.2, sugar=36, sodium=5, tags=["high_sugar"], quality="reference", sizes="drink")
add("عصير بطيخ طازج", "Fresh Watermelon Juice", "beverage", "juices", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 1.2, 18, 0.3, fiber=0.5, sugar=15, sodium=3, tags=[], sizes="drink")
add("عصير جزر طازج", "Fresh Carrot Juice", "beverage", "juices", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 1.5, 20, 0.3, fiber=1.5, sugar=14, sodium=100, tags=["heart_healthy"], sizes="drink")
add("عصير أفوكادو بالحليب", "Avocado Juice with Milk", "beverage", "juices", ["gulf"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 6, 24, 12, fiber=4, sugar=18, sodium=80, tags=["contains_lactose", "heart_healthy"], sizes="drink")
add("كوكتيل فواكه", "Fruit Cocktail Juice", "beverage", "juices", ["gulf", "levant"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 2, 30, 1, fiber=2, sugar=26, sodium=20, tags=["high_sugar"], sizes="drink")
add("عصير قصب", "Sugarcane Juice (Aseer Asab)", "beverage", "juices", ["egypt"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 40, 0, sugar=38, sodium=10, tags=["high_sugar"], sizes="drink")
add("عرقسوس", "Licorice Drink (Erk Sous)", "beverage", "traditional", ["egypt", "levant", "iraq"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 14, 0, sugar=12, sodium=15, tags=["hypertension_caution"], sizes="drink")
add("جلاب", "Jallab", "beverage", "traditional", ["levant"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0.5, 32, 0.2, sugar=30, sodium=10, tags=["high_sugar", "contains_nuts"], sizes="drink")
add("تمر هندي (مشروب)", "Tamarind Drink", "beverage", "traditional", ["egypt", "levant", "gulf"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0.5, 28, 0.1, sugar=26, sodium=15, tags=["high_sugar"], sizes="drink")
add("سوبيا", "Sobia Drink", "beverage", "traditional", ["egypt", "gulf"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 3, 24, 4, sugar=20, sodium=50, tags=["contains_lactose", "high_sugar"], sizes="drink")
add("خروب (مشروب)", "Carob Drink (Kharroub)", "beverage", "traditional", ["egypt"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0.5, 26, 0.2, fiber=2, sugar=22, sodium=10, tags=["high_sugar"], sizes="drink")
add("قمر الدين", "Qamar Al-Din (Apricot Drink)", "beverage", "traditional", ["egypt", "levant"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 1, 30, 0.2, fiber=2, sugar=26, sodium=10, tags=["high_sugar"], sizes="drink")
add("شراب الورد", "Rose Syrup Drink", "beverage", "traditional", ["gulf"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 28, 0, sugar=27, sodium=5, tags=["high_sugar"], sizes="drink")
add("مشروب غازي (كولا)", "Cola Soft Drink", "beverage", "soft_drinks", ALL_ARAB + INTL, "علبة (330 مل)", "1 can (330ml)", 330, 0, 35, 0, sugar=35, sodium=15, tags=["high_sugar", "caffeine", "processed"], quality="reference", sizes="drink")
add("مشروب غازي دايت", "Diet Cola", "beverage", "soft_drinks", ALL_ARAB + INTL, "علبة (330 مل)", "1 can (330ml)", 330, 0, 0.3, 0, sugar=0, sodium=40, tags=["caffeine", "processed", "diabetic_friendly", "low_calorie"], quality="reference", sizes="drink")
add("مشروب غازي بالليمون", "Lemon-Lime Soft Drink", "beverage", "soft_drinks", ALL_ARAB + INTL, "علبة (330 مل)", "1 can (330ml)", 330, 0, 34, 0, sugar=34, sodium=30, tags=["high_sugar", "processed"], quality="reference", sizes="drink")
add("مشروب طاقة", "Energy Drink", "beverage", "soft_drinks", ALL_ARAB + INTL, "علبة (250 مل)", "1 can (250ml)", 250, 0, 28, 0, sugar=27, sodium=100, tags=["high_sugar", "caffeine", "processed"], quality="reference", sizes=[])
add("عصير معلب (نكتار)", "Canned Nectar Juice", "beverage", "juices", ALL_ARAB, "علبة (240 مل)", "1 can (240ml)", 240, 0.5, 30, 0, sugar=28, sodium=15, tags=["high_sugar", "processed"], quality="reference", sizes="drink")
add("مشروب بودرة بنكهة الفواكه", "Powdered Fruit Drink", "beverage", "soft_drinks", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 0, 24, 0, sugar=23, sodium=20, tags=["high_sugar", "processed"], sizes="drink")
add("سموذي موز بالحليب", "Banana Milk Smoothie", "beverage", "smoothies", ALL_ARAB, "كوب واحد (300 مل)", "1 cup (300ml)", 300, 8, 34, 5, fiber=3, sugar=26, sodium=100, tags=["contains_lactose"], sizes="drink")
add("سموذي توت بالزبادي", "Berry Yogurt Smoothie", "beverage", "smoothies", INTL, "كوب واحد (300 مل)", "1 cup (300ml)", 300, 9, 30, 3, fiber=4, sugar=24, sodium=90, tags=["contains_lactose", "heart_healthy"], sizes="drink")
add("ميلك شيك فانيلا", "Vanilla Milkshake", "beverage", "smoothies", INTL, "كوب وسط (350 مل)", "1 medium cup (350ml)", 350, 9, 50, 14, sugar=44, sodium=180, tags=["contains_lactose", "high_sugar"], sizes="drink")
add("ميلك شيك شوكولاتة", "Chocolate Milkshake", "beverage", "smoothies", INTL, "كوب وسط (350 مل)", "1 medium cup (350ml)", 350, 10, 55, 15, sugar=48, sodium=200, tags=["contains_lactose", "high_sugar"], sizes="drink")
add("موهيتو نعناع (بدون كحول)", "Virgin Mint Mojito", "beverage", "soft_drinks", INTL, "كوب واحد (300 مل)", "1 cup (300ml)", 300, 0.2, 24, 0, sugar=22, sodium=10, tags=["high_sugar"], sizes="drink")

# ===========================================================================
# 17) FAST FOOD & INTERNATIONAL — وجبات سريعة وعالمية
# ===========================================================================
add("شاورما دجاج (صاروخ)", "Chicken Shawarma Sandwich", "fast_food", "sandwiches", ["levant", "gulf"], "ساندويتش وسط", "1 medium sandwich", 250, 24, 45, 14, fiber=2, sugar=2, sodium=900, tags=["contains_gluten", "processed"])
add("شاورما لحم (صاروخ)", "Meat Shawarma Sandwich", "fast_food", "sandwiches", ["levant", "gulf"], "ساندويتش وسط", "1 medium sandwich", 250, 22, 45, 18, fiber=2, sugar=2, sodium=950, tags=["contains_gluten", "processed", "high_sodium"])
add("صحن شاورما دجاج", "Chicken Shawarma Plate", "fast_food", "plates", ["levant", "gulf"], "صحن وسط", "1 medium plate", 350, 32, 30, 18, fiber=3, sugar=3, sodium=950, tags=["high_protein", "processed"])
add("ساندويتش فلافل", "Falafel Sandwich", "fast_food", "sandwiches", ALL_ARAB, "ساندويتش وسط", "1 medium sandwich", 250, 10, 45, 14, fiber=6, sugar=2, sodium=800, tags=["contains_gluten", "fried"])
add("سمبوسة جبن", "Cheese Samboosa", "fast_food", "samboosa", ["gulf"], "3 قطع", "3 pieces", 90, 6, 24, 12, fiber=1, sugar=1, sodium=450, tags=["contains_gluten", "contains_lactose", "fried"])
add("سمبوسة لحم", "Meat Samboosa", "fast_food", "samboosa", ["gulf"], "3 قطع", "3 pieces", 90, 7, 24, 12, fiber=1, sugar=1, sodium=500, tags=["contains_gluten", "fried"])
add("سمبوسة خضار", "Vegetable Samboosa", "fast_food", "samboosa", ["gulf"], "3 قطع", "3 pieces", 90, 3, 26, 10, fiber=2, sugar=2, sodium=400, tags=["contains_gluten", "fried"])
add("سمبوسة دجاج", "Chicken Samboosa", "fast_food", "samboosa", ["gulf"], "3 قطع", "3 pieces", 90, 7, 24, 11, fiber=1, sugar=1, sodium=480, tags=["contains_gluten", "fried"])
add("برجر لحم", "Beef Burger", "fast_food", "burgers", INTL, "ساندويتش وسط", "1 medium sandwich", 220, 20, 40, 16, fiber=2, sugar=6, sodium=800, tags=["contains_gluten", "processed", "refined_carb"])
add("تشيز برجر", "Cheeseburger", "fast_food", "burgers", INTL, "ساندويتش وسط", "1 medium sandwich", 250, 22, 40, 20, fiber=2, sugar=7, sodium=950, tags=["contains_gluten", "contains_lactose", "processed", "high_sodium"])
add("دبل تشيز برجر", "Double Cheeseburger", "fast_food", "burgers", INTL, "ساندويتش كبير", "1 large sandwich", 350, 35, 42, 32, fiber=2, sugar=8, sodium=1300, tags=["contains_gluten", "contains_lactose", "processed", "high_sodium", "high_protein"])
add("برجر دجاج مقلي", "Fried Chicken Burger", "fast_food", "burgers", INTL, "ساندويتش وسط", "1 medium sandwich", 250, 18, 45, 18, fiber=2, sugar=6, sodium=900, tags=["contains_gluten", "fried", "processed"])
add("برجر دجاج مشوي", "Grilled Chicken Burger", "fast_food", "burgers", INTL, "ساندويتش وسط", "1 medium sandwich", 230, 24, 42, 10, fiber=2, sugar=6, sodium=800, tags=["contains_gluten", "processed", "high_protein"])
add("بطاطس مقلية (وسط)", "French Fries (Medium)", "fast_food", "sides", INTL, "علبة وسط", "1 medium box", 120, 3.5, 45, 14, fiber=4, sugar=0.5, sodium=350, tags=["fried", "refined_carb"], quality="reference")
add("بطاطس مقلية (كبير)", "French Fries (Large)", "fast_food", "sides", INTL, "علبة كبيرة", "1 large box", 160, 4.5, 60, 19, fiber=5, sugar=0.7, sodium=470, tags=["fried", "refined_carb"], quality="reference")
add("أصابع موزاريلا", "Mozzarella Sticks", "fast_food", "sides", INTL, "5 أصابع", "5 sticks", 150, 12, 18, 16, fiber=1, sugar=1, sodium=600, tags=["contains_lactose", "contains_gluten", "fried"])
add("حلقات بصل مقلية", "Onion Rings", "fast_food", "sides", INTL, "8 حلقات", "8 rings", 120, 3, 25, 14, fiber=1.5, sugar=3, sodium=450, tags=["contains_gluten", "fried"])
add("ناجتس دجاج", "Chicken Nuggets", "fast_food", "sides", INTL, "6 قطع", "6 pieces", 100, 14, 12, 14, fiber=0.5, sodium=500, tags=["fried", "processed", "contains_gluten"], quality="reference")
add("بيتزا مارغريتا", "Margherita Pizza", "fast_food", "pizza", INTL, "شريحة كبيرة", "1 large slice", 120, 8, 24, 8, fiber=1.5, sugar=3, sodium=500, tags=["contains_gluten", "contains_lactose", "refined_carb"])
add("بيتزا خضار", "Vegetable Pizza", "fast_food", "pizza", INTL, "شريحة كبيرة", "1 large slice", 130, 7, 25, 8, fiber=2, sugar=4, sodium=480, tags=["contains_gluten", "contains_lactose"])
add("بيتزا بيبروني", "Pepperoni Pizza", "fast_food", "pizza", INTL, "شريحة كبيرة", "1 large slice", 130, 9, 24, 11, fiber=1.5, sugar=3, sodium=650, tags=["contains_gluten", "contains_lactose", "processed", "high_sodium"])
add("بيتزا دجاج باربكيو", "BBQ Chicken Pizza", "fast_food", "pizza", INTL, "شريحة كبيرة", "1 large slice", 130, 10, 26, 9, fiber=1.5, sugar=6, sodium=600, tags=["contains_gluten", "contains_lactose"])
add("بيتزا أربع أجبان", "Four Cheese Pizza", "fast_food", "pizza", INTL, "شريحة كبيرة", "1 large slice", 125, 10, 23, 12, fiber=1, sugar=3, sodium=600, tags=["contains_gluten", "contains_lactose"])
add("هوت دوج ساندويتش", "Hot Dog Sandwich", "fast_food", "sandwiches", INTL, "ساندويتش واحد", "1 sandwich", 150, 10, 25, 16, fiber=1, sugar=4, sodium=800, tags=["contains_gluten", "processed", "high_sodium"])
add("كلوب ساندويتش", "Club Sandwich", "fast_food", "sandwiches", INTL, "ساندويتش وسط", "1 medium sandwich", 300, 24, 35, 16, fiber=2, sugar=4, sodium=900, tags=["contains_gluten", "contains_egg", "processed"])
add("ساندويتش تونة بالمايونيز", "Tuna Mayo Sandwich", "fast_food", "sandwiches", INTL, "ساندويتش وسط", "1 medium sandwich", 220, 16, 35, 12, fiber=2, sugar=3, sodium=700, tags=["contains_gluten", "contains_seafood"])
add("راب دجاج مشوي", "Grilled Chicken Wrap", "fast_food", "sandwiches", INTL, "راب وسط", "1 medium wrap", 250, 24, 35, 12, fiber=2, sugar=3, sodium=800, tags=["contains_gluten", "high_protein"])
add("كوردون بلو دجاج", "Chicken Cordon Bleu", "fast_food", "plates", INTL, "قطعة وسط", "1 medium piece", 200, 28, 12, 18, fiber=0.5, sugar=1, sodium=750, tags=["contains_gluten", "contains_lactose", "fried", "high_protein"])
add("إسكالوب دجاج مقلي", "Fried Chicken Escalope", "fast_food", "plates", INTL, "قطعة وسط", "1 medium piece", 180, 26, 14, 16, fiber=0.5, sugar=1, sodium=600, tags=["contains_gluten", "fried", "high_protein"])
add("باستا ألفريدو بالدجاج", "Chicken Alfredo Pasta", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 350, 28, 55, 22, fiber=3, sugar=3, sodium=850, tags=["contains_gluten", "contains_lactose"])
add("باستا بولونيز", "Spaghetti Bolognese", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 350, 24, 60, 14, fiber=4, sugar=8, sodium=800, tags=["contains_gluten"])
add("باستا بالصلصة والخضار", "Pasta with Tomato Vegetable Sauce", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 320, 10, 60, 6, fiber=5, sugar=8, sodium=550, tags=["contains_gluten", "heart_healthy"])
add("لازانيا باللحم", "Beef Lasagna", "fast_food", "pasta", INTL, "قطعة وسط", "1 medium piece", 300, 22, 35, 20, fiber=3, sugar=6, sodium=850, tags=["contains_gluten", "contains_lactose"])
add("نودلز بالدجاج", "Chicken Noodles", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 320, 20, 50, 12, fiber=2, sugar=4, sodium=1000, tags=["contains_gluten", "high_sodium"])
add("نودلز بالخضار", "Vegetable Noodles", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 300, 8, 52, 10, fiber=3, sugar=4, sodium=900, tags=["contains_gluten", "high_sodium"])
add("أرز مقلي بالخضار", "Vegetable Fried Rice", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 300, 8, 52, 10, fiber=2, sugar=3, sodium=800, tags=["fried", "refined_carb"])
add("أرز مقلي بالدجاج", "Chicken Fried Rice", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 330, 18, 52, 12, fiber=2, sugar=3, sodium=900, tags=["fried", "refined_carb"])
add("دجاج حلو حامض", "Sweet and Sour Chicken", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 320, 22, 35, 14, fiber=1, sugar=20, sodium=850, tags=["fried", "high_sugar"])
add("دجاج بالكاجو", "Cashew Chicken", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 320, 26, 20, 16, fiber=2, sugar=6, sodium=900, tags=["contains_nuts", "high_protein"])
add("لحم بالبروكلي", "Beef with Broccoli", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 300, 24, 15, 14, fiber=4, sugar=5, sodium=950, tags=["high_protein"])
add("سبرينغ رول خضار", "Vegetable Spring Rolls", "fast_food", "asian", INTL, "3 قطع", "3 pieces", 120, 4, 20, 10, fiber=2, sugar=2, sodium=400, tags=["contains_gluten", "fried"])
add("سوشي سلمون", "Salmon Sushi", "fast_food", "asian", INTL, "6 قطع", "6 pieces", 180, 14, 30, 5, fiber=1, sugar=4, sodium=500, tags=["contains_seafood", "refined_carb"], quality="reference")
add("سوشي تونة", "Tuna Sushi", "fast_food", "asian", INTL, "6 قطع", "6 pieces", 180, 16, 30, 3, fiber=1, sugar=4, sodium=480, tags=["contains_seafood", "refined_carb"], quality="reference")
add("كاليفورنيا رول", "California Roll", "fast_food", "asian", INTL, "6 قطع", "6 pieces", 190, 8, 34, 6, fiber=2, sugar=5, sodium=550, tags=["contains_seafood", "refined_carb"], quality="reference")
add("كاري دجاج بالأرز", "Chicken Curry with Rice", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 400, 26, 65, 16, fiber=3, sugar=5, sodium=850, tags=["refined_carb"])
add("دجاج تكا", "Chicken Tikka", "fast_food", "asian", INTL, "4 قطع", "4 pieces", 180, 28, 5, 10, fiber=1, sugar=3, sodium=600, tags=["high_protein"], quality="reference")
add("باتر تشيكن بالأرز", "Butter Chicken with Rice", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 400, 26, 60, 20, fiber=2, sugar=8, sodium=900, tags=["contains_lactose"])
add("تاكو لحم", "Beef Tacos", "fast_food", "mexican", INTL, "2 قطعة", "2 pieces", 200, 16, 25, 14, fiber=3, sugar=2, sodium=700, tags=["contains_gluten", "contains_lactose"])
add("بوريتو دجاج", "Chicken Burrito", "fast_food", "mexican", INTL, "قطعة وسط", "1 medium piece", 350, 26, 55, 14, fiber=6, sugar=3, sodium=950, tags=["contains_gluten", "high_fiber"])
add("كيساديا جبن", "Cheese Quesadilla", "fast_food", "mexican", INTL, "قطعة وسط", "1 medium piece", 180, 12, 25, 14, fiber=1, sugar=2, sodium=700, tags=["contains_gluten", "contains_lactose"])
add("ناتشوز بالجبن", "Nachos with Cheese", "fast_food", "mexican", INTL, "صحن وسط", "1 medium plate", 200, 10, 35, 18, fiber=3, sugar=2, sodium=800, tags=["contains_lactose", "processed", "fried"])
add("فاهيتا دجاج", "Chicken Fajita", "fast_food", "mexican", INTL, "صحن وسط مع 2 خبزة", "1 medium plate with 2 tortillas", 350, 28, 35, 12, fiber=4, sugar=5, sodium=850, tags=["contains_gluten", "high_protein"])
add("كباب حلبي بالصحن", "Aleppo Kebab Plate", "fast_food", "plates", ["levant"], "صحن وسط مع خبز", "1 medium plate with bread", 350, 28, 35, 18, fiber=2, sugar=3, sodium=850, tags=["contains_gluten", "high_protein"])
add("مكس مشاوي", "Mixed Grill Plate", "fast_food", "plates", ALL_ARAB, "صحن وسط", "1 medium plate", 400, 45, 10, 24, fiber=1, sugar=2, sodium=900, tags=["high_protein"])
add("صحن مقبلات مشكلة (مزة)", "Mixed Mezze Platter", "fast_food", "plates", ["levant"], "صحن وسط", "1 medium plate", 350, 12, 35, 20, fiber=6, sugar=4, sodium=900, tags=["contains_lactose", "high_sodium"])
add("دجاج مسحب (شواية) مع صلصة", "Pulled Chicken with Sauce", "fast_food", "plates", INTL, "صحن وسط", "1 medium plate", 300, 30, 15, 10, fiber=1, sugar=8, sodium=850, tags=["high_protein"])

# ===========================================================================
# 18) CONDIMENTS, SPICES & SAUCES — توابل وصلصات
# ===========================================================================
SPICES = [
    ("ملح طعام", "Table Salt", 0, 0, 0, 38758, ["high_sodium"]),
    ("فلفل أسود مطحون", "Ground Black Pepper", 10.4, 63.9, 3.3, 20, []),
    ("كمون مطحون", "Ground Cumin", 17.8, 44.2, 22.3, 168, []),
    ("كركم مطحون", "Ground Turmeric", 9.7, 67.1, 3.3, 27, ["heart_healthy"]),
    ("بهارات مشكلة", "Mixed Spices (Baharat)", 12, 55, 8, 50, []),
    ("بهارات الكبسة", "Kabsa Spice Mix", 11, 52, 7, 800, ["high_sodium"]),
    ("بهارات المندي", "Mandi Spice Mix", 11, 52, 7, 800, ["high_sodium"]),
    ("بهارات البرياني", "Biryani Spice Mix", 11, 52, 7, 750, ["high_sodium"]),
    ("كاري مطحون", "Curry Powder", 14.3, 55.8, 14, 52, []),
    ("هيل مطحون", "Ground Cardamom", 10.8, 68.5, 6.7, 18, []),
    ("قرفة مطحونة", "Ground Cinnamon", 4, 80.6, 1.2, 10, []),
    ("قرنفل مطحون", "Ground Cloves", 6, 65.5, 13, 277, []),
    ("زعفران", "Saffron", 11.4, 61.5, 5.9, 148, []),
    ("سماق", "Sumac", 6, 55, 5, 30, ["heart_healthy"]),
    ("زعتر مجفف", "Dried Thyme", 9, 63.9, 7.4, 55, []),
    ("أوريغانو مجفف", "Dried Oregano", 9, 68.9, 4.3, 25, []),
    ("ريحان مجفف", "Dried Basil", 23, 47.7, 4.1, 76, []),
    ("بابريكا", "Paprika", 14.1, 54, 12.9, 68, []),
    ("شطة مجروشة", "Crushed Chili Flakes", 12, 56.6, 17.3, 30, []),
    ("لومي أسود (نومي بصرة)", "Dried Black Lime (Noomi Basra)", 3, 65, 1, 40, []),
    ("حبة البركة", "Black Seeds (Nigella)", 16.7, 42.6, 30.4, 88, []),
    ("شمر (بذور)", "Fennel Seeds", 15.8, 52.3, 14.9, 88, []),
    ("كزبرة ناشفة مطحونة", "Ground Coriander", 12.4, 55, 17.8, 35, []),
    ("ثوم بودرة", "Garlic Powder", 16.6, 72.7, 0.7, 60, []),
    ("بصل بودرة", "Onion Powder", 10.4, 79.1, 1, 60, []),
    ("زنجبيل مطحون", "Ground Ginger", 9, 71.6, 4.2, 27, []),
]
for (ar, en, p, c, f, na, xt) in SPICES:
    add100(ar, en, "condiment", "spices", ALL_ARAB, "ملعقة صغيرة (2 غ)", "1 tsp (2g)", 2,
           p, c, f, na100=na, tags=xt,
           sizes=[("ملعقة كبيرة", "1 tbsp", 3.0)])

SAUCES = [
    # name_ar, name_en, p, c, f, sugar, sodium (per 100g), tags
    ("كاتشب", "Ketchup", 1, 27.4, 0.1, 22.8, 907, ["processed", "high_sugar", "high_sodium"]),
    ("مايونيز", "Mayonnaise", 1, 0.6, 75, 0.6, 635, ["contains_egg", "processed"]),
    ("مايونيز لايت", "Light Mayonnaise", 1, 5, 33, 4, 700, ["contains_egg", "processed"]),
    ("خردل (مستردة)", "Mustard", 4.4, 5.3, 4.4, 1, 1135, ["high_sodium"]),
    ("صويا صوص", "Soy Sauce", 8.1, 5.6, 0.1, 1.7, 5586, ["high_sodium", "contains_gluten"]),
    ("صلصة حارة", "Hot Sauce", 2, 4, 0.5, 2, 2643, ["high_sodium"]),
    ("صلصة باربكيو", "BBQ Sauce", 1, 40, 0.5, 33, 1000, ["high_sugar", "high_sodium", "processed"]),
    ("صلصة الثوم (توم)", "Garlic Sauce (Toum)", 2, 6, 60, 1, 400, []),
    ("طراطور (طحينة بالليمون)", "Tarator (Tahini Lemon Sauce)", 8, 8, 25, 1, 350, []),
    ("صلصة رانش", "Ranch Dressing", 1, 5.9, 50, 2.3, 800, ["contains_lactose", "contains_egg", "processed"]),
    ("صلصة سيزر", "Caesar Dressing", 3, 4, 55, 2, 900, ["contains_lactose", "contains_egg", "processed"]),
    ("صلصة طماطم مطبوخة", "Cooked Tomato Sauce", 1.6, 9, 1.5, 5, 400, []),
    ("معجون طماطم", "Tomato Paste", 4.3, 19, 0.5, 12, 60, []),
    ("صلصة بيستو", "Pesto Sauce", 5, 6, 45, 1, 700, ["contains_nuts", "contains_lactose"]),
    ("خل تفاح", "Apple Cider Vinegar", 0, 0.9, 0, 0.4, 5, ["diabetic_friendly", "low_calorie"]),
    ("خل أبيض", "White Vinegar", 0, 0, 0, 0, 2, ["low_calorie"]),
    ("دقة فلفل أحمر", "Red Pepper Dakka", 3, 12, 15, 3, 900, ["high_sodium"]),
    ("شطة سودانية", "Sudanese Shatta", 2, 8, 3, 2, 700, ["high_sodium"]),
    ("هريسة حارة", "Harissa Paste", 2, 10, 8, 2, 1500, ["high_sodium"]),
    ("صلصة سويت آند ساور", "Sweet and Sour Sauce", 0.5, 35, 0.2, 28, 550, ["high_sugar", "processed"]),
    ("صلصة ترياكي", "Teriyaki Sauce", 3, 16, 0.1, 13, 3800, ["high_sodium", "high_sugar", "contains_gluten"]),
    ("مكعب مرق دجاج", "Chicken Stock Cube", 8, 15, 20, 2, 20000, ["high_sodium", "processed"]),
]
for (ar, en, p, c, f, sug, na, xt) in SAUCES:
    add100(ar, en, "condiment", "sauces", ALL_ARAB, "ملعقة كبيرة (15 غ)", "1 tbsp (15g)", 15,
           p, c, f, sug100=sug, na100=na, tags=xt,
           sizes=[("ملعقتان كبيرتان", "2 tbsp", 2.0)])

add("مخلل خيار", "Pickled Cucumber", "condiment", "pickles", ALL_ARAB, "3 حبات صغيرة", "3 small pieces", 60, 0.5, 2.5, 0.2, fiber=0.8, sugar=1, sodium=700, tags=["high_sodium", "processed"], quality="reference")
add("مخلل مشكل (طرشي)", "Mixed Pickles (Torshi)", "condiment", "pickles", ["iraq", "levant", "egypt"], "نصف كوب", "1/2 cup", 80, 0.8, 4, 0.3, fiber=1.5, sugar=1.5, sodium=900, tags=["high_sodium", "processed"])
add("عنبة (صلصة التمر الهندي)", "Amba (Mango Pickle Sauce)", "condiment", "pickles", ["iraq"], "ملعقتان كبيرتان", "2 tbsp", 30, 0.5, 8, 0.5, fiber=1, sugar=5, sodium=400, tags=["processed"])
add("زيتون مخلل بالليمون", "Lemon Pickled Olives", "condiment", "pickles", ["maghreb"], "8 حبات", "8 pieces", 40, 0.4, 1.5, 4.5, fiber=1.3, sugar=0, sodium=650, tags=["high_sodium"])

# ===========================================================================
# 19) PACKAGED FOODS & SNACKS — منتجات معلبة وتسالي
# ===========================================================================
add("شيبس بطاطس", "Potato Chips", "packaged_snack", "chips", ALL_ARAB + INTL, "كيس صغير (30 غ)", "1 small bag (30g)", 30, 2, 15, 10, fiber=1.3, sugar=0.5, sodium=170, tags=["fried", "processed", "high_sodium"], quality="reference")
add("شيبس بالجبن", "Cheese Chips", "packaged_snack", "chips", ALL_ARAB, "كيس صغير (30 غ)", "1 small bag (30g)", 30, 2, 14, 10, fiber=1, sugar=1, sodium=200, tags=["fried", "processed", "high_sodium", "contains_lactose"])
add("ذرة صفراء مقرمشة (تشيتوس)", "Corn Puffs", "packaged_snack", "chips", ALL_ARAB, "كيس صغير (30 غ)", "1 small bag (30g)", 30, 1.5, 17, 9, fiber=0.5, sugar=1, sodium=220, tags=["fried", "processed", "high_sodium"])
add("بفك", "Pofaki (Cheese Puffs)", "packaged_snack", "chips", ["gulf", "levant"], "كيس صغير (30 غ)", "1 small bag (30g)", 30, 1.5, 16, 10, fiber=0.5, sugar=1, sodium=230, tags=["fried", "processed", "contains_lactose"])
add("فشار سادة (بوب كورن)", "Plain Popcorn", "packaged_snack", "popcorn", ALL_ARAB, "3 أكواب", "3 cups", 24, 3, 18, 1.2, fiber=3.5, sugar=0.2, sodium=2, tags=["whole_grain", "high_fiber", "low_calorie"], quality="reference")
add("فشار بالزبدة", "Buttered Popcorn", "packaged_snack", "popcorn", ALL_ARAB, "3 أكواب", "3 cups", 30, 3, 19, 7, fiber=3.5, sugar=0.2, sodium=200, tags=["whole_grain", "processed"])
add("رقائق تورتيلا", "Tortilla Chips", "packaged_snack", "chips", INTL, "حفنة (30 غ)", "1 handful (30g)", 30, 2, 18, 7, fiber=1.5, sugar=0.3, sodium=150, tags=["fried", "processed"])
add("بريتزل", "Pretzels", "packaged_snack", "chips", INTL, "حفنة (30 غ)", "1 handful (30g)", 30, 3, 23, 1, fiber=1, sugar=1, sodium=350, tags=["processed", "high_sodium", "contains_gluten"], quality="reference")
add("بسكويت أوريو", "Chocolate Sandwich Cookies", "packaged_snack", "biscuits", ALL_ARAB + INTL, "3 قطع", "3 pieces", 34, 1.5, 25, 7, fiber=1, sugar=14, sodium=130, tags=["processed", "high_sugar", "contains_gluten"], quality="reference")
add("ويفر بالشوكولاتة", "Chocolate Wafer", "packaged_snack", "biscuits", ALL_ARAB, "قطعتان", "2 pieces", 40, 2, 24, 10, fiber=0.5, sugar=14, sodium=60, tags=["processed", "high_sugar", "contains_gluten"])
add("شوكولاتة سنيكرز", "Snickers Bar", "packaged_snack", "chocolate", ALL_ARAB + INTL, "قطعة (50 غ)", "1 bar (50g)", 50, 4.5, 27, 12, fiber=1, sugar=22, sodium=120, tags=["processed", "high_sugar", "contains_nuts"], quality="reference")
add("شوكولاتة كيت كات", "Kit Kat", "packaged_snack", "chocolate", ALL_ARAB + INTL, "4 أصابع (45 غ)", "4 fingers (45g)", 45, 3, 26, 12, fiber=0.5, sugar=20, sodium=50, tags=["processed", "high_sugar", "contains_gluten"], quality="reference")
add("كيك معلب بالكريمة", "Packaged Cream Cake", "packaged_snack", "cakes", ALL_ARAB, "قطعة (40 غ)", "1 piece (40g)", 40, 2, 22, 9, fiber=0.5, sugar=15, sodium=150, tags=["processed", "high_sugar", "contains_gluten", "contains_egg"])
add("حلوى جيلي (سكاكر)", "Gummy Candies", "packaged_snack", "candy", ALL_ARAB, "حفنة (40 غ)", "1 handful (40g)", 40, 1, 32, 0, fiber=0, sugar=24, sodium=15, tags=["processed", "high_sugar"], quality="reference")
add("مصاصة (لوليبوب)", "Lollipop", "packaged_snack", "candy", ALL_ARAB, "2 قطعة", "2 pieces", 24, 0, 22, 0, sugar=18, sodium=5, tags=["processed", "high_sugar"], quality="reference")
add("بار طاقة بالشوكولاتة", "Chocolate Energy Bar", "packaged_snack", "bars", INTL, "قطعة (50 غ)", "1 bar (50g)", 50, 8, 28, 8, fiber=3, sugar=16, sodium=100, tags=["processed", "contains_nuts"])
add("بار بروتين", "Protein Bar", "packaged_snack", "bars", INTL, "قطعة (60 غ)", "1 bar (60g)", 60, 20, 22, 8, fiber=5, sugar=6, sodium=200, tags=["processed", "high_protein", "contains_nuts", "contains_lactose"])
add("بار جرانولا", "Granola Bar", "packaged_snack", "bars", INTL, "قطعة (35 غ)", "1 bar (35g)", 35, 3, 24, 5, fiber=2, sugar=10, sodium=60, tags=["processed", "whole_grain"])
add("مقرمشات أرز", "Rice Cakes", "packaged_snack", "chips", INTL, "3 قطع", "3 pieces", 27, 2, 22, 0.5, fiber=1, sugar=0.2, sodium=80, tags=["low_calorie", "processed"], quality="reference")
add("إندومي (شعيرية سريعة)", "Instant Noodles (Indomie)", "packaged_snack", "instant", ALL_ARAB, "كيس واحد مطبوخ", "1 pack cooked", 350, 8, 55, 14, fiber=2, sugar=2, sodium=1600, tags=["processed", "high_sodium", "fried", "contains_gluten"], quality="reference")
add("شوربة جاهزة بودرة", "Instant Powder Soup", "packaged_snack", "instant", ALL_ARAB, "كوب واحد", "1 cup", 240, 3, 15, 3, fiber=1, sugar=2, sodium=900, tags=["processed", "high_sodium", "contains_gluten"])
add("بطاطس بوريه سريعة التحضير", "Instant Mashed Potatoes", "packaged_snack", "instant", INTL, "كوب واحد محضر", "1 cup prepared", 210, 4, 30, 8, fiber=2, sugar=2, sodium=500, tags=["processed", "contains_lactose"])
add("فول معلب", "Canned Fava Beans", "packaged_snack", "canned", ["egypt", "gulf"], "علبة (200 غ مصفاة)", "1 can (200g drained)", 200, 12, 30, 2, fiber=9, sugar=2, sodium=600, tags=["processed", "high_fiber", "high_sodium"], quality="reference")
add("حمص معلب", "Canned Chickpeas", "packaged_snack", "canned", ALL_ARAB, "علبة (200 غ مصفاة)", "1 can (200g drained)", 200, 14, 40, 4, fiber=10, sugar=6, sodium=550, tags=["processed", "high_fiber"], quality="reference")
add("فاصوليا معلبة بصلصة الطماطم", "Canned Baked Beans", "packaged_snack", "canned", ALL_ARAB, "علبة (200 غ)", "1 can (200g)", 200, 10, 34, 1, fiber=8, sugar=12, sodium=700, tags=["processed", "high_sodium"], quality="reference")
add("ذرة معلبة", "Canned Corn", "packaged_snack", "canned", ALL_ARAB, "نصف كوب مصفى", "1/2 cup drained", 125, 3, 24, 1, fiber=2, sugar=5, sodium=300, tags=["processed"], quality="reference")
add("مشروم معلب", "Canned Mushrooms", "packaged_snack", "canned", ALL_ARAB, "نصف كوب مصفى", "1/2 cup drained", 100, 2, 3, 0.3, fiber=1.5, sugar=1, sodium=400, tags=["processed", "low_calorie"], quality="reference")
add("طماطم مقطعة معلبة", "Canned Diced Tomatoes", "packaged_snack", "canned", ALL_ARAB, "نصف كوب", "1/2 cup", 120, 1.5, 6, 0.2, fiber=1.5, sugar=4, sodium=300, tags=["processed", "low_calorie"], quality="reference")
add("شوربة عدس معلبة", "Canned Lentil Soup", "packaged_snack", "canned", ALL_ARAB, "علبة (300 مل)", "1 can (300ml)", 300, 9, 28, 3, fiber=6, sugar=3, sodium=900, tags=["processed", "high_sodium"])
add("هوت دوج معلب", "Canned Hot Dogs", "packaged_snack", "canned", ALL_ARAB, "3 قطع", "3 pieces", 120, 10, 3, 18, fiber=0, sodium=1000, tags=["processed", "high_sodium"])
add("لانشون دجاج", "Chicken Luncheon Meat", "packaged_snack", "canned", ALL_ARAB, "3 شرائح (60 غ)", "3 slices (60g)", 60, 8, 2, 10, fiber=0, sodium=550, tags=["processed", "high_sodium"])
add("روست بيف معلب", "Canned Roast Beef", "packaged_snack", "canned", ALL_ARAB, "3 شرائح (60 غ)", "3 slices (60g)", 60, 13, 1, 5, fiber=0, sodium=600, tags=["processed", "high_sodium"])
add("نودلز كوب سريعة", "Cup Noodles", "packaged_snack", "instant", ALL_ARAB, "كوب واحد مطبوخ", "1 cup prepared", 300, 6, 40, 12, fiber=1.5, sodium=1400, tags=["processed", "high_sodium", "fried", "contains_gluten"])
add("رقائق شوفان بالفواكه", "Fruit and Oat Cereal Bars", "packaged_snack", "bars", INTL, "قطعة (40 غ)", "1 bar (40g)", 40, 3, 28, 5, fiber=2, sugar=12, sodium=80, tags=["processed", "whole_grain"])
add("مكسرات محمصة معلبة", "Canned Roasted Nuts", "packaged_snack", "nuts", ALL_ARAB, "قبضة (30 غ)", "1 handful (30g)", 30, 5, 6, 15, fiber=2.5, sugar=1.5, sodium=200, tags=["contains_nuts", "processed"])
add("تمر محشي بالمكسرات", "Dates Stuffed with Nuts", "packaged_snack", "dates", ["gulf"], "3 حبات", "3 pieces", 45, 2, 30, 4, fiber=3, sugar=26, sodium=2, tags=["contains_nuts", "high_sugar"])
add("تمر مغطى بالشوكولاتة", "Chocolate Covered Dates", "packaged_snack", "dates", ["gulf"], "3 حبات", "3 pieces", 50, 1.5, 32, 5, fiber=2.5, sugar=28, sodium=10, tags=["high_sugar"])
add("سحلب جاهز بودرة", "Instant Sahlab Powder", "packaged_snack", "instant", ["levant", "egypt"], "كوب واحد محضر", "1 cup prepared", 240, 5, 26, 5, sugar=22, sodium=90, tags=["processed", "contains_lactose", "high_sugar"])
add("كاسترد جاهز بودرة", "Instant Custard Powder", "packaged_snack", "instant", ALL_ARAB, "كوب واحد محضر", "1 cup prepared", 240, 6, 24, 6, sugar=20, sodium=100, tags=["processed", "contains_lactose", "high_sugar"])
add("بودينغ شوكولاتة جاهز", "Ready Chocolate Pudding", "packaged_snack", "puddings", ALL_ARAB, "كوب صغير (100 غ)", "1 small cup (100g)", 100, 3, 20, 3, fiber=1, sugar=16, sodium=120, tags=["processed", "contains_lactose", "high_sugar"])
add("جيلو جاهز بودرة", "Instant Jello", "packaged_snack", "puddings", ALL_ARAB, "كوب صغير محضر", "1 small cup prepared", 120, 2, 24, 0, sugar=22, sodium=60, tags=["processed", "high_sugar"])
add("حليب مجفف (بودرة)", "Powdered Milk", "packaged_snack", "dairy", ALL_ARAB, "3 ملاعق كبيرة", "3 tbsp", 30, 8, 11, 8, sugar=11, sodium=110, tags=["contains_lactose", "processed"], quality="reference")
add("قهوة سريعة التحضير (نسكافيه)", "Instant Coffee", "packaged_snack", "coffee", ALL_ARAB, "ملعقة صغيرة", "1 tsp", 2, 0.1, 0.4, 0, sugar=0, sodium=1, tags=["caffeine", "processed", "low_calorie"], quality="reference")
add("قهوة 3 في 1", "3-in-1 Coffee Mix", "packaged_snack", "coffee", ALL_ARAB, "كيس واحد محضر", "1 sachet prepared", 180, 1, 14, 2.5, sugar=10, sodium=30, tags=["caffeine", "processed", "contains_lactose"], quality="reference")
add("مشروب شوكولاتة بودرة", "Chocolate Drink Powder", "packaged_snack", "powdered_drinks", ALL_ARAB, "كوب واحد محضر", "1 cup prepared", 240, 8, 28, 4, fiber=1, sugar=24, sodium=140, tags=["processed", "contains_lactose", "high_sugar"])
add("أصابع ذرة بالجبن", "Cheese Corn Sticks", "packaged_snack", "chips", ALL_ARAB, "كيس صغير (30 غ)", "1 small bag (30g)", 30, 1.5, 16, 10, fiber=0.5, sugar=1, sodium=240, tags=["fried", "processed", "contains_lactose"])
add("رقائق البطاطا المخبوزة", "Baked Potato Crisps", "packaged_snack", "chips", INTL, "كيس صغير (30 غ)", "1 small bag (30g)", 30, 2, 20, 3, fiber=1.5, sugar=1, sodium=180, tags=["processed"])

# ===========================================================================
# 20) ADDITIONAL CURATED FOODS (second layer, same quality bar)
# ===========================================================================
# --- More breads & flatbreads ---
add("خبز الشعير", "Barley Bread", "bread_grain", "breads", ["north_africa"], "رغيف صغير", "1 small loaf", 70, 5, 35, 1.5, fiber=5, sugar=1, sodium=250, tags=["whole_grain", "contains_gluten"], quality="reference")
add("خبز الذرة", "Cornbread", "bread_grain", "breads", INTL, "قطعة وسط", "1 medium piece", 80, 5, 32, 6, fiber=2, sugar=6, sodium=300, tags=["contains_egg", "contains_lactose"])
add("خبز الشوفان", "Oat Bread", "bread_grain", "breads", INTL, "شريحتان", "2 slices", 60, 5, 28, 2, fiber=3, sugar=2, sodium=240, tags=["whole_grain", "contains_gluten"], quality="reference")
add("خبز متعدد الحبوب", "Multigrain Bread", "bread_grain", "breads", INTL, "شريحتان", "2 slices", 60, 6, 27, 2, fiber=4, sugar=2, sodium=250, tags=["whole_grain", "contains_gluten"], quality="reference")
add("بغرير", "Baghrir (Thousand-Hole Pancake)", "bread_grain", "maghreb_breads", ["maghreb"], "2 قطعة", "2 pieces", 100, 5, 40, 2, fiber=2, sugar=2, sodium=300, tags=["contains_gluten"])
add("مسمن", "Msemen (Layered Flatbread)", "bread_grain", "maghreb_breads", ["maghreb"], "قطعة واحدة", "1 piece", 80, 4, 32, 10, fiber=1.5, sugar=1, sodium=250, tags=["contains_gluten"])
add("حرشة", "Harcha (Semolina Cake-Bread)", "bread_grain", "maghreb_breads", ["maghreb"], "قطعة واحدة", "1 piece", 70, 4, 30, 8, fiber=1, sugar=2, sodium=200, tags=["contains_gluten", "contains_lactose"])
add("ملوي", "Malawi (Flaky Flatbread)", "bread_grain", "maghreb_breads", ["maghreb"], "قطعة واحدة", "1 piece", 80, 4, 34, 10, fiber=1.5, sugar=1, sodium=250, tags=["contains_gluten"])
add("فطير مشلتت", "Feteer Meshaltet (Layered Pastry)", "bread_grain", "egypt_breads", ["egypt"], "قطعة وسط", "1 medium piece", 120, 6, 45, 18, fiber=1.5, sugar=1, sodium=300, tags=["contains_gluten", "contains_lactose"])
add("فطير بالعسل والقشطة", "Feteer with Honey and Cream", "bread_grain", "egypt_breads", ["egypt"], "قطعة وسط", "1 medium piece", 150, 7, 55, 20, fiber=1.5, sugar=24, sodium=300, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("كعك شامي بالسمسم", "Kaak Al-Quds (Sesame Bread Ring)", "bread_grain", "breads", ["levant"], "حلقة وسط", "1 medium ring", 90, 7, 45, 5, fiber=2, sugar=3, sodium=400, tags=["contains_gluten"])
add("سيميت تركي", "Turkish Simit", "bread_grain", "breads", INTL, "حلقة وسط", "1 medium ring", 100, 8, 50, 5, fiber=2, sugar=3, sodium=450, tags=["contains_gluten"])
add("باجل سادة", "Plain Bagel", "bread_grain", "breads", INTL, "قطعة واحدة", "1 piece", 100, 10, 52, 1.5, fiber=2, sugar=5, sodium=450, tags=["contains_gluten", "refined_carb"], quality="reference")
add("خبز إنجليزي مافن", "English Muffin", "bread_grain", "breads", INTL, "قطعة واحدة", "1 piece", 60, 5, 26, 1, fiber=2, sugar=1, sodium=250, tags=["contains_gluten"], quality="reference")
# --- More Gulf/Yemen mains ---
add("مشخول دجاج", "Chicken Mashkhool", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 400, 30, 82, 18, fiber=1.5, sugar=2, sodium=830)
add("مشخول لحم", "Meat Mashkhool", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 420, 32, 82, 22, fiber=1.5, sugar=2, sodium=860)
add("بخاري دجاج", "Chicken Bukhari Rice", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 410, 29, 82, 18, fiber=2, sugar=3, sodium=840)
add("بخاري لحم", "Meat Bukhari Rice", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 420, 31, 82, 22, fiber=2, sugar=3, sodium=870)
add("زربيان عدني بالدجاج", "Adeni Zurbian with Chicken", "rice_main", "gulf_mains", ["yemen"], "صحن وسط", "1 medium plate", 410, 30, 80, 19, fiber=2, sugar=2, sodium=850, tags=["contains_lactose"])
add("زربيان باللحم", "Zurbian with Meat", "rice_main", "gulf_mains", ["yemen"], "صحن وسط", "1 medium plate", 420, 32, 80, 23, fiber=2, sugar=2, sodium=870, tags=["contains_lactose"])
add("كبسة حاشي", "Camel Kabsa", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 420, 33, 84, 16, fiber=2, sugar=2, sodium=880, tags=["high_protein"])
add("مندي روبيان", "Shrimp Mandi", "rice_main", "gulf_mains", ["gulf", "yemen"], "صحن وسط", "1 medium plate", 400, 26, 82, 12, fiber=1.5, sugar=1, sodium=850, tags=["contains_seafood"])
add("برياني روبيان", "Shrimp Biryani", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 400, 25, 80, 14, fiber=2, sugar=2, sodium=880, tags=["contains_seafood"])
add("برياني خضار", "Vegetable Biryani", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 380, 10, 78, 14, fiber=5, sugar=5, sodium=750, tags=["high_fiber"])
add("سليق بالدجاج", "Saleeg with Chicken", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 400, 28, 62, 16, fiber=1, sugar=3, sodium=650, tags=["contains_lactose"])
add("مرقوق دجاج", "Margoug with Chicken", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 360, 24, 58, 10, fiber=4, sugar=3, sodium=720, tags=["contains_gluten"])
add("جريش بالدجاج", "Jareesh with Chicken", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium bowl", 320, 20, 52, 9, fiber=6, sugar=2, sodium=620, tags=["whole_grain", "contains_gluten"])
add("ثريد دجاج", "Thareed with Chicken", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 370, 26, 55, 14, fiber=4, sugar=3, sodium=740, tags=["contains_gluten"])
add("عريكة جنوبية بالتمر", "Areeka with Dates", "rice_main", "gulf_mains", ["yemen", "gulf"], "صحن وسط", "1 medium bowl", 300, 8, 60, 12, fiber=4, sugar=30, sodium=150, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("هريس بالدجاج", "Harees with Chicken", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium bowl", 320, 24, 45, 12, fiber=3, sugar=1, sodium=560, tags=["contains_gluten"])
add("مجبوس لحم", "Meat Majboos", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 420, 31, 84, 20, fiber=2, sugar=2, sodium=860)
add("مطازز دجاج", "Mataziz with Chicken", "rice_main", "gulf_mains", ["gulf"], "صحن وسط", "1 medium plate", 350, 22, 58, 10, fiber=3, sugar=3, sodium=700, tags=["contains_gluten"])
# --- More Levant mains ---
add("فريكة باللحم", "Freekeh with Meat", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 400, 28, 60, 16, fiber=6, sugar=2, sodium=720, tags=["whole_grain", "contains_gluten"])
add("مفتول بالدجاج", "Maftoul with Chicken", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 390, 28, 66, 12, fiber=5, sugar=2, sodium=700, tags=["contains_gluten"])
add("كبة بطاطا", "Potato Kibbeh", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 300, 8, 50, 10, fiber=3, sugar=2, sodium=600, tags=["contains_gluten"])
add("كوسا بلبن", "Zucchini in Yogurt Sauce (Kousa Bel Laban)", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium bowl", 320, 14, 20, 12, fiber=3, sugar=6, sodium=600, tags=["contains_lactose"])
add("محاشي باذنجان", "Stuffed Eggplant", "rice_main", "levant_mains", ["levant", "iraq"], "4 قطع", "4 pieces", 320, 12, 42, 12, fiber=5, sugar=4, sodium=700)
add("محاشي فلفل", "Stuffed Bell Peppers", "rice_main", "levant_mains", ["levant", "egypt"], "3 قطع", "3 pieces", 330, 12, 45, 10, fiber=4, sugar=5, sodium=680)
add("كبة سمك", "Fish Kibbeh", "rice_main", "levant_mains", ["levant", "iraq"], "صحن وسط", "1 medium plate", 300, 20, 35, 10, fiber=2, sugar=2, sodium=650, tags=["contains_seafood", "contains_gluten"])
add("رز بالكبد والمكسرات", "Rice with Liver and Nuts", "rice_main", "levant_mains", ["levant"], "صحن وسط", "1 medium plate", 380, 22, 65, 14, fiber=1.5, sugar=2, sodium=700, tags=["gout_caution", "contains_nuts"])
# --- More Egypt mains ---
add("أرز معمر بالفرن", "Baked Rice with Milk (Roz Meammar)", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium bowl", 300, 9, 50, 12, fiber=0.5, sugar=6, sodium=300, tags=["contains_lactose"])
add("أرز معمر بالدجاج", "Roz Meammar with Chicken", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium plate", 400, 28, 52, 16, fiber=0.5, sugar=5, sodium=600, tags=["contains_lactose"])
add("حمام بالفريك", "Pigeon with Freekeh", "rice_main", "egypt_mains", ["egypt"], "حمامة مع فريك", "1 pigeon with freekeh", 400, 32, 45, 16, fiber=5, sugar=2, sodium=750, tags=["contains_gluten"])
add("سمان محشي", "Stuffed Quail", "rice_main", "egypt_mains", ["egypt"], "2 طائر", "2 birds", 300, 28, 35, 14, fiber=2, sugar=1, sodium=700, tags=["contains_gluten"])
add("كشري بالدجاج", "Koshari with Chicken", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium plate", 450, 28, 88, 14, fiber=10, sugar=5, sodium=800, tags=["high_fiber", "contains_gluten"])
add("فتة بالكوارع", "Fattah with Trotters", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium plate", 400, 24, 62, 18, fiber=3, sugar=3, sodium=880, tags=["contains_gluten", "kidney_caution"])
add("بامية بالسجق", "Okra with Sujuk", "rice_main", "egypt_mains", ["egypt"], "صحن وسط", "1 medium bowl", 320, 16, 18, 18, fiber=5, sugar=4, sodium=850, tags=["processed", "high_sodium"])
# --- More Iraq mains ---
add("قوزي دجاج", "Quzi with Chicken", "rice_main", "iraq_mains", ["iraq"], "صحن وسط", "1 medium plate", 420, 30, 80, 18, fiber=2, sugar=3, sodium=850)
add("تمن أحمر بالدجاج", "Red Rice with Chicken (Timman Ahmar)", "rice_main", "iraq_mains", ["iraq"], "صحن وسط", "1 medium plate", 400, 28, 75, 14, fiber=3, sugar=4, sodium=780)
add("كبة الموصل", "Kubbat Al-Mosul", "rice_main", "iraq_mains", ["iraq"], "قرص وسط", "1 medium disc", 200, 14, 30, 14, fiber=1.5, sugar=1, sodium=600, tags=["fried", "contains_gluten"])
add("باقلاء بالدهين", "Bagilla Bil-Dihin (Rice, Beans, Lamb)", "rice_main", "iraq_mains", ["iraq"], "صحن وسط", "1 medium plate", 420, 26, 70, 18, fiber=7, sugar=2, sodium=750)
add("عروق دجاج", "Chicken Uroog", "rice_main", "iraq_mains", ["iraq"], "3 قطع", "3 pieces", 180, 16, 18, 12, fiber=1, sugar=1, sodium=580, tags=["fried"])
add("عروق جبن", "Cheese Uroog", "rice_main", "iraq_mains", ["iraq"], "3 قطع", "3 pieces", 180, 12, 20, 14, fiber=1, sugar=1, sodium=600, tags=["fried", "contains_lactose"])
# --- More Maghreb mains ---
add("كسكس بالخضرة (بدون لحم)", "Vegetable Couscous (No Meat)", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium plate", 420, 12, 80, 10, fiber=8, sugar=7, sodium=650, tags=["high_fiber", "contains_gluten", "heart_healthy"])
add("طاجين كفتة بالبيض", "Kefta Tagine with Eggs", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium bowl", 320, 24, 12, 20, fiber=2, sugar=4, sodium=780, tags=["contains_egg", "high_protein"])
add("طاجين سمك بالخضار", "Fish Tagine with Vegetables", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium bowl", 350, 28, 18, 12, fiber=4, sugar=5, sodium=750, tags=["contains_seafood", "high_protein"])
add("بسطيلة بالسمك", "Seafood Bastilla", "rice_main", "maghreb_mains", ["maghreb"], "قطعة وسط", "1 medium piece", 240, 16, 32, 14, fiber=1.5, sugar=2, sodium=600, tags=["contains_gluten", "contains_seafood", "contains_egg"])
add("رشتة بالدجاج", "Rechta with Chicken", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium plate", 380, 26, 60, 10, fiber=3, sugar=3, sodium=750, tags=["contains_gluten"])
add("محاجب محشوة", "Mahjouba (Stuffed Crepes)", "rice_main", "maghreb_mains", ["maghreb"], "2 قطعة", "2 pieces", 220, 7, 40, 12, fiber=2, sugar=3, sodium=550, tags=["contains_gluten"])
add("بوزلوف بالحمص", "Bouzelouf with Chickpeas", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium bowl", 320, 18, 30, 12, fiber=7, sugar=3, sodium=800, tags=["high_fiber"])
# --- More meats ---
add("كفتة بالطحينة", "Kofta with Tahini", "meat", "baked_dishes", ["levant"], "صحن وسط", "1 medium plate", 300, 24, 10, 22, fiber=1, sugar=2, sodium=650, tags=["high_protein"])
add("داوود باشا", "Dawood Pasha (Meatballs in Tomato Sauce)", "meat", "stews", ["levant", "egypt"], "صحن وسط", "1 medium bowl", 300, 22, 14, 18, fiber=2, sugar=6, sodium=700, tags=["high_protein"])
add("كباب بالكرز (حلبي)", "Cherry Kebab (Aleppo)", "meat", "grilled_meats", ["levant"], "3 أسياخ مع صلصة", "3 skewers with sauce", 200, 26, 15, 16, fiber=1, sugar=10, sodium=550, tags=["high_protein"])
add("كباب خاشخاش", "Khashkhash Kebab", "meat", "grilled_meats", ["levant"], "3 أسياخ", "3 skewers", 200, 26, 8, 18, fiber=1, sugar=3, sodium=600, tags=["high_protein", "contains_gluten"])
add("يخنة لحم بالبطاطس", "Beef and Potato Stew", "meat", "stews", ALL_ARAB, "صحن وسط", "1 medium bowl", 350, 26, 25, 14, fiber=3, sugar=3, sodium=650)
add("كفتة بالفرن بالبطاطس", "Baked Kofta with Potatoes", "meat", "baked_dishes", ALL_ARAB, "صحن وسط", "1 medium plate", 350, 24, 30, 18, fiber=3, sugar=3, sodium=700)
add("ريش غنم بالفرن", "Oven Roasted Lamb Chops", "meat", "baked_dishes", ALL_ARAB, "4 ريش", "4 chops", 200, 40, 2, 28, fiber=0, sodium=550, tags=["high_protein", "gout_caution"])
add("ميشوي (ضأن مشوي كامل)", "Mechoui (Whole Roast Lamb)", "meat", "grilled_meats", ["maghreb", "gulf"], "حصة وسط (200 غ)", "1 medium serving (200g)", 200, 42, 0, 26, fiber=0, sodium=300, tags=["high_protein", "gout_caution"])
add("سجق إسكندراني بالطماطم", "Alexandrian Sujuk in Tomato Sauce", "meat", "stews", ["egypt"], "صحن وسط", "1 medium bowl", 280, 18, 10, 20, fiber=2, sugar=5, sodium=900, tags=["processed", "high_sodium"])
add("كبدة بالخل والثوم", "Liver with Vinegar and Garlic", "meat", "organ_meats", ["levant"], "صحن وسط", "1 medium plate", 200, 26, 8, 12, fiber=0, sodium=500, tags=["gout_caution", "kidney_caution"])
add("قلية لحم يمنية", "Yemeni Meat Qalya", "meat", "stews", ["yemen"], "صحن وسط", "1 medium bowl", 280, 28, 6, 18, fiber=1, sugar=2, sodium=700, tags=["high_protein"])
# --- More poultry ---
add("دجاج بالفرن بالبطاطس", "Oven Chicken with Potatoes", "poultry", "baked", ALL_ARAB, "صحن وسط", "1 medium plate", 400, 34, 30, 16, fiber=3, sugar=2, sodium=600)
add("دجاج بالليمون والثوم", "Lemon Garlic Chicken", "poultry", "grilled", ALL_ARAB, "صحن وسط", "1 medium plate", 250, 32, 4, 10, fiber=0.5, sugar=1, sodium=450, tags=["high_protein"])
add("أجنحة دجاج حارة مقلية", "Spicy Fried Chicken Wings", "poultry", "fried", INTL, "6 أجنحة", "6 wings", 180, 26, 8, 22, fiber=0.5, sodium=800, tags=["fried", "high_sodium"])
add("شرائح دجاج بالصويا", "Soy Glazed Chicken Strips", "poultry", "stir_fry", INTL, "صحن وسط", "1 medium plate", 250, 30, 12, 8, fiber=1, sugar=8, sodium=900, tags=["high_protein", "high_sodium"])
add("دجاج بالزنجبيل والسمسم", "Ginger Sesame Chicken", "poultry", "stir_fry", INTL, "صحن وسط", "1 medium plate", 260, 28, 14, 10, fiber=1, sugar=8, sodium=850, tags=["high_protein"])
add("فخذ دجاج مقلي", "Fried Chicken Thigh", "poultry", "fried", ALL_ARAB, "فخذ وسط", "1 medium thigh", 140, 22, 8, 18, fiber=0.5, sodium=550, tags=["fried"])
# --- More fish ---
add("سردين مشوي", "Grilled Sardines", "fish_seafood", "grilled_fish", ["maghreb"], "4 أسماك", "4 fish", 160, 28, 0, 12, fiber=0, sodium=400, tags=["contains_seafood", "high_protein", "heart_healthy", "gout_caution"], quality="reference")
add("سردين مقلي", "Fried Sardines", "fish_seafood", "fried_fish", ["maghreb", "levant"], "4 أسماك", "4 fish", 170, 26, 5, 16, fiber=0.5, sodium=450, tags=["contains_seafood", "fried", "gout_caution"])
add("قاروص مشوي (دنيس)", "Grilled Sea Bream (Denis)", "fish_seafood", "grilled_fish", ["gulf", "levant"], "سمكة وسط", "1 medium fish", 200, 38, 0, 6, fiber=0, sodium=130, tags=["contains_seafood", "high_protein", "heart_healthy"], quality="reference")
add("سمك موسى مقلي", "Fried Sole Fish", "fish_seafood", "fried_fish", ["egypt", "levant"], "سمكتان وسط", "2 medium fish", 180, 28, 6, 12, fiber=0.5, sodium=400, tags=["contains_seafood", "fried"])
add("ناجل مشوي", "Grilled Nagel (Coral Trout)", "fish_seafood", "grilled_fish", ["gulf"], "قطعة وسط", "1 medium piece", 180, 36, 0, 6, fiber=0, sodium=120, tags=["contains_seafood", "high_protein", "heart_healthy"])
add("شعور مشوي", "Grilled Shaour (Emperor)", "fish_seafood", "grilled_fish", ["gulf"], "قطعة وسط", "1 medium piece", 180, 37, 0, 5, fiber=0, sodium=120, tags=["contains_seafood", "high_protein", "heart_healthy"])
add("سمك بالفرن بالخضار والليمون", "Baked Fish with Vegetables and Lemon", "fish_seafood", "baked_fish", ALL_ARAB, "صحن وسط", "1 medium plate", 300, 30, 12, 8, fiber=3, sugar=4, sodium=400, tags=["contains_seafood", "high_protein", "heart_healthy"])
add("ملوخية بالروبيان", "Molokhia with Shrimp", "fish_seafood", "stews", ["egypt"], "صحن وسط", "1 medium bowl", 350, 24, 16, 10, fiber=5, sugar=2, sodium=750, tags=["contains_seafood", "high_fiber"])
add("سمك فيليه بالليمون والأعشاب", "Fish Fillet with Lemon and Herbs", "fish_seafood", "baked_fish", INTL, "قطعة وسط", "1 medium fillet", 160, 30, 3, 5, fiber=0.5, sugar=1, sodium=300, tags=["contains_seafood", "high_protein", "low_calorie"])
# --- More legumes ---
add("فول بالطحينة", "Foul with Tahini", "legume", "dips", ["levant", "egypt"], "صحن وسط", "1 medium bowl", 230, 12, 30, 10, fiber=9, sugar=2, sodium=550, tags=["high_fiber"])
add("فول بالصلصة الحارة", "Foul with Hot Sauce", "legume", "dishes", ["egypt"], "صحن وسط", "1 medium bowl", 250, 13, 34, 5, fiber=10, sugar=3, sodium=650, tags=["high_fiber"])
add("فول نابت", "Sprouted Fava Beans (Foul Nabit)", "legume", "dishes", ["gulf"], "صحن وسط", "1 medium bowl", 220, 14, 30, 2, fiber=8, sugar=2, sodium=300, tags=["high_fiber", "low_calorie"], quality="reference")
add("حمص بيروتي بالثوم", "Beiruti Hummus with Garlic", "legume", "dips", ["levant"], "4 ملاعق كبيرة", "4 tbsp", 100, 7, 14, 9, fiber=5, sugar=1, sodium=400)
add("فول بالسمن البلدي", "Foul with Ghee", "legume", "dishes", ["egypt"], "صحن وسط", "1 medium bowl", 240, 13, 33, 9, fiber=10, sugar=1, sodium=550, tags=["high_fiber", "contains_lactose"])
add("فاصوليا خضراء باللحم", "Green Beans with Meat", "legume", "dishes", ALL_ARAB, "صحن وسط", "1 medium bowl", 320, 18, 18, 14, fiber=6, sugar=5, sodium=650)
add("لوبيا بزيت الزيتون", "Black-Eyed Peas in Olive Oil", "legume", "dishes", ["gulf", "levant"], "صحن وسط", "1 medium bowl", 250, 10, 30, 9, fiber=8, sugar=4, sodium=400, tags=["high_fiber", "heart_healthy"])
# --- More cooked vegetables ---
add("يخنة بازلاء بالجزر واللحم", "Pea and Carrot Stew with Meat", "vegetable", "stews", ALL_ARAB, "صحن وسط", "1 medium bowl", 320, 18, 25, 12, fiber=7, sugar=6, sodium=600, tags=["high_fiber"])
add("يخنة بطاطس باللحم", "Potato Stew with Meat", "vegetable", "stews", ALL_ARAB, "صحن وسط", "1 medium bowl", 340, 20, 30, 14, fiber=3, sugar=2, sodium=650)
add("سلق بالحمص", "Swiss Chard with Chickpeas", "vegetable", "cooked_vegetables", ["levant"], "صحن وسط", "1 medium bowl", 280, 8, 25, 10, fiber=8, sugar=3, sodium=450, tags=["high_fiber", "heart_healthy"])
add("سبانخ باللحم المفروم", "Spinach with Minced Meat", "vegetable", "cooked_vegetables", ["levant", "egypt"], "صحن وسط", "1 medium bowl", 300, 20, 8, 12, fiber=4, sugar=2, sodium=550, tags=["high_fiber", "high_protein"])
add("قرنبيط بالفرن", "Roasted Cauliflower", "vegetable", "cooked_vegetables", ALL_ARAB, "صحن وسط", "1 medium plate", 180, 4, 10, 7, fiber=4, sugar=3, sodium=250, tags=["heart_healthy", "low_calorie"])
add("بطاطا حلوة بالفرن", "Roasted Sweet Potato", "vegetable", "cooked_vegetables", ALL_ARAB, "صحن وسط", "1 medium plate", 180, 2.5, 38, 5, fiber=5, sugar=12, sodium=100, tags=["high_fiber", "heart_healthy"])
add("خضار مشكلة بالفرن", "Roasted Mixed Vegetables", "vegetable", "cooked_vegetables", ALL_ARAB, "صحن وسط", "1 medium plate", 200, 3, 20, 7, fiber=6, sugar=8, sodium=250, tags=["high_fiber", "heart_healthy", "low_calorie"])
add("باذنجان مشوي", "Grilled Eggplant", "vegetable", "cooked_vegetables", ALL_ARAB, "صحن وسط", "1 medium plate", 180, 2, 12, 5, fiber=6, sugar=6, sodium=150, tags=["high_fiber", "low_calorie", "heart_healthy"])
add("فلفل ملون مشوي", "Grilled Mixed Peppers", "vegetable", "cooked_vegetables", ALL_ARAB, "صحن وسط", "1 medium plate", 150, 2, 12, 5, fiber=3, sugar=7, sodium=100, tags=["low_calorie", "heart_healthy"])
add("كوسا مقلية", "Fried Zucchini", "vegetable", "cooked_vegetables", ALL_ARAB, "صحن وسط", "1 medium plate", 150, 2.5, 8, 12, fiber=2, sugar=4, sodium=200, tags=["fried"])
add("بروكلي بالبخار", "Steamed Broccoli", "vegetable", "cooked_vegetables", INTL, "كوب واحد", "1 cup", 156, 4, 10, 0.5, fiber=4, sugar=2, sodium=60, tags=["high_fiber", "low_calorie", "heart_healthy"], quality="reference")
add("بامية مقلية", "Fried Okra", "vegetable", "cooked_vegetables", ["levant", "egypt"], "صحن وسط", "1 medium plate", 150, 3, 12, 12, fiber=4, sugar=2, sodium=250, tags=["fried"])
# --- More salads ---
add("سلطة شمندر بالزبادي", "Beetroot Yogurt Salad", "salad", "arab_salads", ["levant"], "صحن صغير", "1 small bowl", 150, 5, 14, 4, fiber=3, sugar=10, sodium=200, tags=["contains_lactose", "heart_healthy"])
add("سلطة سبانخ بالفراولة", "Spinach Strawberry Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 180, 4, 14, 8, fiber=4, sugar=8, sodium=150, tags=["heart_healthy", "contains_nuts", "low_calorie"])
add("سلطة دجاج بالأفوكادو", "Chicken Avocado Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 250, 22, 10, 14, fiber=6, sugar=2, sodium=400, tags=["high_protein", "heart_healthy", "high_fiber"])
add("سلطة ترمس", "Lupini Bean Salad (Termos Salad)", "salad", "arab_salads", ["egypt"], "صحن صغير", "1 small bowl", 150, 10, 12, 4, fiber=4, sugar=1, sodium=600, tags=["high_sodium", "high_protein"])
add("سلطة باذنجان مقلي بالزبادي", "Fried Eggplant Yogurt Salad", "salad", "arab_salads", ["levant"], "صحن صغير", "1 small bowl", 160, 5, 12, 10, fiber=3, sugar=5, sodium=300, tags=["contains_lactose", "fried"])
add("سلطة كرنب بالخل", "Cabbage Vinegar Salad", "salad", "arab_salads", ALL_ARAB, "صحن صغير", "1 small bowl", 120, 1.5, 8, 3, fiber=3, sugar=4, sodium=200, tags=["low_calorie", "heart_healthy"])
add("سلطة بطاطا حلوة", "Sweet Potato Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 200, 3, 32, 6, fiber=5, sugar=10, sodium=200, tags=["high_fiber", "heart_healthy"])
add("سلطة حبوب مشكلة", "Mixed Bean Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 220, 10, 30, 5, fiber=9, sugar=3, sodium=350, tags=["high_fiber", "heart_healthy"])
add("سلطة دجاج بالذرة", "Chicken Corn Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 250, 20, 18, 10, fiber=3, sugar=4, sodium=450, tags=["high_protein"])
add("سلطة نيسواز", "Nicoise Salad", "salad", "international_salads", INTL, "صحن وسط", "1 medium plate", 280, 20, 15, 14, fiber=4, sugar=4, sodium=550, tags=["contains_seafood", "contains_egg", "high_protein"])
# --- More soups ---
add("شوربة جزر بالزنجبيل", "Carrot Ginger Soup", "soup", "international_soups", INTL, "صحن وسط", "1 medium bowl", 300, 3, 22, 6, fiber=4, sugar=10, sodium=500, tags=["heart_healthy"])
add("شوربة بطاطس", "Potato Soup", "soup", "international_soups", INTL, "صحن وسط", "1 medium bowl", 300, 6, 30, 9, fiber=3, sugar=3, sodium=650, tags=["contains_lactose"])
add("شوربة قرع", "Pumpkin Soup", "soup", "international_soups", INTL, "صحن وسط", "1 medium bowl", 300, 4, 20, 8, fiber=3, sugar=8, sodium=550, tags=["contains_lactose", "heart_healthy"])
add("شوربة سبانخ بالكريمة", "Cream of Spinach Soup", "soup", "creamy_soups", INTL, "صحن وسط", "1 medium bowl", 300, 6, 14, 12, fiber=3, sugar=3, sodium=650, tags=["contains_lactose"])
add("شوربة يخنة اللحم", "Hearty Beef Soup", "soup", "arab_soups", ALL_ARAB, "صحن وسط", "1 medium bowl", 320, 18, 20, 8, fiber=3, sugar=4, sodium=700, tags=["high_protein"])
add("شوربة بازلاء", "Pea Soup", "soup", "international_soups", INTL, "صحن وسط", "1 medium bowl", 300, 10, 28, 4, fiber=8, sugar=6, sodium=600, tags=["high_fiber"])
add("شوربة شعيرية بالدجاج", "Chicken Vermicelli Soup", "soup", "arab_soups", ALL_ARAB, "صحن وسط", "1 medium bowl", 300, 10, 25, 5, fiber=1.5, sugar=2, sodium=700, tags=["contains_gluten"])
add("شوربة عدس حامض", "Sour Lentil Soup (Adas Bhamod)", "soup", "arab_soups", ["levant"], "صحن وسط", "1 medium bowl", 300, 12, 32, 6, fiber=8, sugar=2, sodium=600, tags=["high_fiber", "heart_healthy"])
# --- More fruits ---
add100("سفرجل", "Quince", "fruit", "fresh_fruits", ["levant"], "حبة وسط", "1 medium", 150, 0.4, 15.3, 0.1, fib100=1.9, sug100=8.9, na100=4, tags=["heart_healthy"])
add100("دوم", "Doum Palm Fruit", "fruit", "fresh_fruits", ["egypt", "north_africa"], "3 حبات", "3 pieces", 60, 1, 60, 0.5, fib100=8, sug100=40, na100=5, tags=["high_fiber"])
add100("لوز أخضر", "Green Almonds", "fruit", "seasonal", ["levant"], "10 حبات", "10 pieces", 60, 3, 5, 6, fib100=3, sug100=1, na100=2, tags=["contains_nuts", "low_calorie"])
add100("شمام هاني ديو", "Honeydew Melon", "fruit", "fresh_fruits", INTL, "كوب مكعبات", "1 cup cubes", 170, 0.5, 9.1, 0.1, fib100=0.8, sug100=8.1, na100=18, tags=["heart_healthy", "low_calorie"])
add100("فاكهة التنين", "Dragon Fruit", "fruit", "fresh_fruits", INTL, "نصف حبة", "1/2 fruit", 150, 1.1, 11, 0.4, fib100=3, sug100=8, na100=0, tags=["heart_healthy", "low_calorie"])
add100("باشن فروت", "Passion Fruit", "fruit", "fresh_fruits", INTL, "3 حبات", "3 pieces", 54, 2.2, 23.4, 0.7, fib100=10.4, sug100=11.2, na100=28, tags=["high_fiber", "low_calorie"])
add100("ليتشي", "Lychee", "fruit", "fresh_fruits", INTL, "8 حبات", "8 pieces", 96, 0.8, 16.5, 0.4, fib100=1.3, sug100=15.2, na100=1, tags=[])
add("تمر عجوة", "Ajwa Dates", "fruit", "dates", ["gulf"], "3 تمرات", "3 dates", 24, 0.5, 17, 0.1, fiber=2, sugar=15, sodium=0, tags=[], quality="reference")
add("برتقال أبو صرة", "Navel Orange", "fruit", "fresh_fruits", ["egypt"], "حبة وسط", "1 medium", 140, 1.3, 16.5, 0.2, fiber=3.4, sugar=13, sodium=0, tags=["heart_healthy"], quality="reference")
# --- More dairy ---
add("زبادي بالعسل", "Yogurt with Honey", "dairy", "yogurt", ALL_ARAB, "علبة مع ملعقة عسل", "1 pot with 1 tbsp honey", 190, 6, 24, 4, sugar=22, sodium=80, tags=["contains_lactose", "high_sugar"])
add("زبادي بالشوفان والموز", "Yogurt with Oats and Banana", "dairy", "yogurt", INTL, "كوب واحد", "1 cup", 280, 12, 40, 6, fiber=5, sugar=20, sodium=100, tags=["contains_lactose", "whole_grain", "heart_healthy"])
add("لبنة بالزعتر وزيت الزيتون", "Labneh with Zaatar and Olive Oil", "dairy", "cheeses", ["levant"], "3 ملاعق كبيرة", "3 tbsp", 60, 5, 3, 9, fiber=0.5, sugar=2, sodium=350, tags=["contains_lactose", "heart_healthy"])
add("لبنة قليلة الدسم", "Low-Fat Labneh", "dairy", "cheeses", ALL_ARAB, "ملعقتان كبيرتان", "2 tbsp", 40, 5, 2, 2.5, sugar=2, sodium=200, tags=["contains_lactose", "low_calorie"], quality="reference")
add("جبنة حلوم مشوية", "Grilled Halloumi", "dairy", "cheeses", ["levant"], "شريحتان (60 غ)", "2 slices (60g)", 60, 13, 1, 15, sugar=0.5, sodium=800, tags=["contains_lactose", "high_sodium", "high_protein"], quality="reference")
add("حليب بالعسل والهيل", "Milk with Honey and Cardamom", "dairy", "milk", ["gulf"], "كوب واحد", "1 cup", 240, 8, 28, 8, sugar=27, sodium=100, tags=["contains_lactose", "high_sugar"])
add("زبادي يوناني بالعسل والجوز", "Greek Yogurt with Honey and Walnuts", "dairy", "yogurt", INTL, "كوب واحد", "1 cup", 220, 16, 22, 8, fiber=1, sugar=20, sodium=70, tags=["contains_lactose", "contains_nuts", "high_protein"])
add("مشروب اللوز بالتمر", "Almond Date Drink", "dairy", "plant_milk", ["gulf"], "كوب واحد", "1 cup", 240, 4, 28, 6, fiber=3, sugar=22, sodium=60, tags=["contains_nuts"])
add("لبن رايب بالتمر", "Rayeb Milk with Dates", "dairy", "milk", ["egypt", "gulf"], "كوب واحد مع 2 تمرة", "1 cup with 2 dates", 270, 8, 26, 6, fiber=2, sugar=24, sodium=100, tags=["contains_lactose"])
add("زبادي بالخيار والشبت (تزاتزيكي)", "Tzatziki", "dairy", "dips", INTL, "4 ملاعق كبيرة", "4 tbsp", 80, 4, 4, 3, fiber=0.5, sugar=3, sodium=250, tags=["contains_lactose", "low_calorie"], quality="reference")
# --- More eggs & breakfast ---
add("بيض بالسجق", "Eggs with Sujuk", "egg_breakfast", "breakfast_dishes", ["levant", "egypt"], "بيضتان مع سجق", "2 eggs with sujuk", 180, 16, 3, 22, sugar=1, sodium=800, tags=["contains_egg", "processed", "high_sodium"])
add("بيض بالمرقاز", "Eggs with Merguez", "egg_breakfast", "breakfast_dishes", ["maghreb"], "بيضتان مع مرقاز", "2 eggs with merguez", 200, 18, 3, 24, sugar=1, sodium=850, tags=["contains_egg", "processed", "high_sodium"])
add("شكشوكة بالجبن", "Shakshuka with Cheese", "egg_breakfast", "breakfast_dishes", ALL_ARAB, "صحن وسط", "1 medium plate", 280, 16, 12, 16, fiber=3, sugar=6, sodium=650, tags=["contains_egg", "contains_lactose"])
add("أومليت بالمشروم", "Mushroom Omelette", "egg_breakfast", "eggs", INTL, "بيضتان مع مشروم", "2 eggs with mushrooms", 160, 14, 3, 14, fiber=1, sugar=1, sodium=280, tags=["contains_egg", "high_protein"])
add("بيض بالسبانخ", "Eggs with Spinach", "egg_breakfast", "breakfast_dishes", ALL_ARAB, "صحن وسط", "1 medium plate", 200, 14, 4, 14, fiber=2, sugar=1, sodium=350, tags=["contains_egg", "high_protein", "heart_healthy"])
add("فول بالبيض", "Foul with Eggs", "egg_breakfast", "breakfast_dishes", ["egypt"], "صحن وسط", "1 medium bowl", 300, 18, 32, 10, fiber=9, sugar=2, sodium=600, tags=["contains_egg", "high_fiber"])
add("فول بالسجق", "Foul with Sujuk", "egg_breakfast", "breakfast_dishes", ["egypt"], "صحن وسط", "1 medium bowl", 300, 17, 32, 14, fiber=9, sugar=2, sodium=800, tags=["processed", "high_fiber", "high_sodium"])
add("عجة تونسية بالمرقاز", "Tunisian Ojja with Merguez", "egg_breakfast", "breakfast_dishes", ["maghreb"], "صحن وسط", "1 medium plate", 300, 20, 10, 20, fiber=2, sugar=4, sodium=850, tags=["contains_egg", "processed", "high_sodium"])
add("تشباب إماراتي", "Emirati Chabab Pancakes", "egg_breakfast", "breakfast_dishes", ["gulf"], "3 قطع", "3 pieces", 120, 6, 35, 5, fiber=1, sugar=8, sodium=200, tags=["contains_gluten", "contains_egg"])
add("خمير إماراتي", "Emirati Khameer Bread", "egg_breakfast", "breakfast_dishes", ["gulf"], "قطعة واحدة", "1 piece", 90, 5, 35, 6, fiber=1, sugar=6, sodium=220, tags=["contains_gluten", "contains_egg", "contains_lactose"])
# --- More nuts ---
add("كاجو مملح", "Salted Cashews", "nuts_seeds", "nuts", ALL_ARAB, "قبضة صغيرة (30 غ)", "1 small handful (30g)", 30, 4.5, 9, 14, fiber=1, sugar=2, sodium=200, tags=["contains_nuts", "processed"], quality="reference")
add("لوز مملح", "Salted Almonds", "nuts_seeds", "nuts", ALL_ARAB, "قبضة صغيرة (30 غ)", "1 small handful (30g)", 30, 6, 6, 15, fiber=3.5, sugar=1.5, sodium=190, tags=["contains_nuts", "processed", "heart_healthy"], quality="reference")
add("فستق مملح", "Salted Pistachios", "nuts_seeds", "nuts", ALL_ARAB, "قبضة صغيرة (30 غ)", "1 small handful (30g)", 30, 6, 8, 14, fiber=3, sugar=2, sodium=220, tags=["contains_nuts", "processed"], quality="reference")
add("مكسرات بالعسل", "Honey Roasted Nuts", "nuts_seeds", "nuts", INTL, "قبضة صغيرة (30 غ)", "1 small handful (30g)", 30, 5, 10, 14, fiber=2, sugar=7, sodium=50, tags=["contains_nuts", "processed"])
# --- More beverages ---
add("عصير مشمش طازج", "Fresh Apricot Juice", "beverage", "juices", ["levant"], "كوب واحد", "1 cup", 240, 1, 26, 0.3, fiber=1.5, sugar=22, sodium=3, tags=["high_sugar"], sizes="drink")
add("عصير خوخ طازج", "Fresh Peach Juice", "beverage", "juices", ALL_ARAB, "كوب واحد", "1 cup", 240, 1, 25, 0.2, fiber=1, sugar=22, sodium=3, tags=["high_sugar"], sizes="drink")
add("سموذي مانجو", "Mango Smoothie", "beverage", "smoothies", ALL_ARAB, "كوب واحد (300 مل)", "1 cup (300ml)", 300, 4, 35, 2, fiber=3, sugar=30, sodium=40, tags=["high_sugar"], sizes="drink")
add("سموذي أفوكادو بالتمر", "Avocado Date Smoothie", "beverage", "smoothies", ["gulf"], "كوب واحد (300 مل)", "1 cup (300ml)", 300, 5, 32, 12, fiber=6, sugar=24, sodium=60, tags=["contains_lactose", "heart_healthy", "high_fiber"], sizes="drink")
add("موز بالحليب والعسل", "Banana Milk with Honey", "beverage", "smoothies", ALL_ARAB, "كوب واحد", "1 cup", 280, 8, 40, 6, fiber=2, sugar=34, sodium=100, tags=["contains_lactose", "high_sugar"], sizes="drink")
add("شاي أخضر بالنعناع", "Green Tea with Mint", "beverage", "tea", ["maghreb"], "كوب واحد", "1 cup", 240, 0, 1, 0, sugar=0, sodium=3, tags=["caffeine", "diabetic_friendly", "low_calorie", "heart_healthy"], quality="reference", sizes="drink")
add("آيس لاتيه", "Iced Latte", "beverage", "coffee", INTL, "كوب وسط (350 مل)", "1 medium cup (350ml)", 350, 8, 13, 6, sugar=12, sodium=110, tags=["caffeine", "contains_lactose"], sizes="drink")
add("آيس كوفي بالحليب والسكر", "Iced Coffee with Milk and Sugar", "beverage", "coffee", INTL, "كوب وسط (350 مل)", "1 medium cup (350ml)", 350, 6, 28, 6, sugar=26, sodium=100, tags=["caffeine", "contains_lactose", "high_sugar"], sizes="drink")
add("مشروب الشعير غير الكحولي", "Non-Alcoholic Malt Beverage", "beverage", "soft_drinks", ["gulf"], "علبة (330 مل)", "1 can (330ml)", 330, 1, 22, 0, sugar=18, sodium=20, tags=["processed", "contains_gluten"], sizes=[])
add("مشروب رياضي", "Sports Drink", "beverage", "soft_drinks", ALL_ARAB + INTL, "قارورة (500 مل)", "1 bottle (500ml)", 500, 0, 32, 0, sugar=30, sodium=220, tags=["high_sugar", "processed"], quality="reference", sizes=[])
add("ماء بنكهة الليمون والنعناع", "Lemon Mint Infused Water", "beverage", "water", ALL_ARAB, "كوب واحد", "1 cup", 240, 0.1, 2, 0, sugar=1, sodium=2, tags=["low_calorie", "diabetic_friendly"], quality="reference", sizes="drink")
add("زهورات مغلية (أعشاب مشكلة)", "Mixed Herbal Infusion (Zhourat)", "beverage", "herbal", ["levant"], "كوب واحد", "1 cup", 240, 0, 1.5, 0, sugar=0, sodium=4, tags=["low_calorie", "diabetic_friendly"], quality="reference", sizes="drink")
# --- More fast food & international ---
add("بيتزا سوبريم", "Supreme Pizza", "fast_food", "pizza", INTL, "شريحة كبيرة", "1 large slice", 135, 9, 24, 11, fiber=2, sugar=3, sodium=620, tags=["contains_gluten", "contains_lactose", "processed"])
add("باستا بيستو", "Pesto Pasta", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 320, 12, 55, 16, fiber=3, sugar=2, sodium=600, tags=["contains_gluten", "contains_nuts", "contains_lactose"])
add("باستا كاربونارا", "Pasta Carbonara", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 340, 18, 55, 20, fiber=2, sugar=2, sodium=800, tags=["contains_gluten", "contains_egg", "contains_lactose"])
add("باستا بالجمبري", "Shrimp Pasta", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 340, 24, 55, 10, fiber=3, sugar=3, sodium=750, tags=["contains_gluten", "contains_seafood", "high_protein"])
add("ريزوتو بالمشروم", "Mushroom Risotto", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 320, 10, 50, 14, fiber=2, sugar=2, sodium=700, tags=["contains_lactose"])
add("رافيولي بالجبن", "Cheese Ravioli", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 300, 14, 45, 12, fiber=2, sugar=3, sodium=700, tags=["contains_gluten", "contains_lactose"])
add("دجاج سويت شيلي", "Sweet Chili Chicken", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 300, 24, 25, 12, fiber=1, sugar=16, sodium=800, tags=["fried", "high_sugar"])
add("دجاج ترياكي", "Chicken Teriyaki", "fast_food", "asian", INTL, "صحن وسط", "1 medium plate", 300, 28, 18, 8, fiber=1, sugar=12, sodium=1100, tags=["high_protein", "high_sodium"])
add("سمبوسة سبانخ بالجبن", "Spinach Cheese Samboosa", "fast_food", "samboosa", ["gulf"], "3 قطع", "3 pieces", 90, 5, 24, 11, fiber=1.5, sugar=1, sodium=420, tags=["contains_gluten", "contains_lactose", "fried"])
add("صحن فلافل مع الخبز", "Falafel Plate with Bread", "fast_food", "plates", ALL_ARAB, "صحن وسط", "1 medium plate", 350, 12, 50, 16, fiber=8, sugar=3, sodium=800, tags=["fried", "high_fiber", "contains_gluten"])
add("حمص باللحمة", "Hummus with Minced Meat", "fast_food", "plates", ["levant"], "صحن وسط", "1 medium plate", 280, 18, 16, 16, fiber=5, sugar=1, sodium=600, tags=["high_protein"])
add("بانيني دجاج بالجبن", "Chicken Cheese Panini", "fast_food", "sandwiches", INTL, "ساندويتش وسط", "1 medium sandwich", 260, 22, 35, 14, fiber=2, sugar=3, sodium=850, tags=["contains_gluten", "contains_lactose"])
# --- More sweets ---
add("سفنج مغربي", "Sfenj (Moroccan Donuts)", "sweets", "maghreb_sweets", ["maghreb"], "2 قطعة", "2 pieces", 100, 3, 35, 12, fiber=1, sugar=6, sodium=200, tags=["contains_gluten", "fried"])
add("كعب غزال", "Kaab El Ghazal (Gazelle Horns)", "sweets", "maghreb_sweets", ["maghreb"], "3 قطع", "3 pieces", 75, 4, 28, 10, fiber=1.5, sugar=16, sodium=60, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("غريبة باللوز مغربية", "Moroccan Almond Ghoriba", "sweets", "maghreb_sweets", ["maghreb"], "4 قطع", "4 pieces", 60, 4, 22, 12, fiber=2, sugar=14, sodium=40, tags=["contains_nuts", "high_sugar"])
add("مقروط باللوز", "Makrout with Almonds", "sweets", "maghreb_sweets", ["maghreb"], "2 قطعة", "2 pieces", 90, 4, 34, 12, fiber=2, sugar=18, sodium=60, tags=["contains_gluten", "contains_nuts", "high_sugar", "fried"])
add("حلاوة الجبن الحمصية", "Halawet El Jibn", "sweets", "arab_sweets", ["levant"], "قطعة وسط", "1 medium piece", 100, 6, 32, 12, fiber=0.5, sugar=22, sodium=200, tags=["contains_lactose", "contains_gluten", "high_sugar"])
add("عصيدة الزقوقو", "Assidat Zgougou", "sweets", "maghreb_sweets", ["maghreb"], "كوب صغير", "1 small cup", 150, 4, 25, 8, fiber=2, sugar=18, sodium=40, tags=["contains_nuts", "high_sugar"])
add("دونات بالشوكولاتة", "Chocolate Donut", "sweets", "cakes", INTL, "قطعة واحدة", "1 piece", 80, 3, 34, 15, fiber=1, sugar=20, sodium=210, tags=["contains_gluten", "high_sugar", "fried"])
add("تشوروس بالسكر", "Churros with Sugar", "sweets", "cakes", INTL, "4 أصابع", "4 sticks", 100, 3, 35, 14, fiber=1, sugar=14, sodium=180, tags=["contains_gluten", "high_sugar", "fried"])
add("دقلة نور باللوز", "Deglet Nour Stuffed with Almond Paste", "sweets", "maghreb_sweets", ["maghreb"], "3 حبات", "3 pieces", 60, 3, 32, 6, fiber=3, sugar=26, sodium=5, tags=["contains_nuts", "high_sugar"])
add("بقلاوة تركية بالكريمة", "Turkish Baklava with Cream", "sweets", "arab_sweets", INTL, "2 قطعة", "2 pieces", 90, 4, 32, 18, fiber=1, sugar=22, sodium=100, tags=["contains_gluten", "contains_nuts", "contains_lactose", "high_sugar"])
# --- More condiments ---
add("راشي بالدبس (طحينة بدبس التمر)", "Rashi Bil Dibis (Tahini Date Syrup)", "condiment", "spreads", ["iraq"], "ملعقتان كبيرتان", "2 tbsp", 40, 3, 16, 10, fiber=1.5, sugar=13, sodium=20, tags=["high_sugar"])
add("مكدوس باذنجان", "Makdous (Stuffed Pickled Eggplant)", "condiment", "pickles", ["levant"], "3 حبات", "3 pieces", 90, 2, 5, 8, fiber=3, sugar=1, sodium=800, tags=["high_sodium", "contains_nuts"])
add("مخلل لفت", "Pickled Turnips", "condiment", "pickles", ["levant", "egypt"], "نصف كوب", "1/2 cup", 70, 0.8, 4, 0.2, fiber=1.5, sugar=2, sodium=750, tags=["high_sodium", "processed"], quality="reference")
add("مخلل جزر", "Pickled Carrots", "condiment", "pickles", ALL_ARAB, "نصف كوب", "1/2 cup", 70, 0.7, 6, 0.2, fiber=1.5, sugar=3, sodium=700, tags=["high_sodium", "processed"])
add("خل بلسميك", "Balsamic Vinegar", "condiment", "sauces", INTL, "ملعقة كبيرة", "1 tbsp", 15, 0.1, 2.7, 0, sugar=2.4, sodium=4, tags=["low_calorie"], quality="reference", sizes=[])
add("صلصة جبن شيدر", "Cheddar Cheese Sauce", "condiment", "sauces", INTL, "ربع كوب", "1/4 cup", 60, 3, 3, 8, sugar=1, sodium=400, tags=["contains_lactose", "processed", "high_sodium"], sizes=[])
add("صلصة ألف جزيرة", "Thousand Island Dressing", "condiment", "sauces", INTL, "ملعقتان كبيرتان", "2 tbsp", 30, 0.3, 5, 7, sugar=4, sodium=250, tags=["contains_egg", "processed"], sizes=[])
add("زعتر بالزيت (مجدوس زعتر)", "Zaatar Preserved in Oil", "condiment", "spreads", ["levant"], "ملعقتان كبيرتان", "2 tbsp", 30, 2, 3, 8, fiber=2, sugar=0, sodium=300, tags=["heart_healthy"], sizes=[])
add("دقة خضراء (فلفل أخضر)", "Green Chili Dakka", "condiment", "sauces", ["north_africa"], "ملعقة كبيرة", "1 tbsp", 20, 0.5, 3, 4, fiber=1, sugar=1, sodium=300, tags=["low_calorie"], sizes=[])
# --- More packaged ---
add("سردين بصلصة الطماطم", "Sardines in Tomato Sauce", "packaged_snack", "canned", ["maghreb"], "علبة (125 غ)", "1 can (125g)", 125, 18, 4, 10, fiber=1, sugar=3, sodium=500, tags=["contains_seafood", "processed", "gout_caution", "high_protein"], quality="reference")
add("مرتديلا لحم", "Beef Mortadella", "packaged_snack", "canned", ALL_ARAB, "3 شرائح (60 غ)", "3 slices (60g)", 60, 7, 2, 12, sodium=600, tags=["processed", "high_sodium"], quality="reference")
add("شرائح دجاج مدخنة", "Smoked Chicken Slices", "packaged_snack", "canned", ALL_ARAB, "3 شرائح (60 غ)", "3 slices (60g)", 60, 12, 1, 2, sodium=550, tags=["processed", "high_sodium", "high_protein"], quality="reference")
add("حمص بطحينة جاهز (معلب)", "Ready-Made Hummus (Packaged)", "packaged_snack", "canned", ALL_ARAB, "4 ملاعق كبيرة", "4 tbsp", 100, 7, 12, 12, fiber=4, sugar=1, sodium=450, tags=["processed"], quality="reference")
add("موسلي", "Muesli", "packaged_snack", "cereals", INTL, "نصف كوب", "1/2 cup", 55, 5, 35, 6, fiber=5, sugar=10, sodium=20, tags=["whole_grain", "high_fiber", "contains_nuts"], quality="reference")
add("كورن فليكس بالعسل", "Honey Corn Flakes", "packaged_snack", "cereals", ALL_ARAB, "كوب واحد", "1 cup", 32, 2, 26, 0.3, fiber=1, sugar=9, sodium=180, tags=["processed", "refined_carb"], quality="reference")
add("شاي مثلج معلب بالخوخ", "Canned Peach Iced Tea", "packaged_snack", "canned_drinks", ALL_ARAB, "علبة (330 مل)", "1 can (330ml)", 330, 0, 26, 0, sugar=25, sodium=15, tags=["high_sugar", "processed", "caffeine"], quality="reference")
add("رقائق ذرة بالشوكولاتة", "Chocolate Corn Cereal", "packaged_snack", "cereals", ALL_ARAB, "كوب واحد", "1 cup", 35, 2.5, 28, 1.5, fiber=2, sugar=12, sodium=160, tags=["processed", "refined_carb"], quality="reference")
add("بوب تارت بالشوكولاتة", "Chocolate Pop-Tart", "packaged_snack", "pastries", INTL, "قطعة واحدة", "1 piece", 52, 3, 35, 5, fiber=1, sugar=16, sodium=180, tags=["processed", "high_sugar", "contains_gluten"], quality="reference")
add("كرواسون معلب بالشوكولاتة", "Packaged Chocolate Croissant", "packaged_snack", "pastries", ALL_ARAB, "قطعة واحدة", "1 piece", 60, 4, 28, 13, fiber=1, sugar=12, sodium=180, tags=["processed", "contains_gluten", "high_sugar"])
add("جبنة مثلثات بالأعشاب", "Herb Cheese Triangles", "packaged_snack", "cheese", ALL_ARAB, "مثلثان (32 غ)", "2 triangles (32g)", 32, 3, 2, 8, sugar=2, sodium=280, tags=["contains_lactose", "processed"], quality="reference")
add("تونة بالذرة معلبة", "Canned Tuna with Corn", "packaged_snack", "canned", ALL_ARAB, "علبة (160 غ)", "1 can (160g)", 160, 20, 12, 4, fiber=2, sugar=3, sodium=450, tags=["contains_seafood", "processed", "high_protein"], quality="reference")

# ===========================================================================
# 21) THIRD CURATED LAYER — street food, regional depth, juices, camel, Sudan/Libya
# ===========================================================================
# --- Egyptian & Levant street sandwiches ---
add("ساندويتش كبدة بلدي", "Baladi Liver Sandwich", "fast_food", "egypt_sandwiches", ["egypt"], "ساندويتش فينو", "1 fino sandwich", 180, 18, 40, 10, fiber=1.5, sugar=1, sodium=650, tags=["contains_gluten", "gout_caution"])
add("ساندويتش كفتة بلدي", "Baladi Kofta Sandwich", "fast_food", "egypt_sandwiches", ["egypt"], "ساندويتش فينو", "1 fino sandwich", 190, 16, 42, 12, fiber=1.5, sugar=1, sodium=700, tags=["contains_gluten"])
add("ساندويتش سجق بلدي", "Baladi Sujuk Sandwich", "fast_food", "egypt_sandwiches", ["egypt"], "ساندويتش فينو", "1 fino sandwich", 190, 15, 42, 14, fiber=1.5, sugar=2, sodium=850, tags=["contains_gluten", "processed", "high_sodium"])
add("ساندويتش فول بالزيت", "Foul Sandwich with Oil", "fast_food", "egypt_sandwiches", ["egypt"], "ساندويتش بلدي", "1 baladi sandwich", 220, 10, 45, 8, fiber=8, sugar=1, sodium=600, tags=["contains_gluten", "high_fiber"])
add("ساندويتش طعمية بالطحينة", "Taameya Sandwich with Tahini", "fast_food", "egypt_sandwiches", ["egypt"], "ساندويتش بلدي", "1 baladi sandwich", 230, 9, 46, 12, fiber=6, sugar=1, sodium=650, tags=["contains_gluten", "fried"])
add("ساندويتش حمص بالطحينة", "Hummus Sandwich", "fast_food", "sandwiches", ALL_ARAB, "ساندويتش وسط", "1 medium sandwich", 220, 8, 42, 10, fiber=6, sugar=1, sodium=550, tags=["contains_gluten"])
add("ساندويتش جبنة رومي", "Roumy Cheese Sandwich", "fast_food", "egypt_sandwiches", ["egypt"], "ساندويتش فينو", "1 fino sandwich", 150, 12, 38, 10, fiber=1, sugar=1, sodium=650, tags=["contains_gluten", "contains_lactose"])
add("ساندويتش بيض بالخضار", "Egg Vegetable Sandwich", "fast_food", "sandwiches", ALL_ARAB, "ساندويتش وسط", "1 medium sandwich", 200, 12, 38, 10, fiber=2, sugar=2, sodium=500, tags=["contains_gluten", "contains_egg"])
add("ساندويتش بطاطس مقلية", "French Fries Sandwich", "fast_food", "egypt_sandwiches", ["egypt"], "ساندويتش فينو", "1 fino sandwich", 200, 5, 48, 14, fiber=3, sugar=1, sodium=450, tags=["contains_gluten", "fried", "refined_carb"])
add("ساندويتش تيركي بالجبن", "Turkey Cheese Sandwich", "fast_food", "sandwiches", ALL_ARAB, "ساندويتش وسط", "1 medium sandwich", 180, 14, 35, 8, fiber=1.5, sugar=3, sodium=750, tags=["contains_gluten", "contains_lactose", "processed"])
add("ساندويتش روست بيف", "Roast Beef Sandwich", "fast_food", "sandwiches", ALL_ARAB, "ساندويتش وسط", "1 medium sandwich", 190, 18, 36, 9, fiber=1.5, sugar=3, sodium=800, tags=["contains_gluten", "processed"])
add("ساندويتش دجاج بالكاري", "Curry Chicken Sandwich", "fast_food", "sandwiches", ["gulf"], "ساندويتش وسط", "1 medium sandwich", 220, 20, 38, 10, fiber=2, sugar=4, sodium=700, tags=["contains_gluten"])
# --- More pizza / pasta / burgers ---
add("بيتزا تونة", "Tuna Pizza", "fast_food", "pizza", INTL, "شريحة كبيرة", "1 large slice", 130, 11, 24, 8, fiber=1.5, sugar=3, sodium=580, tags=["contains_gluten", "contains_lactose", "contains_seafood"])
add("بيتزا جمبري", "Shrimp Pizza", "fast_food", "pizza", INTL, "شريحة كبيرة", "1 large slice", 130, 10, 24, 8, fiber=1.5, sugar=3, sodium=600, tags=["contains_gluten", "contains_lactose", "contains_seafood"])
add("بيتزا لحم مفروم", "Minced Meat Pizza", "fast_food", "pizza", INTL, "شريحة كبيرة", "1 large slice", 135, 10, 24, 11, fiber=1.5, sugar=3, sodium=620, tags=["contains_gluten", "contains_lactose"])
add("بيتزا مشروم", "Mushroom Pizza", "fast_food", "pizza", INTL, "شريحة كبيرة", "1 large slice", 125, 8, 24, 8, fiber=2, sugar=3, sodium=500, tags=["contains_gluten", "contains_lactose"])
add("باستا أرابياتا", "Penne Arrabbiata", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 320, 10, 58, 8, fiber=4, sugar=6, sodium=600, tags=["contains_gluten"])
add("باستا ألفريدو", "Fettuccine Alfredo", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 330, 14, 52, 22, fiber=2, sugar=2, sodium=700, tags=["contains_gluten", "contains_lactose"])
add("باستا بالدجاج والمشروم", "Chicken Mushroom Pasta", "fast_food", "pasta", INTL, "صحن وسط", "1 medium plate", 350, 26, 55, 14, fiber=3, sugar=3, sodium=750, tags=["contains_gluten", "contains_lactose"])
add("لازانيا خضار", "Vegetable Lasagna", "fast_food", "pasta", INTL, "قطعة وسط", "1 medium piece", 300, 12, 35, 14, fiber=4, sugar=6, sodium=650, tags=["contains_gluten", "contains_lactose"])
add("برجر دجاج حار", "Spicy Chicken Burger", "fast_food", "burgers", INTL, "ساندويتش وسط", "1 medium sandwich", 250, 18, 45, 18, fiber=2, sugar=7, sodium=950, tags=["contains_gluten", "fried", "processed"])
add("فيش برجر", "Fish Burger", "fast_food", "burgers", INTL, "ساندويتش وسط", "1 medium sandwich", 240, 15, 42, 14, fiber=2, sugar=5, sodium=750, tags=["contains_gluten", "contains_seafood", "fried"])
add("برجر نباتي", "Veggie Burger", "fast_food", "burgers", INTL, "ساندويتش وسط", "1 medium sandwich", 220, 12, 38, 10, fiber=5, sugar=4, sodium=650, tags=["contains_gluten", "high_fiber"])
# --- Rice sides ---
add("أرز بالخلطة والمكسرات", "Rice with Mixed Nuts (Hashweh)", "rice_main", "rice_sides", ["levant"], "صحن وسط", "1 medium plate", 250, 8, 50, 10, fiber=1.5, sugar=1, sodium=400, tags=["contains_nuts"])
add("أرز أصفر بالكركم", "Yellow Turmeric Rice", "rice_main", "rice_sides", ALL_ARAB, "صحن وسط", "1 medium plate", 220, 5, 48, 4, fiber=1, sugar=0.5, sodium=300, tags=["refined_carb"])
add("أرز بالخضار", "Rice with Vegetables", "rice_main", "rice_sides", ALL_ARAB, "صحن وسط", "1 medium plate", 240, 6, 48, 5, fiber=3, sugar=3, sodium=350)
add("أرز بالزعفران", "Saffron Rice", "rice_main", "rice_sides", ["gulf"], "صحن وسط", "1 medium plate", 220, 5, 47, 4, fiber=1, sugar=0.5, sodium=300, tags=["refined_carb"])
# --- More manakish ---
add("منقوشة لبنة", "Labneh Manoushe", "bread_grain", "flatbreads", ["levant"], "قطعة واحدة", "1 piece", 120, 10, 52, 10, fiber=2, sugar=2, sodium=500, tags=["contains_gluten", "contains_lactose"])
add("منقوشة كشك", "Kishk Manoushe", "bread_grain", "flatbreads", ["levant"], "قطعة واحدة", "1 piece", 120, 8, 54, 9, fiber=2, sugar=2, sodium=520, tags=["contains_gluten", "contains_lactose"])
add("منقوشة جبن وزعتر", "Cheese and Zaatar Manoushe", "bread_grain", "flatbreads", ["levant"], "قطعة واحدة", "1 piece", 125, 11, 54, 13, fiber=2, sugar=2, sodium=540, tags=["contains_gluten", "contains_lactose"])
add("فطيرة بيض بالجبن", "Egg and Cheese Fatayer", "bread_grain", "flatbreads", ["gulf"], "قطعتان", "2 pieces", 110, 9, 40, 10, fiber=1, sugar=1, sodium=480, tags=["contains_gluten", "contains_egg", "contains_lactose"])
add("فطيرة لحم", "Meat Fatayer", "bread_grain", "flatbreads", ["gulf"], "قطعتان", "2 pieces", 110, 9, 40, 11, fiber=1, sugar=1, sodium=500, tags=["contains_gluten"])
# --- More juices (juice-shop combos) ---
add("عصير أناناس طازج", "Fresh Pineapple Juice", "beverage", "juices", ALL_ARAB, "كوب واحد", "1 cup", 240, 0.9, 28, 0.2, fiber=0.5, sugar=25, sodium=3, tags=["high_sugar"], sizes="drink")
add("عصير كيوي طازج", "Fresh Kiwi Juice", "beverage", "juices", ["gulf"], "كوب واحد", "1 cup", 240, 1.5, 24, 0.5, fiber=3, sugar=18, sodium=5, tags=[], sizes="drink")
add("عصير بابايا طازج", "Fresh Papaya Juice", "beverage", "juices", ALL_ARAB, "كوب واحد", "1 cup", 240, 1, 24, 0.3, fiber=2, sugar=20, sodium=8, tags=[], sizes="drink")
add("عصير توت مشكل", "Mixed Berry Juice", "beverage", "juices", ["gulf"], "كوب واحد", "1 cup", 240, 1, 24, 0.3, fiber=2, sugar=20, sodium=5, tags=["heart_healthy"], sizes="drink")
add("عصير برتقال بالجزر", "Orange Carrot Juice", "beverage", "juices", ALL_ARAB, "كوب واحد", "1 cup", 240, 1.5, 24, 0.3, fiber=1, sugar=18, sodium=50, tags=["heart_healthy"], sizes="drink")
add("عصير شمام", "Melon Juice", "beverage", "juices", ALL_ARAB, "كوب واحد", "1 cup", 240, 1, 20, 0.2, fiber=0.5, sugar=18, sodium=25, tags=[], sizes="drink")
add("عصير كمثرى", "Pear Juice", "beverage", "juices", ALL_ARAB, "كوب واحد", "1 cup", 240, 0.5, 26, 0.2, fiber=2, sugar=20, sodium=5, tags=["high_sugar"], sizes="drink")
add("عصير رمان بالبرتقال", "Pomegranate Orange Juice", "beverage", "juices", ["gulf"], "كوب واحد", "1 cup", 240, 1, 30, 0.3, fiber=0.5, sugar=26, sodium=5, tags=["high_sugar", "heart_healthy"], sizes="drink")
# --- More fish ---
add("بوري مقلي", "Fried Mullet", "fish_seafood", "fried_fish", ["egypt"], "سمكة وسط", "1 medium fish", 200, 34, 6, 14, fiber=0.5, sodium=420, tags=["contains_seafood", "fried"])
add("شعري مقلي", "Fried Sheri", "fish_seafood", "fried_fish", ["gulf"], "سمكة وسط", "1 medium fish", 200, 34, 6, 15, fiber=0.5, sodium=420, tags=["contains_seafood", "fried"])
add("هامور مقلي", "Fried Hamour", "fish_seafood", "fried_fish", ["gulf"], "قطعة وسط", "1 medium piece", 180, 32, 7, 14, fiber=0.5, sodium=400, tags=["contains_seafood", "fried", "contains_gluten"])
add("كنعد مقلي", "Fried Kingfish", "fish_seafood", "fried_fish", ["gulf"], "قطعة وسط", "1 medium piece", 180, 34, 7, 15, fiber=0.5, sodium=400, tags=["contains_seafood", "fried"])
add("بلطي بالفرن بالخضار", "Baked Tilapia with Vegetables", "fish_seafood", "baked_fish", ["egypt"], "سمكة وسط", "1 medium fish", 250, 36, 8, 6, fiber=2, sugar=3, sodium=350, tags=["contains_seafood", "high_protein", "heart_healthy"])
add("جمبري مشوي بالثوم", "Garlic Grilled Shrimp", "fish_seafood", "shellfish", ALL_ARAB, "10 حبات", "10 pieces", 150, 26, 3, 5, fiber=0, sodium=450, tags=["contains_seafood", "high_protein", "gout_caution"])
add("كالماري مشوي", "Grilled Calamari", "fish_seafood", "shellfish", INTL, "صحن وسط", "1 medium plate", 150, 24, 4, 4, fiber=0, sodium=400, tags=["contains_seafood", "high_protein"])
add("سلمون بالفرن بالأعشاب", "Baked Salmon with Herbs", "fish_seafood", "baked_fish", INTL, "قطعة وسط", "1 medium fillet", 160, 34, 2, 14, fiber=0.5, sodium=250, tags=["contains_seafood", "high_protein", "heart_healthy"])
# --- Camel products (Gulf) ---
add("حليب إبل", "Camel Milk", "dairy", "milk", ["gulf"], "كوب واحد (240 مل)", "1 cup (240ml)", 240, 6.5, 11, 5.5, sugar=11, sodium=110, tags=["contains_lactose"], quality="reference")
add("لحم حاشي مشوي", "Grilled Camel Meat", "meat", "grilled_meats", ["gulf"], "قطعة وسط (150 غ)", "1 medium piece (150g)", 150, 33, 0, 6, sodium=90, tags=["high_protein", "heart_healthy"], quality="reference")
add("برجر حاشي", "Camel Burger", "fast_food", "burgers", ["gulf"], "ساندويتش وسط", "1 medium sandwich", 230, 22, 40, 12, fiber=2, sugar=5, sodium=750, tags=["contains_gluten", "processed"])
# --- Sudanese ---
add("كسرة بالملاح", "Kissra with Mullah", "rice_main", "sudanese", ["north_africa"], "صحن وسط", "1 medium plate", 380, 18, 65, 10, fiber=5, sugar=3, sodium=700, tags=["contains_gluten"])
add("ملاح بامية", "Mullah Bamia (Okra Stew)", "rice_main", "sudanese", ["north_africa"], "صحن وسط", "1 medium bowl", 320, 18, 20, 12, fiber=5, sugar=4, sodium=680)
add("عصيدة بالتقلية", "Aseeda with Tagalia", "rice_main", "sudanese", ["north_africa"], "صحن وسط", "1 medium bowl", 350, 12, 55, 12, fiber=3, sugar=2, sodium=600, tags=["contains_gluten"])
add("فول سوداني بالتقلية", "Peanut Tagalia Stew", "rice_main", "sudanese", ["north_africa"], "صحن وسط", "1 medium bowl", 320, 14, 20, 18, fiber=4, sugar=3, sodium=650, tags=["contains_nuts"])
add("قراصة", "Gurasa (Sudanese Flatbread)", "bread_grain", "sudanese", ["north_africa"], "قطعة وسط", "1 medium piece", 100, 6, 48, 2, fiber=2, sugar=1, sodium=250, tags=["contains_gluten"])
add("ملاح روب (لبن)", "Mullah Rob (Yogurt Stew)", "rice_main", "sudanese", ["north_africa"], "صحن وسط", "1 medium bowl", 300, 12, 18, 10, fiber=2, sugar=5, sodium=600, tags=["contains_lactose"])
# --- Libyan ---
add("بازين باللحم", "Bazeen with Meat", "rice_main", "libyan", ["maghreb"], "صحن وسط", "1 medium plate", 400, 26, 60, 16, fiber=5, sugar=3, sodium=750, tags=["whole_grain"])
add("عصبان ليبي", "Libyan Osban", "rice_main", "libyan", ["maghreb"], "صحن وسط", "1 medium plate", 320, 14, 35, 16, fiber=2, sugar=1, sodium=850, tags=["processed", "high_sodium"])
add("مبطن ليبي", "Libyan Mbatten", "rice_main", "libyan", ["maghreb"], "4 قطع", "4 pieces", 200, 12, 25, 14, fiber=2, sugar=2, sodium=600, tags=["fried"])
add("شربة ليبية", "Libyan Sharba Soup", "soup", "maghreb_soups", ["maghreb"], "صحن وسط", "1 medium bowl", 300, 10, 35, 6, fiber=3, sugar=3, sodium=750, tags=["contains_gluten"])
add("حساء ليبي بالحمص", "Libyan Hassa with Chickpeas", "soup", "maghreb_soups", ["maghreb"], "صحن وسط", "1 medium bowl", 300, 12, 30, 7, fiber=7, sugar=3, sodium=700, tags=["high_fiber"])
# --- Tunisian ---
add("لبلابي تونسي", "Lablabi (Chickpea Soup)", "soup", "maghreb_soups", ["maghreb"], "صحن وسط مع خبز", "1 medium bowl with bread", 350, 14, 45, 12, fiber=8, sugar=2, sodium=800, tags=["high_fiber", "contains_gluten"])
add("سلطة مشوية تونسية", "Tunisian Grilled Salad (Slata Mechouia)", "salad", "maghreb_salads", ["maghreb"], "صحن صغير", "1 small bowl", 150, 2, 12, 6, fiber=4, sugar=6, sodium=400, tags=["heart_healthy", "low_calorie"])
add("كمونية", "Kamounia (Cumin Meat Stew)", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium bowl", 320, 26, 8, 20, fiber=1, sugar=1, sodium=750, tags=["high_protein"])
add("كسكس بالأخطبوط", "Couscous with Octopus", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium plate", 420, 26, 78, 8, fiber=5, sugar=4, sodium=800, tags=["contains_seafood", "contains_gluten"])
add("بريك بالدجاج", "Brik with Chicken", "rice_main", "maghreb_mains", ["maghreb"], "قطعتان", "2 pieces", 180, 14, 30, 15, fiber=1, sugar=1, sodium=600, tags=["fried", "contains_gluten"])
add("فريكاسية تونسية", "Tunisian Fricassee Sandwich", "fast_food", "sandwiches", ["maghreb"], "ساندويتش وسط", "1 medium sandwich", 230, 14, 40, 14, fiber=2, sugar=2, sodium=800, tags=["contains_gluten", "contains_seafood", "fried"])
# --- Algerian ---
add("طمينة", "Tamina (Toasted Semolina Dessert)", "sweets", "maghreb_sweets", ["maghreb"], "صحن صغير", "1 small bowl", 120, 3, 30, 12, fiber=2, sugar=18, sodium=40, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("بوراك باللحم", "Bourek with Meat", "fast_food", "samboosa", ["maghreb"], "3 قطع", "3 pieces", 120, 10, 22, 14, fiber=1, sugar=1, sodium=550, tags=["fried", "contains_gluten", "contains_egg"])
add("بوراك بالجبن", "Bourek with Cheese", "fast_food", "samboosa", ["maghreb"], "3 قطع", "3 pieces", 120, 8, 22, 13, fiber=1, sugar=1, sodium=520, tags=["fried", "contains_gluten", "contains_lactose"])
add("شوربة فريك جزائرية", "Algerian Frik Soup", "soup", "maghreb_soups", ["maghreb"], "صحن وسط", "1 medium bowl", 300, 9, 32, 5, fiber=5, sugar=2, sodium=700, tags=["whole_grain", "contains_gluten"])
add("كسكس بالمرقاز", "Couscous with Merguez", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium plate", 440, 26, 80, 18, fiber=6, sugar=5, sodium=950, tags=["contains_gluten", "processed", "high_sodium"])
# --- Moroccan (more) ---
add("طنجية مراكشية", "Tanjia Marrakchia", "rice_main", "maghreb_mains", ["maghreb"], "صحن وسط", "1 medium bowl", 320, 30, 6, 22, fiber=1, sugar=1, sodium=700, tags=["high_protein"])
add("بيصارة", "Bissara (Fava Bean Soup)", "soup", "maghreb_soups", ["maghreb"], "صحن وسط", "1 medium bowl", 300, 12, 35, 8, fiber=9, sugar=2, sodium=600, tags=["high_fiber", "heart_healthy"])
add("سمك بالشرمولة", "Fish with Chermoula", "fish_seafood", "maghreb_fish", ["maghreb"], "صحن وسط", "1 medium plate", 280, 28, 8, 10, fiber=2, sugar=2, sodium=600, tags=["contains_seafood", "high_protein", "heart_healthy"])
add("دجاج محمر بالزيتون", "Moroccan Roasted Chicken with Olives", "poultry", "maghreb", ["maghreb"], "ربع دجاجة مع صلصة", "1/4 chicken with sauce", 300, 34, 8, 18, fiber=2, sugar=2, sodium=800, tags=["high_protein"])
add("زلوق (سلطة باذنجان)", "Zaalouk (Eggplant Salad)", "salad", "maghreb_salads", ["maghreb"], "صحن صغير", "1 small bowl", 150, 2, 12, 8, fiber=4, sugar=5, sodium=400, tags=["heart_healthy", "low_calorie"])
add("تقلية مغربية بالفول", "Moroccan Ful Tqlia", "legume", "maghreb", ["maghreb"], "صحن وسط", "1 medium bowl", 250, 12, 32, 8, fiber=9, sugar=2, sodium=550, tags=["high_fiber"])
# --- More Yemeni ---
add("مرسي يمني", "Yemeni Marsee (Banana Dessert)", "sweets", "arab_sweets", ["yemen"], "صحن صغير", "1 small bowl", 150, 2, 32, 6, fiber=2, sugar=24, sodium=40, tags=["high_sugar", "contains_lactose"])
add("مطبق سمك يمني", "Yemeni Mutabbaq Fish", "fish_seafood", "yemeni", ["yemen"], "صحن وسط", "1 medium plate", 300, 26, 30, 12, fiber=2, sugar=3, sodium=650, tags=["contains_seafood", "contains_gluten"])
add("عصيدة يمنية باللبن", "Yemeni Aseed with Yogurt", "rice_main", "yemeni", ["yemen"], "صحن وسط", "1 medium bowl", 300, 8, 50, 8, fiber=2, sugar=5, sodium=300, tags=["contains_gluten", "contains_lactose"])
add("مندي حاشي", "Camel Mandi", "rice_main", "yemeni", ["yemen", "gulf"], "صحن وسط", "1 medium plate", 420, 34, 80, 18, fiber=1.5, sugar=1, sodium=850, tags=["high_protein"])
add("شوربة عدس يمنية", "Yemeni Lentil Soup", "soup", "arab_soups", ["yemen"], "صحن وسط", "1 medium bowl", 300, 12, 34, 5, fiber=8, sugar=2, sodium=600, tags=["high_fiber"])
# --- More dairy ---
add("حليب ماعز", "Goat Milk", "dairy", "milk", ALL_ARAB, "كوب واحد (240 مل)", "1 cup (240ml)", 240, 8.5, 11, 10, sugar=11, sodium=120, tags=["contains_lactose"], quality="reference")
add("جبنة ماجدولي", "Majdouli Cheese", "dairy", "cheeses", ["levant"], "قطعة (40 غ)", "1 piece (40g)", 40, 8, 1, 7, sugar=0.5, sodium=500, tags=["contains_lactose", "high_sodium"], quality="reference")
add("قشطة بالعسل", "Qishta with Honey", "dairy", "creams", ALL_ARAB, "3 ملاعق كبيرة", "3 tbsp", 60, 2, 18, 15, sugar=17, sodium=40, tags=["contains_lactose", "high_sugar"])
add("لبنة مكدوسة بالزيت", "Labneh Balls in Olive Oil", "dairy", "cheeses", ["levant"], "3 حبات", "3 balls", 60, 6, 2, 12, sugar=1, sodium=400, tags=["contains_lactose", "heart_healthy"])
add("زبادي بالثوم (للبنانية)", "Garlic Yogurt", "dairy", "dips", ["levant"], "4 ملاعق كبيرة", "4 tbsp", 80, 5, 5, 3, sugar=4, sodium=300, tags=["contains_lactose", "low_calorie"])
# --- More sweets ---
add("شعيبيات", "Shueibiyat", "sweets", "arab_sweets", ["levant"], "2 قطعة", "2 pieces", 90, 4, 34, 14, fiber=1, sugar=22, sodium=100, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("برمة بالفستق", "Burma with Pistachios", "sweets", "arab_sweets", ["levant"], "3 قطع", "3 pieces", 75, 4, 28, 13, fiber=1, sugar=18, sodium=90, tags=["contains_gluten", "contains_nuts", "high_sugar", "fried"])
add("بلورية", "Ballourieh", "sweets", "arab_sweets", ["levant"], "قطعة وسط", "1 medium piece", 90, 4, 34, 12, fiber=1.5, sugar=20, sodium=80, tags=["contains_gluten", "contains_nuts", "high_sugar"])
add("حلاوة شعر بنجلي (جيلابي)", "Jalebi", "sweets", "arab_sweets", INTL, "4 قطع", "4 pieces", 100, 2, 40, 8, fiber=0.5, sugar=28, sodium=60, tags=["contains_gluten", "high_sugar", "fried"])
add("كيكة العسل", "Honey Cake", "sweets", "cakes", INTL, "قطعة وسط", "1 medium slice", 90, 4, 38, 10, fiber=0.5, sugar=26, sodium=200, tags=["contains_gluten", "contains_egg", "high_sugar"])
add("مافن شوكولاتة", "Chocolate Muffin", "sweets", "cakes", INTL, "قطعة واحدة", "1 piece", 90, 4, 34, 13, fiber=1.5, sugar=20, sodium=240, tags=["contains_gluten", "contains_egg", "high_sugar"])
add("كب كيك فانيلا", "Vanilla Cupcake", "sweets", "cakes", INTL, "قطعة واحدة", "1 piece", 70, 3, 28, 10, fiber=0.5, sugar=18, sodium=180, tags=["contains_gluten", "contains_egg", "contains_lactose", "high_sugar"])
add("كنافة كوكتيل", "Kunafa Cocktail", "sweets", "arab_sweets", ["egypt"], "قطعة وسط", "1 medium piece", 160, 6, 52, 16, fiber=1.5, sugar=34, sodium=180, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("قطايف عصافيري", "Qatayef Asafiri", "sweets", "arab_sweets", ["levant"], "4 قطع", "4 pieces", 100, 4, 30, 10, fiber=0.5, sugar=18, sodium=80, tags=["contains_gluten", "contains_lactose", "high_sugar"])
add("مربى تين", "Fig Jam", "sweets", "sweeteners", ALL_ARAB, "ملعقة كبيرة", "1 tbsp", 20, 0, 13, 0, fiber=0.3, sugar=10, sodium=5, tags=["high_sugar"], quality="reference", sizes=[])
# --- More breakfast ---
add("جبن أبيض بالطماطم", "White Cheese with Tomatoes", "egg_breakfast", "breakfast_dishes", ["egypt"], "صحن صغير", "1 small plate", 150, 10, 6, 9, fiber=1, sugar=3, sodium=550, tags=["contains_lactose"])
add("فول بالفلافل", "Foul with Falafel", "egg_breakfast", "breakfast_dishes", ["egypt"], "صحن وسط", "1 medium bowl", 300, 14, 40, 12, fiber=10, sugar=2, sodium=700, tags=["fried", "high_fiber"])
add("شكشوكة بالمرقاز", "Shakshuka with Merguez", "egg_breakfast", "breakfast_dishes", ["maghreb"], "صحن وسط", "1 medium plate", 300, 18, 12, 20, fiber=2, sugar=5, sodium=850, tags=["contains_egg", "processed", "high_sodium"])
add("أومليت إسبانية (تورتيا بطاطس)", "Spanish Tortilla", "egg_breakfast", "breakfast_dishes", INTL, "قطعة وسط", "1 medium piece", 180, 10, 20, 12, fiber=2, sugar=2, sodium=350, tags=["contains_egg", "fried"])
add("بيض بالعدس (فطور دايت)", "Eggs with Lentils", "egg_breakfast", "breakfast_dishes", INTL, "صحن وسط", "1 medium plate", 250, 18, 22, 8, fiber=7, sugar=2, sodium=400, tags=["contains_egg", "high_fiber", "high_protein", "heart_healthy"])
add("توست بالأفوكادو والبيض", "Avocado Toast with Egg", "egg_breakfast", "breakfast_dishes", INTL, "شريحتان", "2 slices", 220, 12, 30, 14, fiber=6, sugar=2, sodium=400, tags=["contains_gluten", "contains_egg", "heart_healthy", "high_fiber"])
add("زبادي بالجرانولا", "Yogurt with Granola", "egg_breakfast", "breakfast_dishes", INTL, "كوب واحد", "1 cup", 230, 10, 36, 8, fiber=3, sugar=18, sodium=80, tags=["contains_lactose", "whole_grain", "contains_nuts"])
add("فطائر الذرة (كورن بريد)", "Corn Pancakes", "egg_breakfast", "breakfast_dishes", INTL, "3 قطع", "3 pieces", 130, 6, 38, 8, fiber=2, sugar=8, sodium=300, tags=["contains_gluten", "contains_egg"])
# --- More meats ---
add("كفتة دجاج مشوية", "Grilled Chicken Kofta", "meat", "grilled_meats", ALL_ARAB, "4 أصابع", "4 fingers", 160, 24, 5, 10, fiber=0.5, sodium=550, tags=["high_protein"])
add("لحم بالفرن مع الخضار", "Roast Beef with Vegetables", "meat", "baked_dishes", ALL_ARAB, "صحن وسط", "1 medium plate", 350, 32, 18, 14, fiber=3, sugar=4, sodium=600, tags=["high_protein"])
add("مفروم بالبشاميل", "Minced Meat Bechamel Bake", "meat", "baked_dishes", ["egypt"], "صحن وسط", "1 medium plate", 320, 20, 20, 18, fiber=1, sugar=4, sodium=650, tags=["contains_lactose", "contains_gluten"])
add("قلبية (قلوب وكبدة مشكلة)", "Mixed Heart and Liver Fry", "meat", "organ_meats", ["egypt"], "صحن وسط", "1 medium plate", 200, 24, 4, 12, sodium=500, tags=["gout_caution", "kidney_caution", "fried"])
add("مومبار بالفرن", "Baked Mombar", "meat", "processed_meats", ["egypt"], "صحن وسط", "1 medium plate", 280, 12, 32, 16, fiber=2, sugar=1, sodium=850, tags=["processed", "high_sodium"])
add("كفتة مشوية بالفحم", "Charcoal Grilled Kofta", "meat", "grilled_meats", ALL_ARAB, "4 أصابع", "4 fingers", 160, 26, 5, 18, fiber=0.5, sodium=600, tags=["high_protein", "gout_caution"])
add("لحم بقري بالفلفل الأسود", "Black Pepper Beef", "meat", "stir_fry", INTL, "صحن وسط", "1 medium plate", 280, 28, 10, 14, fiber=1, sugar=3, sodium=800, tags=["high_protein", "high_sodium"])
add("مقادم (أرجل الخروف)", "Sheep Trotters (Maqadim)", "meat", "stews", ["levant", "iraq"], "صحن وسط", "1 medium bowl", 300, 20, 2, 16, sodium=700, tags=["kidney_caution"])
# --- More packaged ---
add("شوربة كريمة معلبة", "Canned Cream Soup", "packaged_snack", "canned", ALL_ARAB, "علبة (300 مل)", "1 can (300ml)", 300, 5, 20, 10, fiber=1, sugar=4, sodium=950, tags=["processed", "high_sodium", "contains_lactose"])
add("خضار مشكلة معلبة", "Canned Mixed Vegetables", "packaged_snack", "canned", ALL_ARAB, "نصف كوب مصفى", "1/2 cup drained", 120, 2, 10, 0.3, fiber=3, sugar=3, sodium=350, tags=["processed", "low_calorie"], quality="reference")
add("فاصوليا حمراء معلبة", "Canned Red Beans", "packaged_snack", "canned", ALL_ARAB, "نصف كوب مصفى", "1/2 cup drained", 130, 8, 20, 0.5, fiber=6, sugar=1, sodium=400, tags=["processed", "high_fiber"], quality="reference")
add("حليب مبخر", "Evaporated Milk", "packaged_snack", "dairy", ALL_ARAB, "ربع كوب", "1/4 cup", 60, 4, 6, 4, sugar=6, sodium=60, tags=["contains_lactose", "processed"], quality="reference")
add("كريمة خفق بودرة", "Whipped Cream Powder (Prepared)", "packaged_snack", "dairy", ALL_ARAB, "3 ملاعق كبيرة", "3 tbsp", 45, 0.5, 6, 8, sugar=5, sodium=20, tags=["processed", "contains_lactose"])
add("بسكويت ماري", "Marie Biscuits", "packaged_snack", "biscuits", ALL_ARAB, "4 قطع", "4 pieces", 28, 2, 20, 3, fiber=0.5, sugar=5, sodium=90, tags=["processed", "contains_gluten"], quality="reference")
add("بسكويت بالشوكولاتة", "Chocolate Coated Biscuits", "packaged_snack", "biscuits", ALL_ARAB, "3 قطع", "3 pieces", 36, 2, 24, 8, fiber=1, sugar=14, sodium=80, tags=["processed", "high_sugar", "contains_gluten"])
add("رقائق تاكو مقرمشة", "Crunchy Taco Shells", "packaged_snack", "chips", INTL, "3 قطع", "3 shells", 40, 2, 22, 7, fiber=2, sugar=0.5, sodium=180, tags=["processed", "fried"])

# ===========================================================================
# 22) VARIANT ENGINE — cooking methods, sweetening, portions
# ===========================================================================
def _by_name(sub):
    return [f for f in _foods if sub in f["name_ar"]]

_extra = []

# (a) Raw vegetables → boiled (مسلوق) and lightly sauteed (مشوح بقليل من الزيت)
for f in [x for x in _foods if x["category"] == "vegetable" and x["subcategory"] == "fresh_vegetables"]:
    _extra.append(variant(f, "مسلوق", "boiled", scale=1.0, dsodium=8))
    _extra.append(variant(f, "مشوح بقليل من الزيت", "lightly sauteed", scale=1.0, df=4.0))

# (b) Grilled meats/poultry/fish → fried version (مقلي): oil absorption ~+9g fat
for f in [x for x in _foods
          if ("مشوي" in x["name_ar"] or x["subcategory"] == "grilled_meats")
          and x["category"] in ("meat", "poultry", "fish_seafood")
          and "مقلي" not in x["name_ar"]]:
    _extra.append(variant(f, "مقلي", "fried", scale=1.0, dc=2.0, df=9.0,
                          add_tags=["fried"]))

# (c) Selected fried items → oven-baked version (بالفرن): less fat
for f in [x for x in _foods if "مقلي" in x["name_ar"] or "fried" in x["tags"]]:
    if f["category"] in ("poultry", "fish_seafood", "fast_food", "rice_main") and "فلافل" not in f["name_ar"]:
        _extra.append(variant(f, "بالفرن", "oven-baked", scale=1.0,
                              df=-max(0.0, min(8.0, f["fat_g"] * 0.4)),
                              dsodium=-50, drop_tags=["fried"]))

# (d) Unsweetened hot beverages → sweetened version (+10g sugar)
for f in [x for x in _foods if x["category"] == "beverage"
          and x["sugar_g"] <= 1 and x["subcategory"] in ("coffee", "tea", "herbal")]:
    _extra.append(variant(f, "بالسكر", "with sugar", scale=1.0, dc=10.0, dsugar=10.0,
                          drop_tags=["diabetic_friendly"]))

# (e) Black tea/coffee → with a splash of milk
for f in [x for x in _foods if x["name_ar"] in ("شاي أسود (بدون سكر)", "قهوة أمريكانو")]:
    _extra.append(variant(f, "بقليل من الحليب", "with a splash of milk",
                          scale=1.0, dp=1.5, dc=2.0, df=1.5, dsugar=2.0, dsodium=20,
                          add_tags=["contains_lactose"]))

_foods.extend(_extra)

# Portion-size expansion
_final = []
for f in _foods:
    sizes = f.pop("_sizes")
    _final.append(f)
    for (sar, sen, k) in sizes:
        _final.append(variant(f, sar, sen, scale=k))

# ===========================================================================
# 23) SLUGS, VALIDATION, OUTPUT
# ===========================================================================
def assign_ids(items):
    seen = {}
    for it in items:
        base = _slug(it["name_en"])
        sid = base
        n = 2
        while sid in seen:
            sid = f"{base}-{n}"
            n += 1
        seen[sid] = True
        it2 = dict(it)
        it2["id"] = sid
        it2.pop("_sizes", None)
        yield it2


def validate(items):
    assert len(items) >= 5000, f"only {len(items)} items (<5000)"
    ids = set()
    keys = set()
    for it in items:
        assert it["id"] not in ids, f"dup id {it['id']}"
        ids.add(it["id"])
        key = (it["name_ar"], it["serving_desc_ar"], it["portion_grams"])
        assert key not in keys, f"dup name+portion: {key}"
        keys.add(key)
        assert it["category"] in CATEGORIES
        assert set(it["region"]) <= set(REGIONS)
        assert set(it["tags"]) <= TAG_VOCAB, set(it["tags"]) - TAG_VOCAB
        for m in ("protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g"):
            assert it[m] >= 0, (it["id"], m)
        est = 4 * it["protein_g"] + 4 * it["carbs_g"] + 9 * it["fat_g"]
        if it["calories"] > 20:
            assert abs(est - it["calories"]) / it["calories"] <= 0.15, (
                it["id"], est, it["calories"])
        assert it["portion_grams"] > 0
        assert it["source_quality"] in ("estimated", "reference")


def main():
    items = list(assign_ids(_final))
    validate(items)
    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(items),
        "disclaimer_ar": "القيم الغذائية في هذه القاعدة تقديرات إرشادية أعدّها مختصو تغذية لأغراض التوعية فقط، وقد تختلف حسب طريقة التحضير والمكونات. هذه المعلومات ليست نصيحة طبية ولا تغني عن استشارة الطبيب أو أخصائي التغذية، خاصة لمرضى السكري والضغط والكلى والأمراض المزمنة.",
        "disclaimer_en": "Nutrition values in this database are dietitian-estimated reference values for general guidance only and may vary with preparation and ingredients. This is not medical advice and does not replace consultation with a physician or registered dietitian, especially for people with diabetes, hypertension, kidney disease, or other chronic conditions.",
        "regions": REGIONS,
        "categories": CATEGORIES,
        "tag_vocabulary": sorted(TAG_VOCAB),
        "source_note_en": "Composite dishes are dietitian estimates pending lab-verified sources; plain ingredients follow common nutrition-table values.",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"_meta": meta, "items": items}, fh, ensure_ascii=False, indent=1)
    # report
    from collections import Counter
    cats = Counter(i["category"] for i in items)
    refs = sum(1 for i in items if i["source_quality"] == "reference")
    print(f"OK: {len(items)} items -> {OUT}")
    print(f"reference-quality: {refs} | estimated: {len(items) - refs}")
    for c in CATEGORIES:
        print(f"  {c:16s} {cats.get(c, 0)}")


if __name__ == "__main__":
    main()
