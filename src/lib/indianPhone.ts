/**
 * Indian mobile validation (mirror server/indianPhone.mjs rules).
 */

export const INDIAN_PHONE_ERROR_INVALID =
  'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
export const INDIAN_PHONE_ERROR_FAKE =
  'That mobile number is not accepted. Please enter a valid phone number.';

export function sanitizeIndianPhoneDigits(raw: string): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  while (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  while (d.length > 10 && d.startsWith('0')) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d;
}

/** For controlled inputs: digits only, max length 10 after country-code stripping. */
export function clampIndianPhoneInput(raw: string): string {
  return sanitizeIndianPhoneDigits(raw).slice(0, 10);
}

export function isValidIndianMobile10(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits);
}

export function isObviousFakeRepeatedDigits(digits: string): boolean {
  return /^(\d)\1{9}$/.test(digits);
}

export type IndianPhoneValidation = { ok: true; digits: string } | { ok: false; error: string };

/** Narrows `validateIndianPhone` results (strict TS / IDE friendly). */
export function isIndianPhoneValid(v: IndianPhoneValidation): v is { ok: true; digits: string } {
  return v.ok;
}

export function validateIndianPhone(raw: string): IndianPhoneValidation {
  const d = sanitizeIndianPhoneDigits(raw);
  if (d.length !== 10) {
    return { ok: false, error: INDIAN_PHONE_ERROR_INVALID };
  }
  if (!isValidIndianMobile10(d)) {
    return { ok: false, error: INDIAN_PHONE_ERROR_INVALID };
  }
  if (isObviousFakeRepeatedDigits(d)) {
    return { ok: false, error: INDIAN_PHONE_ERROR_FAKE };
  }
  return { ok: true, digits: d };
}

/** Empty → undefined; non-empty must be a valid 10-digit Indian mobile. */
export function normalizeIndianPhoneOptional(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  if (!String(raw).trim()) return undefined;
  return requireIndianPhoneDigits(raw);
}

/** Returns normalized 10 digits or throws (for assert-style use). */
export function requireIndianPhoneDigits(raw: string): string {
  const v = validateIndianPhone(raw);
  if (!isIndianPhoneValid(v)) throw new Error(v.error);
  return v.digits;
}

export function isCompleteValidIndianMobile(raw: string): boolean {
  return validateIndianPhone(raw).ok;
}
