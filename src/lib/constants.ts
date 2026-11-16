// ============================================================================
// JADIJCB: Platform Business Constants & Moroccan Payment Credentials
// ============================================================================

/**
 * Monthly subscription price in Moroccan Dirhams (MAD)
 */
export const MONTHLY_PLAN_PRICE_MAD = 200;

/**
 * Free trial duration in hours (Moroccan owners get 72h full platform access)
 */
export const TRIAL_DURATION_HOURS = 72;

/**
 * Hours before trial expiry when the banner turns urgent (red/warning)
 */
export const URGENT_HOURS_THRESHOLD = 6;

/**
 * Official Moroccan Bank Transfer RIB (configured dynamically via /admin platform_settings)
 */
export const BANK_RIB_NUMBER = '';
export const BANK_NAME = 'Attijariwafa Bank (التجاري وفا بنك)';
export const BANK_ACCOUNT_HOLDER = 'JADIJCB MAROC';
export const BANK_SWIFT_BIC = '';

/**
 * Moroccan Cash Transfer (Wafacash / Cash Plus) Beneficiary Credentials
 */
export const WAFACASH_BENEFICIARY_NAME = 'JADIJCB MAROC';
export const WAFACASH_REPRESENTATIVE = '';
export const WAFACASH_CIN = '';
export const WAFACASH_CITY = 'Casablanca';

/**
 * Direct Moroccan WhatsApp Helpline (configured dynamically via /admin platform_settings)
 */
export const WHATSAPP_ADMIN_PHONE = '';
export const WHATSAPP_ADMIN_LINK = '';

/**
 * Synthetic email domain used to bridge phone authentication with Supabase auth.users
 */
export const SYNTHETIC_EMAIL_DOMAIN = 'users.jadijcb.app';

/**
 * Owner phone numbers granted a permanent lifetime-free subscription
 */
export const LIFETIME_FREE_OWNER_PHONES = ['0612457896'];

export function isLifetimeFreePhone(rawPhone?: string | null): boolean {
  if (!rawPhone) return false;
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return false;

  let local = digits;
  if (local.startsWith('00212')) {
    local = '0' + local.slice(5);
  } else if (local.startsWith('212')) {
    local = '0' + local.slice(3);
  } else if (!local.startsWith('0') && local.length === 9) {
    local = '0' + local;
  }

  return LIFETIME_FREE_OWNER_PHONES.includes(local);
}

