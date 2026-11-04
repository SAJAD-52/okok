// ============================================================================
// JADIJCB: Moroccan Phone Authentication & Validation Helpers
// ============================================================================
// Technical Architecture Note:
// Standard Supabase phone authentication requires integrating and paying for a
// third-party SMS gateway (e.g. Twilio, MessageBird, Vonage). In the Moroccan B2B
// construction sector, contractors and equipment owners identify exclusively by
// their Moroccan mobile numbers (06 / 07 / +212) without using corporate emails.
//
// To achieve seamless phone + password authentication with zero SMS friction and
// full Supabase auth compatibility, we normalize every Moroccan phone to E.164 format
// (+2126XXXXXXXX or +2127XXXXXXXX) and map it internally to a deterministic synthetic
// email: `<digits>@users.jadijcb.app`.
// The user NEVER sees an email field. The raw phone number is permanently preserved
// in `raw_user_meta_data.phone` and synced to the `public.profiles.phone` table column
// by the database trigger `handle_new_user()`.
// ============================================================================

import { SYNTHETIC_EMAIL_DOMAIN } from './constants';

export interface PhoneValidationResult {
  isValid: boolean;
  e164: string;
  displayFormatted: string;
  errorMessageKey?: string;
}

export interface PasswordStrength {
  score: number; // 0 to 4
  level: 'weak' | 'medium' | 'strong';
  hasMinLength: boolean;
  hasNumber: boolean;
  hasLetter: boolean;
  hasSpecial: boolean;
}

/**
 * Normalizes any Moroccan phone input into standard E.164 format (+2126XXXXXXXX / +2127XXXXXXXX)
 * Handles formats such as:
 * - 0661234567
 * - 0712345678
 * - 06 61 23 45 67
 * - 06-61-23-45-67
 * - +212 661234567
 * - +212661234567
 * - 00212661234567
 * - 212661234567
 */
export function normalizeMoroccanPhone(rawInput: string): PhoneValidationResult {
  if (!rawInput) {
    return {
      isValid: false,
      e164: '',
      displayFormatted: '',
      errorMessageKey: 'auth.phone_required',
    };
  }

  // Remove all non-digit characters except leading plus
  let cleaned = rawInput.trim().replace(/[\s\-\.\(\)\/]/g, '');

  // Handle leading 00212
  if (cleaned.startsWith('00212')) {
    cleaned = '+212' + cleaned.slice(5);
  } else if (cleaned.startsWith('212') && !cleaned.startsWith('+212')) {
    cleaned = '+212' + cleaned.slice(3);
  }

  // Handle Moroccan domestic format starting with 06 or 07
  if (cleaned.startsWith('06') || cleaned.startsWith('07')) {
    if (cleaned.length === 10) {
      cleaned = '+212' + cleaned.slice(1);
    }
  }

  // Handle direct 6 or 7 without leading zero (9 digits total)
  if ((cleaned.startsWith('6') || cleaned.startsWith('7')) && cleaned.length === 9) {
    cleaned = '+212' + cleaned;
  }

  // Strict Moroccan Mobile Regex (+212 followed by 6 or 7 and exactly 8 digits)
  const moroccanMobileRegex = /^\+212[67]\d{8}$/;
  const isValid = moroccanMobileRegex.test(cleaned);

  if (!isValid) {
    return {
      isValid: false,
      e164: cleaned,
      displayFormatted: cleaned,
      errorMessageKey: 'auth.phone_invalid',
    };
  }

  // Format nicely for Moroccan visual display: +212 6 61 23 45 67
  const digits = cleaned.replace('+212', '');
  const prefix = digits[0]; // 6 or 7
  const d1 = digits.slice(1, 3);
  const d2 = digits.slice(3, 5);
  const d3 = digits.slice(5, 7);
  const d4 = digits.slice(7, 9);
  const displayFormatted = `+212 ${prefix} ${d1} ${d2} ${d3} ${d4}`;

  return {
    isValid: true,
    e164: cleaned,
    displayFormatted,
  };
}

/**
 * Converts a normalized E.164 Moroccan phone (+2126XXXXXXXX) to synthetic email
 * Example: +212661234567 -> 212661234567@users.jadijcb.app
 */
export function phoneToSyntheticEmail(e164Phone: string): string {
  const digitsOnly = e164Phone.replace(/\D/g, '');
  return `${digitsOnly}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/**
 * Reverses a synthetic email to E.164 phone string
 */
export function syntheticEmailToPhone(email: string): string {
  if (!email.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)) {
    return email;
  }
  const digits = email.split('@')[0];
  return `+${digits}`;
}

/**
 * Evaluates password strength with practical criteria
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  let score = 0;
  if (hasMinLength) score += 1;
  if (password.length >= 10) score += 1;
  if (hasNumber && hasLetter) score += 1;
  if (hasSpecial) score += 1;

  let level: 'weak' | 'medium' | 'strong' = 'weak';
  if (score >= 3) {
    level = 'strong';
  } else if (score >= 2) {
    level = 'medium';
  }

  return {
    score,
    level,
    hasMinLength,
    hasNumber,
    hasLetter,
    hasSpecial,
  };
}
