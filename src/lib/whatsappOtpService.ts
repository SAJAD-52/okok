// ============================================================================
// JADIJCB: WhatsApp OTP Activation & Password Reset Service
// Works seamlessly in Full-Stack Express Preview (/api/auth/whatsapp-otp/*),
// Supabase Edge Function (whatsapp-otp), and Static SPA + Postgres RPC mode.
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { normalizeMoroccanPhone } from './authHelpers';

export type OtpPurpose = 'register' | 'reset_password';

export interface SendOtpResult {
  success: boolean;
  delivery?: 'whatsapp' | 'gateway_not_configured';
  provider?: string;
  expiresInSeconds?: number;
  retryAfterSeconds?: number;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  verified?: boolean;
  remainingAttempts?: number;
  error?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

async function tryExpressJson<T = any>(
  url: string,
  init: RequestInit
): Promise<{ available: boolean; ok: boolean; status: number; data?: T }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return { available: false, ok: false, status: res.status };
    }
    const data = (await res.json()) as T;
    return { available: true, ok: res.ok, status: res.status, data };
  } catch {
    return { available: false, ok: false, status: 0 };
  }
}

async function tryEdgeFunction<T = any>(
  body: Record<string, any>
): Promise<{ available: boolean; ok: boolean; data?: T }> {
  if (!isSupabaseConfigured) {
    return { available: false, ok: false };
  }
  try {
    const { data, error } = await supabase.functions.invoke('whatsapp-otp', {
      body,
    });
    if (!error && data) {
      return {
        available: true,
        ok: Boolean((data as any).success !== false),
        data: data as T,
      };
    }
    // Extract structured JSON error if Edge Function returned 4xx/5xx
    const ctx: any = (error as any)?.context;
    if (ctx && typeof ctx.json === 'function') {
      const errJson = await ctx.json().catch(() => null);
      if (errJson && typeof errJson === 'object' && ('error' in errJson || 'success' in errJson)) {
        return {
          available: true,
          ok: false,
          data: errJson as T,
        };
      }
    }
    return { available: false, ok: false };
  } catch {
    return { available: false, ok: false };
  }
}

export async function checkPhoneRegistered(rawPhone: string): Promise<boolean | null> {
  const norm = normalizeMoroccanPhone(rawPhone);
  if (!norm.isValid || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase.rpc('check_phone_registered', {
      p_phone: norm.e164,
    });
    if (error) return null;
    return Boolean(data);
  } catch {
    return null;
  }
}

export async function sendWhatsAppOtp(params: {
  phone: string;
  purpose: OtpPurpose;
  lang: 'ar' | 'fr';
}): Promise<SendOtpResult> {
  const norm = normalizeMoroccanPhone(params.phone);
  if (!norm.isValid) {
    return { success: false, error: 'INVALID_PHONE' };
  }

  // 1. Try Express backend route first (AI Studio / Full-stack Node server)
  const exp = await tryExpressJson<any>('/api/auth/whatsapp-otp/send', {
    method: 'POST',
    body: JSON.stringify({
      phone: norm.e164,
      purpose: params.purpose,
      lang: params.lang,
    }),
  });

  if (exp.available && exp.data) {
    return {
      success: Boolean(exp.data.success),
      delivery: exp.data.delivery,
      provider: exp.data.provider,
      expiresInSeconds: exp.data.expiresInSeconds,
      retryAfterSeconds: exp.data.retryAfterSeconds,
      error: exp.data.error,
    };
  }

  // 2. Try Supabase Edge Function (Vercel / Production SPA)
  const edge = await tryEdgeFunction<any>({
    action: 'send',
    phone: norm.e164,
    purpose: params.purpose,
    lang: params.lang,
  });

  if (edge.available && edge.data) {
    return {
      success: Boolean(edge.data.success),
      delivery: edge.data.delivery,
      provider: edge.data.provider,
      expiresInSeconds: edge.data.expiresInSeconds,
      retryAfterSeconds: edge.data.retryAfterSeconds,
      error: edge.data.error,
    };
  }

  // 3. Fallback when Edge Function is not yet deployed: still enforce phone checks via RPC
  const registered = await checkPhoneRegistered(norm.e164);
  if (params.purpose === 'register' && registered === true) {
    return { success: false, error: 'PHONE_ALREADY_REGISTERED' };
  }
  if (params.purpose === 'reset_password' && registered === false) {
    return { success: false, error: 'ACCOUNT_NOT_FOUND' };
  }

  return {
    success: true,
    delivery: 'gateway_not_configured',
    provider: 'none',
  };
}

export async function verifyWhatsAppOtp(params: {
  phone: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<VerifyOtpResult> {
  const norm = normalizeMoroccanPhone(params.phone);
  const cleanCode = String(params.code || '').replace(/\D/g, '');
  if (!norm.isValid) {
    return { success: false, error: 'INVALID_PHONE' };
  }
  if (cleanCode.length !== 6) {
    return { success: false, error: 'INVALID_OTP' };
  }

  const exp = await tryExpressJson<any>('/api/auth/whatsapp-otp/verify', {
    method: 'POST',
    body: JSON.stringify({
      phone: norm.e164,
      purpose: params.purpose,
      code: cleanCode,
    }),
  });
  if (exp.available && exp.data) {
    return {
      success: Boolean(exp.data.success),
      verified: Boolean(exp.data.verified),
      remainingAttempts: exp.data.remainingAttempts,
      error: exp.data.error,
    };
  }

  const edge = await tryEdgeFunction<any>({
    action: 'verify',
    phone: norm.e164,
    purpose: params.purpose,
    code: cleanCode,
  });
  if (edge.available && edge.data) {
    return {
      success: Boolean(edge.data.success),
      verified: Boolean(edge.data.verified),
      remainingAttempts: edge.data.remainingAttempts,
      error: edge.data.error,
    };
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('verify_whatsapp_otp_code', {
        p_phone: norm.e164,
        p_purpose: params.purpose,
        p_code: cleanCode,
      });
      if (!error && data) {
        return {
          success: Boolean((data as any).success),
          verified: Boolean((data as any).verified),
          remainingAttempts: (data as any).remaining_attempts,
          error: (data as any).error,
        };
      }
    } catch {
      // fall through
    }
  }

  return { success: false, error: 'OTP_NOT_FOUND' };
}

export async function resetPasswordWithWhatsAppOtp(params: {
  phone: string;
  code: string;
  newPassword: string;
}): Promise<ResetPasswordResult> {
  const norm = normalizeMoroccanPhone(params.phone);
  const cleanCode = String(params.code || '').replace(/\D/g, '');

  if (!norm.isValid) {
    return { success: false, error: 'INVALID_PHONE' };
  }
  if (cleanCode.length !== 6) {
    return { success: false, error: 'INVALID_OTP' };
  }
  if (!params.newPassword || params.newPassword.length < 8) {
    return { success: false, error: 'WEAK_PASSWORD' };
  }

  const exp = await tryExpressJson<any>('/api/auth/whatsapp-otp/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      phone: norm.e164,
      code: cleanCode,
      newPassword: params.newPassword,
    }),
  });
  if (exp.available && exp.data) {
    return {
      success: Boolean(exp.data.success),
      error: exp.data.error,
    };
  }

  const edge = await tryEdgeFunction<any>({
    action: 'reset_password',
    phone: norm.e164,
    code: cleanCode,
    newPassword: params.newPassword,
  });
  if (edge.available && edge.data) {
    return {
      success: Boolean(edge.data.success),
      error: edge.data.error,
    };
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('reset_password_with_whatsapp_otp', {
        p_phone: norm.e164,
        p_code: cleanCode,
        p_new_password: params.newPassword,
      });
      if (!error && data) {
        return {
          success: Boolean((data as any).success),
          error: (data as any).error,
        };
      }
      if (error) {
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'RESET_FAILED' };
    }
  }

  return { success: false, error: 'RESET_FAILED' };
}

export async function markUserWhatsAppVerified(userId: string, rawPhone: string): Promise<boolean> {
  if (!isSupabaseConfigured || !userId) return false;
  const norm = normalizeMoroccanPhone(rawPhone);
  if (!norm.isValid) return false;

  try {
    const { data, error } = await supabase.rpc('mark_phone_whatsapp_verified', {
      p_user_id: userId,
      p_phone: norm.e164,
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function adminResetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'SUPABASE_NOT_CONFIGURED' };
  }
  if (!userId || !newPassword || newPassword.length < 8) {
    return { success: false, error: 'WEAK_PASSWORD' };
  }

  try {
    const { data, error } = await supabase.rpc('admin_reset_user_password', {
      p_user_id: userId,
      p_new_password: newPassword,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    if (data && typeof data === 'object') {
      return {
        success: Boolean((data as any).success),
        error: (data as any).error,
      };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'RESET_FAILED' };
  }
}

export async function generateMyRecoveryCode(
  rawPhone?: string
): Promise<{ success: boolean; code?: string; phone?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'SUPABASE_NOT_CONFIGURED' };
  }
  const norm = rawPhone ? normalizeMoroccanPhone(rawPhone) : null;
  try {
    const { data, error } = await supabase.rpc('generate_my_recovery_code', {
      p_phone: norm?.isValid ? norm.e164 : null,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    if (data && typeof data === 'object') {
      return {
        success: Boolean((data as any).success),
        code: (data as any).code,
        phone: (data as any).phone,
        error: (data as any).error,
      };
    }
    return { success: false, error: 'GENERATION_FAILED' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'GENERATION_FAILED' };
  }
}

export async function resetPasswordWithRecoveryCode(params: {
  phone: string;
  recoveryCode: string;
  newPassword: string;
}): Promise<ResetPasswordResult> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'SUPABASE_NOT_CONFIGURED' };
  }
  const norm = normalizeMoroccanPhone(params.phone);
  const cleanCode = String(params.recoveryCode || '').replace(/\D/g, '');
  if (!norm.isValid) {
    return { success: false, error: 'INVALID_PHONE' };
  }
  if (cleanCode.length !== 8) {
    return { success: false, error: 'INVALID_RECOVERY_CODE' };
  }
  if (!params.newPassword || params.newPassword.length < 8) {
    return { success: false, error: 'WEAK_PASSWORD' };
  }

  try {
    const { data, error } = await supabase.rpc('reset_password_with_recovery_code', {
      p_phone: norm.e164,
      p_recovery_code: cleanCode,
      p_new_password: params.newPassword,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    if (data && typeof data === 'object') {
      return {
        success: Boolean((data as any).success),
        error: (data as any).error,
      };
    }
    return { success: false, error: 'RESET_FAILED' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'RESET_FAILED' };
  }
}

export async function adminIssueWhatsAppOtp(
  userId: string
): Promise<{ success: boolean; code?: string; phone?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'SUPABASE_NOT_CONFIGURED' };
  }
  try {
    const { data, error } = await supabase.rpc('admin_issue_whatsapp_otp', {
      p_user_id: userId,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    if (data && typeof data === 'object') {
      return {
        success: Boolean((data as any).success),
        code: (data as any).code,
        phone: (data as any).phone,
        error: (data as any).error,
      };
    }
    return { success: false, error: 'OTP_ISSUE_FAILED' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'OTP_ISSUE_FAILED' };
  }
}

export function mapOtpErrorMessage(
  errorCode: string | undefined,
  lang: 'ar' | 'fr',
  retryAfterSeconds?: number
): string {
  const code = String(errorCode || '').toUpperCase();
  if (lang === 'fr') {
    switch (code) {
      case 'INVALID_PHONE':
        return 'Numéro de téléphone marocain invalide (06 / 07)';
      case 'PHONE_ALREADY_REGISTERED':
        return 'Ce numéro est déjà inscrit. Connectez-vous ou réinitialisez le mot de passe.';
      case 'ACCOUNT_NOT_FOUND':
        return 'Aucun compte trouvé avec ce numéro WhatsApp.';
      case 'COOLDOWN_ACTIVE':
        return `Veuillez patienter ${retryAfterSeconds || 30}s avant de renvoyer le code.`;
      case 'RATE_LIMIT_EXCEEDED':
        return 'Trop de tentatives. Réessayez plus tard.';
      case 'INVALID_OTP':
        return 'Code d’activation incorrect (6 chiffres).';
      case 'INVALID_RECOVERY_CODE':
        return 'Code de récupération incorrect (8 chiffres).';
      case 'RECOVERY_NOT_FOUND':
        return 'Aucun code de récupération enregistré pour ce compte. Demandez un code au support via WhatsApp.';
      case 'OTP_EXPIRED':
        return 'Le code a expiré. Demandez un nouveau code.';
      case 'OTP_NOT_FOUND':
        return 'Aucun code actif trouvé. Demandez un nouveau code.';
      case 'TOO_MANY_ATTEMPTS':
        return 'Nombre maximal de tentatives dépassé. Réessayez plus tard.';
      case 'WEAK_PASSWORD':
        return 'Le mot de passe doit contenir au moins 8 caractères.';
      case 'WHATSAPP_SEND_FAILED':
        return 'Échec de l’envoi sur WhatsApp. Vérifiez le numéro et réessayez.';
      case 'PASSWORD_UPDATE_REQUIRES_SERVICE_ROLE':
        return 'Mise à jour indisponible côté serveur. Veuillez appliquer la migration SQL.';
      default:
        return errorCode || 'Une erreur est survenue, veuillez réessayer.';
    }
  }

  switch (code) {
    case 'INVALID_PHONE':
      return 'رقم الهاتف المغربي غير صالح (يجب أن يبدأ بـ 06 أو 07)';
    case 'PHONE_ALREADY_REGISTERED':
      return 'هذا الرقم مسجل مسبقاً! يمكنك تسجيل الدخول أو استعادة كلمة السر.';
    case 'ACCOUNT_NOT_FOUND':
      return 'لا يوجد حساب مسجل بهذا الرقم على المنصة.';
    case 'COOLDOWN_ACTIVE':
      return `يرجى الانتظار ${retryAfterSeconds || 30} ثانية قبل إعادة إرسال الكود.`;
    case 'RATE_LIMIT_EXCEEDED':
      return 'تم تجاوز الحد المسموح من المحاولات. يرجى الانتظار قليلاً.';
    case 'INVALID_OTP':
      return 'كود التفعيل غير صحيح (تأكد من الأرقام الستة).';
    case 'INVALID_RECOVERY_CODE':
      return 'كود الاسترجاع غير صحيح (يجب أن يتكون من 8 أرقام).';
    case 'RECOVERY_NOT_FOUND':
      return 'لم يتم حفظ كود استرجاع لهذا الحساب مسبقاً. اطلب كوداً مجانياً عبر واتساب الدعم أدناه.';
    case 'OTP_EXPIRED':
      return 'انتهت صلاحية كود التفعيل. اطلب كوداً جديداً.';
    case 'OTP_NOT_FOUND':
      return 'لم يتم العثور على كود نشط. اطلب كوداً جديداً عبر واتساب الدعم أدناه.';
    case 'TOO_MANY_ATTEMPTS':
      return 'تم استنفاد عدد المحاولات المسموحة. يرجى الانتظار والمحاولة مجدداً.';
    case 'WEAK_PASSWORD':
      return 'كلمة السر يجب أن لا تقل عن 8 أحرف.';
    case 'WHATSAPP_SEND_FAILED':
      return 'تعذر إرسال الرسالة إلى واتساب حالياً، تأكد من الرقم وحاول مجدداً.';
    case 'PASSWORD_UPDATE_REQUIRES_SERVICE_ROLE':
      return 'يرجى تفعيل كود SQL الخاص بإعادة تعيين كلمة السر في قاعدة البيانات.';
    default:
      return errorCode || 'حدث خطأ غير متوقع، يرجى المحاولة مجدداً.';
  }
}
