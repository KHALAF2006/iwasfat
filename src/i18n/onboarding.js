/**
 * Onboarding wizard translations (profile setup at /register).
 *
 * This module is intentionally standalone: the parent app merges these
 * dictionaries into the central ar/en dictionaries. Pages consume it via
 * t('onboarding.xxx') once merged.
 */

export const ar = {
  onboarding: {
    title: "إعداد ملفك الشخصي",
    titleUpdate: "تحديث ملفك الشخصي",
    subtitle: "ثلاث خطوات سريعة ونبدأ رحلتك معاً",
    stepOf: "الخطوة {{step}} من {{total}}",
    steps: {
      phone: "رقم الجوال",
      birth: "تاريخ الميلاد",
      body: "الجسم والصحة",
    },
    back: "رجوع",
    next: "التالي",
    submit: "حفظ وبدء التجربة",
    updateSubmit: "حفظ التغييرات",

    phone: {
      country: "الدولة",
      search: "ابحث عن دولة…",
      noResults: "لا توجد نتائج مطابقة",
      number: "رقم الجوال",
      placeholder: "5XXXXXXXX",
      hint: "{{digits}} أرقام تبدأ بـ {{start}}",
      hintPlain: "{{digits}} أرقام",
      preview: "سيُحفظ رقمك بالصيغة الدولية:",
      errRequired: "أدخل رقم الجوال أولاً",
      errLength: "الرقم غير مكتمل — المطلوب {{digits}} أرقام",
      errStart: "الرقم يجب أن يبدأ بـ {{start}}",
    },

    birth: {
      year: "السنة",
      month: "الشهر",
      day: "اليوم",
      months: [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
      ],
      age: "عمرك",
      years: "سنة",
      ageGroup: {
        under18: "أقل من ١٨",
        g18_29: "١٨ – ٢٩",
        g30_44: "٣٠ – ٤٤",
        g45_59: "٤٥ – ٥٩",
        g60plus: "٦٠+",
      },
      errYoung: "العمر يجب أن يكون ١٠ سنوات على الأقل",
      errOld: "تأكد من تاريخ الميلاد — العمر أكبر من ١٠٠ سنة",
    },

    body: {
      fullName: "الاسم الكامل",
      fullNamePlaceholder: "اكتب اسمك الكامل",
      gender: "الجنس",
      male: "ذكر",
      female: "أنثى",
      height: "الطول",
      currentWeight: "الوزن الحالي",
      targetWeight: "الوزن المستهدف",
      cm: "سم",
      kg: "كجم",
      bmi: "مؤشر كتلة الجسم",
      bmiCat: {
        underweight: "نحافة",
        normal: "طبيعي",
        overweight: "زيادة وزن",
        obese: "سمنة",
      },
      activity: "مستوى النشاط",
      activityLevels: {
        sedentary: "خامل",
        sedentaryDesc: "عمل مكتبي وحركة قليلة جداً",
        light: "خفيف",
        lightDesc: "مشي أو نشاط خفيف ١–٣ أيام أسبوعياً",
        moderate: "متوسط",
        moderateDesc: "تمارين رياضية ٣–٥ أيام أسبوعياً",
        active: "نشيط",
        activeDesc: "تمارين يومية أو عمل بدني شاق",
      },
      chronicQuestion: "هل لديك أمراض مزمنة؟",
      chronicDetails: "اذكر التفاصيل",
      chronicPlaceholder: "مثال: سكري، ضغط دم، غدة درقية…",
      cautionTitle: "تنبيه صحي",
      caution: "سنراعي حالتك الصحية في الخطط، لكن هذا لا يغني عن استشارة طبيبك المختص.",
    },

    errors: {
      invalidPhone: "رقم الجوال غير صحيح، تأكد من الدولة والرقم",
      invalidData: "بعض البيانات غير مكتملة أو غير صحيحة، راجع الخطوات",
      serverError: "حدث خطأ في الخادم، حاول مرة أخرى بعد قليل",
      loadFailed: "تعذر تحميل بياناتك الحالية",
    },

    success: {
      title: "أهلاً بك في iWasFat 🎉",
      subtitle: "تم إعداد ملفك بنجاح، رحلتك تبدأ الآن",
      groupLabel: "مجموعتك",
      groupPending: "سيتم إسنادك لمجموعة قريباً",
      trialLabel: "الفترة التجريبية",
      trialValue: "٧ أيام مجاناً — تنتهي في {{date}}",
      trialNoDate: "٧ أيام مجاناً",
      cta: "ابدأ الآن",
    },
  },
};

export const en = {
  onboarding: {
    title: "Set up your profile",
    titleUpdate: "Update your profile",
    subtitle: "Three quick steps and your journey begins",
    stepOf: "Step {{step}} of {{total}}",
    steps: {
      phone: "Phone number",
      birth: "Date of birth",
      body: "Body & health",
    },
    back: "Back",
    next: "Next",
    submit: "Save & start trial",
    updateSubmit: "Save changes",

    phone: {
      country: "Country",
      search: "Search countries…",
      noResults: "No matching countries",
      number: "Mobile number",
      placeholder: "5XXXXXXXX",
      hint: "{{digits}} digits starting with {{start}}",
      hintPlain: "{{digits}} digits",
      preview: "Your number will be saved as:",
      errRequired: "Enter your mobile number first",
      errLength: "Incomplete number — {{digits}} digits required",
      errStart: "Number must start with {{start}}",
    },

    birth: {
      year: "Year",
      month: "Month",
      day: "Day",
      months: [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ],
      age: "Your age",
      years: "years",
      ageGroup: {
        under18: "Under 18",
        g18_29: "18 – 29",
        g30_44: "30 – 44",
        g45_59: "45 – 59",
        g60plus: "60+",
      },
      errYoung: "You must be at least 10 years old",
      errOld: "Please check the date — age is over 100",
    },

    body: {
      fullName: "Full name",
      fullNamePlaceholder: "Enter your full name",
      gender: "Gender",
      male: "Male",
      female: "Female",
      height: "Height",
      currentWeight: "Current weight",
      targetWeight: "Target weight",
      cm: "cm",
      kg: "kg",
      bmi: "Body mass index",
      bmiCat: {
        underweight: "Underweight",
        normal: "Normal",
        overweight: "Overweight",
        obese: "Obese",
      },
      activity: "Activity level",
      activityLevels: {
        sedentary: "Sedentary",
        sedentaryDesc: "Desk job, very little movement",
        light: "Light",
        lightDesc: "Walking or light activity 1–3 days/week",
        moderate: "Moderate",
        moderateDesc: "Exercise 3–5 days/week",
        active: "Active",
        activeDesc: "Daily exercise or physical labor",
      },
      chronicQuestion: "Do you have chronic diseases?",
      chronicDetails: "Add the details",
      chronicPlaceholder: "e.g. diabetes, hypertension, thyroid…",
      cautionTitle: "Health note",
      caution: "We'll consider your condition in your plans, but this is not a substitute for consulting your physician.",
    },

    errors: {
      invalidPhone: "The phone number is invalid — check the country and number",
      invalidData: "Some details are missing or invalid — review the steps",
      serverError: "A server error occurred, please try again shortly",
      loadFailed: "Couldn't load your current data",
    },

    success: {
      title: "Welcome to iWasFat 🎉",
      subtitle: "Your profile is ready — your journey starts now",
      groupLabel: "Your group",
      groupPending: "You'll be assigned to a group soon",
      trialLabel: "Free trial",
      trialValue: "7 free days — ends {{date}}",
      trialNoDate: "7 free days",
      cta: "Start now",
    },
  },
};

export default { ar, en };
