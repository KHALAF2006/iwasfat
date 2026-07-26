import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import ar from './ar';
import en from './en';
import { ar as authAr, en as authEn } from './auth';
import { ar as onboardingAr, en as onboardingEn } from './onboarding';
import { ar as adminSubsAr, en as adminSubsEn } from './adminSubs';

// Feature dictionaries live in their own files (auth.js, onboarding.js,
// adminSubs.js) to keep parallel work conflict-free. Each exports a single
// top-level block ({ auth: {...} } etc.) which is merged over the base
// dictionary here — new keys override, untouched base keys survive.
const mergeFeature = (base, ...features) => {
  const out = { ...base };
  for (const f of features) {
    for (const [k, v] of Object.entries(f || {})) {
      out[k] = { ...(out[k] || {}), ...v };
    }
  }
  return out;
};

const dictionaries = {
  ar: mergeFeature(ar, authAr, onboardingAr, adminSubsAr),
  en: mergeFeature(en, authEn, onboardingEn, adminSubsEn),
};
const STORAGE_KEY = 'iwasfat_language';

const LanguageContext = createContext(null);

const resolvePath = (obj, path) => {
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
};

const interpolate = (str, vars) => {
  if (!vars || typeof str !== 'string') return str;
  // Wrap every interpolated value in Unicode First-Strong-Isolate … Pop
  // Isolate (⁦…⁩). Latin values (names like "khalaf", emails, dates)
  // embedded in Arabic sentences otherwise break bidi ordering and render
  // as garbled mixed text.
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = vars[k] != null ? String(vars[k]) : `{{${k}}}`;
    return `⁦${v}⁩`;
  });
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'en' || stored === 'ar' ? stored : 'ar';
    } catch {
      return 'ar';
    }
  });

  const isRTL = language === 'ar';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // storage unavailable (private mode) — ignore
    }
  }, [language, isRTL]);

  const setLanguage = useCallback((lang) => {
    if (lang === 'ar' || lang === 'en') setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = dictionaries[language] || ar;
      let value = resolvePath(dict, key);
      if (value === undefined) value = resolvePath(ar, key); // fallback to Arabic
      if (value === undefined) return key; // last resort: the key itself
      if (typeof value === 'string') return interpolate(value, vars);
      return value;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

// Convenience hook: const t = useT();
export function useT() {
  return useLanguage().t;
}
