/**
 * phone.js — E.164 phone number normalizer.
 *
 * Strips formatting characters and ensures the number starts with `+` and a
 * country code, defaulting to Costa Rica (+506).
 *
 * @param {string} phone - Raw phone string (any format)
 * @param {string} [defaultCountryCode='506'] - Country code digits (no +/00 prefix)
 * @returns {string} E.164 formatted phone number (e.g. '+50688881234')
 *
 * @example
 * toE164('8888-1234')          // '+50688881234'
 * toE164('+50688881234')       // '+50688881234'
 * toE164('0050688881234')      // '+50688881234'
 * toE164('50688881234')        // '+50688881234'
 */
export function toE164(phone, defaultCountryCode = '506') {
  // Strip spaces, dashes, dots, parentheses
  let cleaned = String(phone).replace(/[\s\-.() ]/g, '');

  // Already E.164
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // International prefix 00 → +
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.slice(2);
  }

  // Already has the country code digits (e.g. '506...')
  if (cleaned.startsWith(defaultCountryCode)) {
    return '+' + cleaned;
  }

  // Local number — prepend country code
  return '+' + defaultCountryCode + cleaned;
}
