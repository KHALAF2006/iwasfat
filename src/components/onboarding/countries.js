/**
 * Gulf & Arab country dialing metadata for the onboarding phone step.
 *
 * - `code`   : international dial code without '+'
 * - `len`    : [min, max] length of the national significant number
 *              (after stripping the trunk '0')
 * - `start`  : optional required first digit (mobile ranges) used for
 *              inline validation hints
 */
export const COUNTRIES = [
  // Gulf first — Saudi Arabia is the default
  { code: "966", iso: "SA", flag: "🇸🇦", ar: "السعودية", en: "Saudi Arabia", len: [9, 9], start: "5" },
  { code: "971", iso: "AE", flag: "🇦🇪", ar: "الإمارات", en: "UAE", len: [9, 9], start: "5" },
  { code: "965", iso: "KW", flag: "🇰🇼", ar: "الكويت", en: "Kuwait", len: [8, 8] },
  { code: "974", iso: "QA", flag: "🇶🇦", ar: "قطر", en: "Qatar", len: [8, 8] },
  { code: "973", iso: "BH", flag: "🇧🇭", ar: "البحرين", en: "Bahrain", len: [8, 8] },
  { code: "968", iso: "OM", flag: "🇴🇲", ar: "عُمان", en: "Oman", len: [8, 8] },
  // Rest of the Arab world
  { code: "20", iso: "EG", flag: "🇪🇬", ar: "مصر", en: "Egypt", len: [10, 10], start: "1" },
  { code: "962", iso: "JO", flag: "🇯🇴", ar: "الأردن", en: "Jordan", len: [9, 9], start: "7" },
  { code: "961", iso: "LB", flag: "🇱🇧", ar: "لبنان", en: "Lebanon", len: [7, 8] },
  { code: "963", iso: "SY", flag: "🇸🇾", ar: "سوريا", en: "Syria", len: [9, 9] },
  { code: "964", iso: "IQ", flag: "🇮🇶", ar: "العراق", en: "Iraq", len: [10, 10], start: "7" },
  { code: "967", iso: "YE", flag: "🇾🇪", ar: "اليمن", en: "Yemen", len: [9, 9] },
  { code: "970", iso: "PS", flag: "🇵🇸", ar: "فلسطين", en: "Palestine", len: [9, 9] },
  { code: "218", iso: "LY", flag: "🇱🇾", ar: "ليبيا", en: "Libya", len: [9, 10] },
  { code: "216", iso: "TN", flag: "🇹🇳", ar: "تونس", en: "Tunisia", len: [8, 8] },
  { code: "213", iso: "DZ", flag: "🇩🇿", ar: "الجزائر", en: "Algeria", len: [9, 9] },
  { code: "212", iso: "MA", flag: "🇲🇦", ar: "المغرب", en: "Morocco", len: [9, 9] },
  { code: "249", iso: "SD", flag: "🇸🇩", ar: "السودان", en: "Sudan", len: [9, 9] },
  { code: "252", iso: "SO", flag: "🇸🇴", ar: "الصومال", en: "Somalia", len: [7, 9] },
  { code: "253", iso: "DJ", flag: "🇩🇯", ar: "جيبوتي", en: "Djibouti", len: [8, 8] },
  { code: "269", iso: "KM", flag: "🇰🇲", ar: "جزر القمر", en: "Comoros", len: [7, 7] },
  { code: "222", iso: "MR", flag: "🇲🇷", ar: "موريتانيا", en: "Mauritania", len: [8, 8] },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Saudi Arabia

/** Digits only, leading (trunk) zeros stripped. */
export const stripNational = (value) =>
  String(value || "").replace(/\D/g, "").replace(/^0+/, "");

/**
 * Validate a stripped national number against a country.
 * Returns { ok: true } or { ok: false, reason: 'required'|'length'|'start' }.
 */
export const validateNational = (country, national) => {
  if (!national) return { ok: false, reason: "required" };
  const [min, max] = country.len;
  if (national.length < min || national.length > max) {
    return { ok: false, reason: "length" };
  }
  if (country.start && !national.startsWith(country.start)) {
    return { ok: false, reason: "start" };
  }
  return { ok: true };
};

/** Compose the E.164 string sent to the backend. */
export const composeE164 = (country, national) => `+${country.code}${national}`;

/**
 * Split a stored E.164 phone back into { country, national } for prefill.
 * Returns null when the dial code is outside our allowed list.
 */
export const parseE164 = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  const country = COUNTRIES.find((c) => digits.startsWith(c.code));
  if (!country) return null;
  return { country, national: digits.slice(country.code.length).replace(/^0+/, "") };
};
