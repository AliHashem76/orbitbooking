/** Country-aware phone validation (E.164-ish national formats). */

const PATTERNS: Record<string, RegExp> = {
  Lebanon: /^(?:\+?961|0)?(?:3|70|71|76|78|79|81)\d{6}$/,
  Jordan: /^(?:\+?962|0)?7[789]\d{7}$/,
  "Saudi Arabia": /^(?:\+?966|0)?5\d{8}$/,
  UAE: /^(?:\+?971|0)?5\d{8}$/,
  Egypt: /^(?:\+?20|0)?1[0125]\d{8}$/,
  Syria: /^(?:\+?963|0)?9\d{8}$/,
  Iraq: /^(?:\+?964|0)?7\d{9}$/,
  Kuwait: /^(?:\+?965)?[569]\d{7}$/,
  Qatar: /^(?:\+?974)?[3567]\d{7}$/,
  Bahrain: /^(?:\+?973)?[36]\d{7}$/,
  Oman: /^(?:\+?968)?[79]\d{7}$/,
  Palestine: /^(?:\+?970|0)?5\d{8}$/,
  Turkey: /^(?:\+?90|0)?5\d{9}$/,
  "United States": /^(?:\+?1)?[2-9]\d{9}$/,
  "United Kingdom": /^(?:\+?44|0)?7\d{9}$/,
};

export const COUNTRIES = Object.keys(PATTERNS).sort();

export function validatePhoneForCountry(phone: string, country: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  const pattern = PATTERNS[country] ?? /^(?:\+?\d{8,15})$/;
  return pattern.test(cleaned);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, "");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "LBP",
  "JOD",
  "SAR",
  "AED",
  "EGP",
  "KWD",
  "QAR",
  "BHD",
  "OMR",
  "TRY",
] as const;

export const TIMEZONES = [
  "Asia/Beirut",
  "Asia/Amman",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Africa/Cairo",
  "Asia/Damascus",
  "Asia/Baghdad",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Bahrain",
  "Asia/Muscat",
  "Asia/Gaza",
  "Europe/Istanbul",
  "America/New_York",
  "Europe/London",
  "UTC",
] as const;

export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar" : "en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
