/**
 * Indian mobile: 10 digits, first digit 6–9.
 * Sanitizes +91 / 0091 / spaces before validating.
 *
 * Future: SMS OTP (e.g. purpose `phone_verify` on OtpChallenge) can call the same
 * normalizer; set PHONE_OTP_ENABLED when an SMS provider is wired.
 */

export const INDIAN_PHONE_ERROR_INVALID =
  'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
export const INDIAN_PHONE_ERROR_FAKE =
  'That mobile number is not accepted. Please enter a valid phone number.';

/** Strip non-digits, remove leading country code 91 / 0, then keep at most last 10 digits if still long. */
export function sanitizeIndianPhoneDigits(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  while (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  while (d.length > 10 && d.startsWith('0')) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d;
}

export function isValidIndianMobile10(digits) {
  return /^[6-9]\d{9}$/.test(digits);
}

/** Blocks 0000000000, 9999999999, etc. */
export function isObviousFakeRepeatedDigits(digits) {
  return /^(\d)\1{9}$/.test(digits);
}

export function normalizeIndianMobileOrThrow(raw) {
  const d = sanitizeIndianPhoneDigits(raw);
  if (d.length !== 10) {
    const err = new Error(INDIAN_PHONE_ERROR_INVALID);
    err.statusCode = 400;
    throw err;
  }
  if (!isValidIndianMobile10(d)) {
    const err = new Error(INDIAN_PHONE_ERROR_INVALID);
    err.statusCode = 400;
    throw err;
  }
  if (isObviousFakeRepeatedDigits(d)) {
    const err = new Error(INDIAN_PHONE_ERROR_FAKE);
    err.statusCode = 400;
    throw err;
  }
  return d;
}

/** Empty / whitespace → undefined; partial input still throws (use only when a value was provided). */
export function normalizeIndianMobileOptional(raw) {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  return normalizeIndianMobileOrThrow(s);
}

export function tryNormalizeIndianMobile(raw) {
  try {
    return { ok: true, value: normalizeIndianMobileOrThrow(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
