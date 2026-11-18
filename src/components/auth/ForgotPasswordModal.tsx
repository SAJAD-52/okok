// ============================================================================
// JADIJCB: 100% Free Self-Service & WhatsApp-Assisted Password Reset Modal
// Supports:
//  1) Automated WhatsApp OTP (when gateway configured)
//  2) Free Personal 8-Digit Recovery Code (saved in user's WhatsApp)
//  3) Free 6-Digit OTP issued by Support on WhatsApp (0 DH forever)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { normalizeMoroccanPhone, calculatePasswordStrength } from '../../lib/authHelpers';
import { platformSettingsStore } from '../../lib/platformSettings';
import {
  sendWhatsAppOtp,
  resetPasswordWithWhatsAppOtp,
  resetPasswordWithRecoveryCode,
  mapOtpErrorMessage,
} from '../../lib/whatsappOtpService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPhone?: string;
  onPasswordResetSuccess?: (normalizedPhone: string, newPassword: string) => void;
}

type ResetStep = 'phone' | 'otp' | 'free_recovery' | 'done';

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialPhone = '',
  onPasswordResetSuccess,
}) => {
  const { lang } = useLanguage();
  const isFr = lang === 'fr';

  const [step, setStep] = useState<ResetStep>('phone');
  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStep('phone');
      setPhoneInput(initialPhone || '');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setIsLoading(false);
      setResendCooldown(0);
    }
  }, [isOpen, initialPhone]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const phoneValidation = normalizeMoroccanPhone(phoneInput);
  const passwordStrength = calculatePasswordStrength(newPassword);

  const supportWaDigits = (
    platformSettingsStore.getSettings().whatsapp_number || ''
  ).replace(/\D/g, '');
  const supportForgotText = isFr
    ? `Bonjour, je souhaite obtenir un code gratuit (6 chiffres) pour réinitialiser mon mot de passe JADIJCB pour le numéro : ${
        phoneValidation.displayFormatted || phoneInput || '...'
      }`
    : `السلام عليكم، نسيت كلمة المرور لحسابي في منصة JADIJCB وأطلب كود إعادة التعيين (6 أرقام) للرقم: ${
        phoneValidation.displayFormatted || phoneInput || '...'
      }`;

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneValidation.isValid) {
      toast.error(
        isFr
          ? 'Veuillez saisir un numéro marocain valide (06 / 07)'
          : 'يرجى إدخال رقم هاتف مغربي صحيح (06 أو 07)'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await sendWhatsAppOtp({
        phone: phoneValidation.e164,
        purpose: 'reset_password',
        lang,
      });

      if (!res.success) {
        toast.error(mapOtpErrorMessage(res.error, lang, res.retryAfterSeconds));
        return;
      }

      if (res.delivery === 'gateway_not_configured') {
        setOtpCode('');
        setStep('free_recovery');
        return;
      }

      setOtpCode('');
      setStep('otp');
      setResendCooldown(60);
      toast.success(
        isFr
          ? `Code envoyé sur votre WhatsApp (${phoneValidation.displayFormatted})`
          : `تم إرسال كود التفعيل إلى تطبيق واتساب الخاص بك (${phoneValidation.displayFormatted})`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = otpCode.replace(/\D/g, '');

    if (step === 'otp' && cleanDigits.length !== 6) {
      toast.error(
        isFr
          ? 'Veuillez saisir le code à 6 chiffres reçu sur WhatsApp'
          : 'يرجى إدخال كود التفعيل المكون من 6 أرقام'
      );
      return;
    }

    if (step === 'free_recovery' && cleanDigits.length !== 6 && cleanDigits.length !== 8) {
      toast.error(
        isFr
          ? 'Saisissez votre code de récupération (8 chiffres) ou le code WhatsApp du support (6 chiffres)'
          : 'أدخل كود الاسترجاع الشخصي (8 أرقام) أو الكود المرسل من واتساب الدعم (6 أرقام)'
      );
      return;
    }

    if (newPassword.length < 8) {
      toast.error(
        isFr
          ? 'Le nouveau mot de passe doit contenir au moins 8 caractères'
          : 'كلمة السر الجديدة يجب أن لا تقل عن 8 أحرف'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(
        isFr
          ? 'Les deux mots de passe ne correspondent pas'
          : 'كلمتا السر غير متطابقتين'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res =
        cleanDigits.length === 8
          ? await resetPasswordWithRecoveryCode({
              phone: phoneValidation.e164,
              recoveryCode: cleanDigits,
              newPassword,
            })
          : await resetPasswordWithWhatsAppOtp({
              phone: phoneValidation.e164,
              code: cleanDigits,
              newPassword,
            });

      if (!res.success) {
        toast.error(mapOtpErrorMessage(res.error, lang));
        return;
      }

      setStep('done');
      toast.success(
        isFr
          ? 'Mot de passe réinitialisé avec succès !'
          : 'تم تعيين كلمة السر الجديدة بنجاح! يمكنك الدخول الآن.'
      );
      onPasswordResetSuccess?.(phoneValidation.e164, newPassword);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white border border-steel-200 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-start my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-steel-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-ink">
                {isFr ? 'Réinitialiser le mot de passe' : 'استعادة / تغيير كلمة السر'}
              </h2>
              <p className="text-[11px] text-steel-500 mt-0.5">
                {isFr
                  ? 'Récupération gratuite et rapide via WhatsApp'
                  : 'استعادة مجانية وسريعة عبر واتساب أو كود الطوارئ'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-steel-100 text-steel-500 hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Phone Input */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="pt-4 space-y-4">
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-950">
              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">
                {isFr
                  ? 'Entrez votre numéro WhatsApp pour réinitialiser votre mot de passe instantanément.'
                  : 'أدخل رقم الهاتف المسجل به حسابك لاستعادة كلمة السر فوراً.'}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {isFr ? 'Numéro WhatsApp du compte *' : 'رقم الهاتف / الواتساب المرتبط بالحساب *'}
              </label>
              <div className="relative">
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="06 61 23 45 67"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                  required
                  autoFocus
                />
                {phoneInput.length > 2 && (
                  <div className="absolute inset-y-0 end-3 flex items-center pointer-events-none">
                    {phoneValidation.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {phoneValidation.isValid && (
                <span className="text-[11px] font-mono font-bold text-emerald-700 block mt-1" dir="ltr">
                  {phoneValidation.displayFormatted}
                </span>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              className="w-full justify-center font-black min-h-[46px]"
            >
              {isFr ? 'Continuer' : 'متابعة استعادة الحساب'}
            </Button>
          </form>
        )}

        {/* Step 2a (Automated Gateway) or 2b (Free Self-Service Recovery Code + Support WhatsApp OTP) */}
        {(step === 'otp' || step === 'free_recovery') && (
          <form onSubmit={handleConfirmReset} className="pt-4 space-y-4">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
              <div>
                <span className="font-bold block">
                  {step === 'otp'
                    ? isFr
                      ? 'Code envoyé sur WhatsApp :'
                      : 'تم إرسال الكود إلى واتساب:'
                    : isFr
                    ? 'Compte vérifié :'
                    : 'الحساب المستهدف:'}
                </span>
                <span className="font-mono font-black text-emerald-700" dir="ltr">
                  {phoneValidation.displayFormatted}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="text-[11px] font-bold text-steel-600 hover:text-ink underline cursor-pointer"
              >
                {isFr ? 'Modifier' : 'تغيير الرقم'}
              </button>
            </div>

            {step === 'free_recovery' && (
              <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-[11px] text-amber-950 leading-relaxed font-medium">
                {isFr
                  ? 'Entrez votre code de récupération personnel (8 chiffres sauvegardé sur votre WhatsApp) OU le code à 6 chiffres fourni gratuitement par le support WhatsApp.'
                  : 'أدخل كود الاسترجاع الشخصي المحفوظ في واتسابك (8 أرقام)، أو أدخل الكود (6 أرقام) الذي يرسله لك الدعم عبر واتساب مجاناً.'}
              </div>
            )}

            {/* Code Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-steel-700">
                  {step === 'otp'
                    ? isFr
                      ? 'Code à 6 chiffres *'
                      : 'كود التفعيل (6 أرقام) *'
                    : isFr
                    ? 'Code (8 chiffres ou 6 chiffres) *'
                    : 'كود الاسترجاع أو التفعيل *'}
                </label>
                {step === 'otp' && (
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isLoading}
                    onClick={() => handleSendOtp()}
                    className={`text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                      resendCooldown > 0
                        ? 'text-steel-400 cursor-not-allowed'
                        : 'text-primary-dark hover:underline'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>
                      {resendCooldown > 0
                        ? isFr
                          ? `Renvoyer (${resendCooldown}s)`
                          : `إعادة الإرسال (${resendCooldown}ث)`
                        : isFr
                        ? 'Renvoyer le code'
                        : 'إعادة إرسال الكود'}
                    </span>
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={step === 'otp' ? 6 : 9}
                dir="ltr"
                placeholder={step === 'otp' ? '• • • • • •' : '1234-5678 / 123456'}
                value={otpCode}
                onChange={(e) => {
                  const maxLen = step === 'otp' ? 6 : 9;
                  setOtpCode(e.target.value.replace(/[^\d-]/g, '').slice(0, maxLen));
                }}
                className="w-full px-4 py-3 rounded-xl border border-steel-300 text-center text-lg font-mono font-black tracking-[0.25em] focus:outline-none focus:ring-2 focus:ring-primary bg-surface min-h-[50px]"
                required
                autoFocus
              />
            </div>

            {/* New Password */}
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {isFr ? 'Nouveau mot de passe (min. 8 caractères) *' : 'كلمة السر الجديدة (8 أحرف على الأقل) *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white pe-10 min-h-[46px]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 end-3 flex items-center text-steel-400 hover:text-ink cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div className="flex gap-1 h-1 mt-1.5">
                  {[1, 2, 3, 4].map((s) => (
                    <div
                      key={s}
                      className={`flex-1 rounded-full ${
                        passwordStrength.score >= s
                          ? passwordStrength.level === 'strong'
                            ? 'bg-emerald-500'
                            : passwordStrength.level === 'medium'
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                          : 'bg-steel-200'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {isFr ? 'Confirmer le nouveau mot de passe *' : 'تأكيد كلمة السر الجديدة *'}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-h-[46px]"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              className="w-full justify-center font-black min-h-[48px]"
            >
              {isFr ? 'Confirmer et changer le mot de passe' : 'تأكيد وتغيير كلمة السر'}
            </Button>

            {step === 'free_recovery' && (
              <div className="pt-3 border-t border-steel-100 space-y-2">
                <p className="text-[11px] font-bold text-steel-500 text-center">
                  {isFr ? 'Vous n’avez pas votre code ?' : 'نسيت كود الاسترجاع أيضاً؟ احصل على كود مجاني:'}
                </p>
                {supportWaDigits.length >= 9 ? (
                  <a
                    href={`https://wa.me/${supportWaDigits}?text=${encodeURIComponent(supportForgotText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition-colors min-h-[42px]"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>
                      {isFr
                        ? 'Demander un code gratuit sur WhatsApp'
                        : 'طلب كود (6 أرقام) مجاناً عبر واتساب الدعم'}
                    </span>
                  </a>
                ) : (
                  <a
                    href={`mailto:said.cpge24@gmail.com?subject=${encodeURIComponent(
                      'JADIJCB Password Reset'
                    )}&body=${encodeURIComponent(supportForgotText)}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-steel-800 hover:bg-ink text-white text-xs font-black transition-colors min-h-[42px]"
                  >
                    <span>{isFr ? 'Contacter le support' : 'مراسلة الدعم لإعادة التعيين'}</span>
                  </a>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full py-1 text-xs font-bold text-steel-500 hover:text-ink inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              {isFr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              <span>{isFr ? 'Retour' : 'رجوع'}</span>
            </button>
          </form>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div className="pt-5 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink">
                {isFr ? 'Mot de passe mis à jour !' : 'تم تحديث كلمة السر بنجاح!'}
              </h3>
              <p className="text-xs text-steel-500 mt-1">
                {isFr
                  ? 'Vos identifiants ont été pré-remplis. Vous pouvez vous connecter immédiatement.'
                  : 'تم تعبئة رقمك وكلمة السر الجديدة تلقائياً، يمكنك تسجيل الدخول الآن.'}
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={onClose}
              className="w-full justify-center font-black min-h-[46px]"
            >
              {isFr ? 'Retour à la connexion' : 'تسجيل الدخول الآن'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
