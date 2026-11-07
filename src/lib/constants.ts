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
 * Official Moroccan Bank Transfer RIB (Attijariwafa Bank)
 * 24 digits standard format: Code Banque (3) + Ville (3) + Compte (16) + Clé (2)
 */
export const BANK_RIB_NUMBER = '007 780 0001234567890123 45';
export const BANK_NAME = 'Attijariwafa Bank (التجاري وفا بنك)';
export const BANK_ACCOUNT_HOLDER = 'JADIJCB MAROC S.A.R.L.';
export const BANK_SWIFT_BIC = 'BCMA MAMC';

/**
 * Moroccan Cash Transfer (Wafacash / Cash Plus) Beneficiary Credentials
 */
export const WAFACASH_BENEFICIARY_NAME = 'JADIJCB MAROC';
export const WAFACASH_REPRESENTATIVE = 'Karim El Fassi';
export const WAFACASH_CIN = 'AB 123456';
export const WAFACASH_CITY = 'Casablanca';

/**
 * Direct Moroccan WhatsApp Helpline for instant support & activation
 */
export const WHATSAPP_ADMIN_PHONE = '+212661234567';
export const WHATSAPP_ADMIN_LINK = 'https://wa.me/212661234567?text=';

/**
 * Synthetic email domain used to bridge phone authentication with Supabase auth.users
 */
export const SYNTHETIC_EMAIL_DOMAIN = 'users.jadijcb.app';
