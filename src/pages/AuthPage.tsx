// ============================================================================
// JADIJCB: Moroccan Phone + Password Authentication Page
// ============================================================================
// Technical Approach:
// Direct Supabase phone auth requires SMS OTP via Twilio or MessageBird with
// ongoing per-SMS costs and carrier delivery issues in Morocco.
// To provide an instant, frictionless user experience tailored to Moroccan
// equipment owners and contractors, users register with ONLY their Moroccan mobile
// number (06 / 07 / +212) and password. NO email field is ever displayed.
//
// The phone number is normalized to E.164 (+2126XXXXXXXX) and converted internally
// to `<digits>@users.jadijcb.app`. The actual phone number is stored in Supabase
// user_metadata and mirrored to `public.profiles.phone`.
// ============================================================================

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Truck,
  Building2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { WelcomeModal } from '../components/dashboard/WelcomeModal';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import {
  normalizeMoroccanPhone,
  calculatePasswordStrength,
} from '../lib/authHelpers';
import { UserRole } from '../types/database';

export const AuthPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithPhone, signupWithPhone } = useAuth();

  const isSignupParam =
    searchParams.get('mode') === 'signup' || searchParams.get('mode') === 'register';
  const [mode, setMode] = useState<'login' | 'register'>(
    isSignupParam ? 'register' : 'login'
  );

  // Form State
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('owner'); // 'owner' or 'client'
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Live Phone Validation
  const phoneValidation = normalizeMoroccanPhone(phone);
  const isPhoneTouched = phone.length > 2;

  // Live Password Strength
  const passwordStrength = calculatePasswordStrength(password);
  const isPasswordTouched = password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneValidation.isValid) {
      toast.error(t('auth.phone_invalid'));
      return;
    }

    if (password.length < 8) {
      toast.error(
        lang === 'fr'
          ? 'Le mot de passe doit comporter au moins 8 caractères'
          : 'كلمة المرور يجب أن لا تقل عن 8 أحرف'
      );
      return;
    }

    setIsLoading(true);

    if (mode === 'login') {
      const res = await loginWithPhone(phone, password);
      setIsLoading(false);

      if (res.success) {
        toast.success(
          lang === 'fr' ? 'Connexion réussie !' : 'تم تسجيل الدخول بنجاح!'
        );
        const isClient = role === 'client';
        navigate(isClient ? '/entreprise' : '/app');
      } else {
        toast.error(t(res.error || 'auth.auth_failed'));
      }
    } else {
      // Register Mode
      const res = await signupWithPhone(phone, password, role);
      setIsLoading(false);

      if (res.success) {
        toast.success(
          lang === 'fr'
            ? 'Compte créé avec succès ! 72h d\'essai activées.'
            : 'تم إنشاء الحساب بنجاح وتفعيل فترة التجربة (72 ساعة)!'
        );
        setShowWelcomeModal(true);
      } else {
        toast.error(t(res.error || 'auth.signup_failed'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <PublicHeader />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 sm:py-14 text-start">
        <Card className="p-6 sm:p-8 bg-white border border-steel-200 shadow-elevated rounded-3xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-ink text-[11px] font-black uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'fr' ? 'Accès direct sans e-mail' : 'تسجيل سريع برقم الهاتف'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-ink">
              {mode === 'login' ? t('auth.login_title') : t('auth.register_title')}
            </h1>
            <p className="text-xs text-steel-500 mt-1 max-w-sm mx-auto">
              {mode === 'login'
                ? t('auth.login_subtitle')
                : t('auth.register_subtitle')}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-steel-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-2.5 text-xs font-black rounded-xl transition-all min-h-[44px] cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
            >
              {t('nav.login')}
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-2.5 text-xs font-black rounded-xl transition-all min-h-[44px] cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
            >
              {t('nav.register')}
            </button>
          </div>

          {/* Registration Role Selection: 2 Large Cards */}
          {mode === 'register' && (
            <div className="mb-6">
              <label className="text-xs font-black text-steel-700 block mb-2.5">
                {t('auth.role_select')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Role 1: Equipment Owner */}
                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  className={`p-3.5 rounded-2xl border text-start flex flex-col justify-between transition-all min-h-[96px] cursor-pointer ${
                    role === 'owner'
                      ? 'border-primary bg-amber-50/60 ring-2 ring-primary text-ink shadow-sm'
                      : 'border-steel-200 bg-white text-steel-700 hover:bg-steel-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary-dark font-black">
                      <Truck className="w-4 h-4" />
                    </div>
                    {role === 'owner' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-black block text-ink">
                      {t('auth.role_owner')}
                    </span>
                    <span className="text-[10px] text-steel-500 line-clamp-2 mt-0.5 leading-snug">
                      {t('auth.role_owner_desc')}
                    </span>
                  </div>
                </button>

                {/* Role 2: Contractor / Client */}
                <button
                  type="button"
                  onClick={() => setRole('client')}
                  className={`p-3.5 rounded-2xl border text-start flex flex-col justify-between transition-all min-h-[96px] cursor-pointer ${
                    role === 'client'
                      ? 'border-primary bg-amber-50/60 ring-2 ring-primary text-ink shadow-sm'
                      : 'border-steel-200 bg-white text-steel-700 hover:bg-steel-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="w-8 h-8 rounded-xl bg-steel-100 flex items-center justify-center text-steel-700 font-black">
                      <Building2 className="w-4 h-4" />
                    </div>
                    {role === 'client' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-black block text-ink">
                      {t('auth.role_client')}
                    </span>
                    <span className="text-[10px] text-steel-500 line-clamp-2 mt-0.5 leading-snug">
                      {t('auth.role_client_desc')}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Field */}
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {t('auth.phone')}
              </label>
              <div className="relative">
                <input
                  type="tel"
                  dir="ltr"
                  placeholder={t('auth.phone_placeholder')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full px-3.5 py-3 rounded-xl border text-sm font-mono tracking-wider transition-colors min-h-[48px] focus:outline-none focus:ring-2 ${
                    isPhoneTouched
                      ? phoneValidation.isValid
                        ? 'border-emerald-500 focus:ring-emerald-400 bg-emerald-50/20'
                        : 'border-red-400 focus:ring-red-400 bg-red-50/20'
                      : 'border-steel-300 focus:ring-primary focus:border-primary bg-white'
                  }`}
                  required
                />
                <div className="absolute inset-y-0 end-3 flex items-center pointer-events-none">
                  {isPhoneTouched && (
                    phoneValidation.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )
                  )}
                </div>
              </div>

              {/* Phone Hint / Normalized Display */}
              <div className="flex items-center justify-between mt-1 text-[11px]">
                <span className="text-steel-400">
                  {t('auth.phone_hint')}
                </span>
                {phoneValidation.isValid && (
                  <span className="text-emerald-700 font-mono font-bold">
                    {phoneValidation.displayFormatted}
                  </span>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.password_placeholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white pe-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 end-3 flex items-center text-steel-400 hover:text-ink cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Password Strength Meter (Shown on Register mode or when entering password) */}
              {mode === 'register' && isPasswordTouched && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`flex-1 rounded-full transition-all ${
                          passwordStrength.score >= step
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
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-steel-500">
                      {t('auth.password_strength')}:
                    </span>
                    <span
                      className={
                        passwordStrength.level === 'strong'
                          ? 'text-emerald-600'
                          : passwordStrength.level === 'medium'
                          ? 'text-amber-600'
                          : 'text-red-500'
                      }
                    >
                      {passwordStrength.level === 'strong'
                        ? t('auth.password_strong')
                        : passwordStrength.level === 'medium'
                        ? t('auth.password_medium')
                        : t('auth.password_weak')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center mt-3 font-black min-h-[50px] shadow-sm"
              isLoading={isLoading}
            >
              {mode === 'login' ? t('auth.btn_login') : t('auth.btn_register')}
            </Button>
          </form>
        </Card>
      </main>

      <Footer />

      {/* Welcome Modal triggered upon successful signup */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />
    </div>
  );
};

export default AuthPage;
