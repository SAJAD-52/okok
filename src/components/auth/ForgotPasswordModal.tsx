// ============================================================================
// JADIJCB: Self-Service Password Reset via WhatsApp OTP Modal
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
  mapOtpErrorMessage,
} from '../../lib/whatsappOtpService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPhone?: string;
  onPasswordResetSuccess?: (normalizedPhone: string, newPassword: string) => void;
}

type ResetStep = 'phone' | 'otp' | 'support_fallback' | 'done';

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
    ? `Bonjour, je souhaite réinitialiser mon mot de passe JADIJCB pour le numéro : ${
        phoneValidation.displayFormatted || phoneInput || '...'
      }`
    : `السلام عليكم، أريد استعادة أو إعادة تعيين كلمة المرور لحسابي في منصة JADIJCB المرتبط بالرقم: ${
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
        setStep('support_fallback');
        return;
      }

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
    const cleanCode = otpCode.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      toast.error(
        isFr
          ? 'Veuillez saisir le code à 6 chiffres reçu sur WhatsApp'
          : 'يرجى إدخال كود التفعيل المكون من 6 أرقام'
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
      const res = await resetPasswordWithWhatsAppOtp({
        phone: phoneValidation.e164,
        code: cleanCode,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-sm">
      <div className="relative bg-white border border-steel-200 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-start animate-in fade-in zoom-in-95 duration-150">
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
                  ? 'Vérification rapide par code WhatsApp'
                  : 'تأكيد فوري عبر كود في تطبيق واتساب'}
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
                  ? 'Entrez le numéro WhatsApp lié à votre compte pour recevoir un code de vérification à 6 chiffres.'
                  : 'أدخل رقم الهاتف المسجل به حسابك، وسنرسل لك كود تفعيل من 6 أرقام على واتساب لإعادة تعيين كلمة السر.'}
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

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                leftIcon={<MessageCircle className="w-4 h-4" />}
                className="flex-1 justify-center font-black min-h-[46px]"
              >
                {isFr ? 'Envoyer le code sur WhatsApp' : 'إرسال كود التفعيل إلى واتساب'}
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Enter 6-digit OTP + New Password */}
        {step === 'otp' && (
          <form onSubmit={handleConfirmReset} className="pt-4 space-y-4">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
              <div>
                <span className="font-bold block">
                  {isFr ? 'Code envoyé sur WhatsApp :' : 'تم إرسال الكود إلى واتساب:'}
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

            {/* 6-digit OTP */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-steel-700">
                  {isFr ? 'Code à 6 chiffres *' : 'كود التفعيل (6 أرقام) *'}
                </label>
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
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                dir="ltr"
                placeholder="• • • • • •"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 rounded-xl border border-steel-300 text-center text-xl font-mono font-black tracking-[0.45em] focus:outline-none focus:ring-2 focus:ring-primary bg-surface min-h-[52px]"
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
          </form>
        )}

        {/* Step 2b: Gateway Not Configured Fallback -> 1-Click Support WhatsApp */}
        {step === 'support_fallback' && (
          <div className="pt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
              <p className="font-black">
                {isFr
                  ? 'Envoi automatique WhatsApp en attente de configuration'
                  : 'خدمة الإرسال التلقائي عبر واتساب قيد التفعيل على الخادم'}
              </p>
              <p className="leading-relaxed text-amber-900">
                {isFr
                  ? 'Vous pouvez demander la réinitialisation immédiate de votre mot de passe directement auprès du support technique sur WhatsApp en un seul clic.'
                  : 'يمكنك استعادة حسابك وتعيين كلمة سر جديدة فوراً عبر مراسلة فريق الدعم على واتساب بنقرة واحدة.'}
              </p>
            </div>

            {supportWaDigits.length >= 9 ? (
              <a
                href={`https://wa.me/${supportWaDigits}?text=${encodeURIComponent(supportForgotText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-sm transition-colors min-h-[48px]"
              >
                <MessageCircle className="w-4 h-4" />
                <span>
                  {isFr
                    ? 'Demander un code sur WhatsApp Support'
                    : 'طلب إعادة التعيين عبر واتساب الدعم'}
                </span>
              </a>
            ) : (
              <a
                href={`mailto:said.cpge24@gmail.com?subject=${encodeURIComponent(
                  'JADIJCB Password Reset'
                )}&body=${encodeURIComponent(supportForgotText)}`}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-ink hover:bg-steel-800 text-white text-sm font-black shadow-sm transition-colors min-h-[48px]"
              >
                <span>
                  {isFr ? 'Contacter le support par e-mail' : 'مراسلة الدعم لإعادة التعيين'}
                </span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full py-2.5 text-xs font-bold text-steel-600 hover:text-ink inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isFr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              <span>{isFr ? 'Essayer un autre numéro' : 'تجربة رقم آخر'}</span>
            </button>
          </div>
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
