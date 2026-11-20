// ============================================================================
// JADIJCB: Moroccan Phone + Password Authentication Page
// Inclusive Client Registration (Entreprise, Agriculteur, Artisan, Particulier,
// Coopérative, Promoteur, Autre) + Conditional Fields (No tax info for clients)
// + 2-Section Post-Registration Next Steps Modal
// ============================================================================

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Truck,
  Users,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  CheckSquare,
  Square,
  Building2,
  Tractor,
  Wrench,
  User,
  Handshake,
  Landmark,
  Briefcase,
  HardHat,
  Award,
  MessageCircle,
  RefreshCw,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Package,
  Ship,
  Globe,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { WelcomeModal } from '../components/dashboard/WelcomeModal';
import { ClientNextStepsModal } from '../components/auth/ClientNextStepsModal';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { DriverMachineChecklist } from '../components/driver/DriverMachineChecklist';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import {
  normalizeMoroccanPhone,
  calculatePasswordStrength,
} from '../lib/authHelpers';
import {
  sendWhatsAppOtp,
  verifyWhatsAppOtp,
  generateMyRecoveryCode,
  mapOtpErrorMessage,
} from '../lib/whatsappOtpService';
import { Copy, Check } from 'lucide-react';
import { MOROCCAN_CITIES } from '../data/cities';
import { CLIENT_SEGMENTS } from '../data/clientSegments';
import { DRIVER_EXPERIENCE_LEVELS } from '../data/driverMachines';
import {
  SUPPLIER_TYPES,
  IMPORT_ORIGIN_COUNTRIES,
  IMPORT_LEAD_TIMES,
} from '../data/supplierOptions';
import { UserRole, ClientSegment, SupplierType } from '../types/database';
import { platformSettingsStore } from '../lib/platformSettings';

const SEGMENT_ICONS: Record<ClientSegment, React.ReactNode> = {
  company: <Building2 className="w-4 h-4 shrink-0" />,
  farmer: <Tractor className="w-4 h-4 shrink-0" />,
  artisan: <Wrench className="w-4 h-4 shrink-0" />,
  individual: <User className="w-4 h-4 shrink-0" />,
  cooperative: <Handshake className="w-4 h-4 shrink-0" />,
  developer: <Landmark className="w-4 h-4 shrink-0" />,
  other: <Briefcase className="w-4 h-4 shrink-0" />,
};

export const AuthPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithPhone, signupWithPhone, updateProfile, profile, isSuperAdmin } = useAuth();

  const isSignupParam =
    searchParams.get('mode') === 'signup' || searchParams.get('mode') === 'register';
  const [mode, setMode] = useState<'login' | 'register'>(
    isSignupParam ? 'register' : 'login'
  );

  const roleParam = searchParams.get('role');
  const initialRole: UserRole =
    roleParam === 'supplier' || roleParam === 'dealer'
      ? 'supplier'
      : roleParam === 'driver'
      ? 'driver'
      : roleParam === 'client' || roleParam === 'contractor'
      ? 'client'
      : 'owner';

  // Form State
  const [role, setRole] = useState<UserRole>(initialRole); // 'owner' | 'client' | 'driver' | 'supplier'
  const [clientSegment, setClientSegment] = useState<ClientSegment>('company');
  const [clientActivityNote, setClientActivityNote] = useState('');
  const [driverMachines, setDriverMachines] = useState<string[]>(['tractopelle']);
  const [driverExperienceYears, setDriverExperienceYears] = useState<string>('3_5');
  const [supplierType, setSupplierType] = useState<SupplierType>('all');
  const [importCountries, setImportCountries] = useState<string[]>(['europe', 'china']);
  const [importLeadTime, setImportLeadTime] = useState<string>('15_30');
  const [deliversNationwide, setDeliversNationwide] = useState<boolean>(true);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cityId, setCityId] = useState('casablanca');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showClientNextStepsModal, setShowClientNextStepsModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // WhatsApp OTP / Free Recovery Registration Step
  const [regOtpMode, setRegOtpMode] = useState<'none' | 'otp' | 'free_recovery_saved'>('none');
  const [regOtpCode, setRegOtpCode] = useState('');
  const [regResendCooldown, setRegResendCooldown] = useState(0);
  const [savedRecoveryCode, setSavedRecoveryCode] = useState('');
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  React.useEffect(() => {
    if (regResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setRegResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [regResendCooldown]);

  const isClientCompany = role === 'client' && clientSegment === 'company';

  // Live Phone Validation
  const phoneValidation = normalizeMoroccanPhone(phone);
  const isPhoneTouched = phone.length > 2;

  // Live Password Strength
  const passwordStrength = calculatePasswordStrength(password);
  const isPasswordTouched = password.length > 0;

  const proceedAfterRegistration = () => {
    setRegOtpMode('none');
    setSavedRecoveryCode('');
    if (role === 'driver') {
      navigate('/driver');
    } else if (role === 'supplier' || role === 'dealer') {
      navigate('/supplier');
    } else if (role === 'client') {
      setShowClientNextStepsModal(true);
    } else {
      setShowWelcomeModal(true);
    }
  };

  const toggleImportCountry = (countryId: string) => {
    setImportCountries((prev) =>
      prev.includes(countryId)
        ? prev.filter((id) => id !== countryId)
        : [...prev, countryId]
    );
  };

  const completeRegistration = async (whatsappVerified: boolean, showFreeRecoveryCard = false) => {
    const cityName = MOROCCAN_CITIES.find((c) => c.id === cityId)?.name_ar || cityId;
    const isSupplierRole = role === 'supplier' || role === 'dealer';
    const finalCompanyName =
      role === 'owner' || isSupplierRole || isClientCompany ? companyName.trim() : '';
    const effectiveImportCountries =
      isSupplierRole && (supplierType === 'importer' || supplierType === 'all')
        ? importCountries
        : [];

    setIsLoading(true);
    try {
      const res = await signupWithPhone(phone, password, role, {
        fullName: fullName.trim(),
        companyName: finalCompanyName,
        city: cityName,
        clientSegment: role === 'client' ? clientSegment : undefined,
        clientActivityNote:
          role === 'client' && clientSegment === 'other'
            ? clientActivityNote.trim()
            : undefined,
        driverMachines: role === 'driver' ? driverMachines : undefined,
        driverExperienceYears: role === 'driver' ? driverExperienceYears : undefined,
        driverAvailable: role === 'driver' ? true : undefined,
        supplierType: isSupplierRole ? supplierType : undefined,
        importCountries: isSupplierRole ? effectiveImportCountries : undefined,
        importLeadTime: isSupplierRole && (supplierType === 'importer' || supplierType === 'all') ? importLeadTime : undefined,
        deliversNationwide: isSupplierRole ? deliversNationwide : undefined,
        whatsappVerified,
      });

      if (res.success) {
        await updateProfile({
          full_name: fullName.trim(),
          company_name: finalCompanyName,
          city: cityName,
          role:
            role === 'owner'
              ? 'owner'
              : role === 'driver'
              ? 'driver'
              : isSupplierRole
              ? 'supplier'
              : 'client',
          client_segment: role === 'client' ? clientSegment : undefined,
          client_activity_note:
            role === 'client' && clientSegment === 'other'
              ? clientActivityNote.trim()
              : '',
          driver_machines: role === 'driver' ? driverMachines : undefined,
          driver_experience_years: role === 'driver' ? driverExperienceYears : undefined,
          driver_available: role === 'driver' ? true : undefined,
          supplier_type: isSupplierRole ? supplierType : undefined,
          import_countries: isSupplierRole ? effectiveImportCountries : undefined,
          import_lead_time:
            isSupplierRole && (supplierType === 'importer' || supplierType === 'all')
              ? importLeadTime
              : undefined,
          delivers_nationwide: isSupplierRole ? deliversNationwide : undefined,
        });

        const recRes = await generateMyRecoveryCode(phoneValidation.e164).catch(() => ({
          success: false,
          code: undefined,
        }));

        toast.success(
          role === 'driver'
            ? lang === 'fr'
              ? 'Compte conducteur créé ! Bienvenue sur votre espace offres.'
              : 'تم إنشاء حساب السائق بنجاح! مرحباً بك في بوابة عروض العمل.'
            : isSupplierRole
            ? lang === 'fr'
              ? 'Compte fournisseur & importateur créé ! Bienvenue sur votre portail.'
              : 'تم إنشاء حساب المورد وشركة الاستيراد بنجاح! مرحباً بك في بوابتك.'
            : role === 'client'
            ? lang === 'fr'
              ? 'Compte créé avec succès !'
              : 'تم إنشاء حسابك وحفظ معلوماتك بنجاح!'
            : lang === 'fr'
            ? 'Compte créé avec succès ! 72h d\'essai activées.'
            : 'تم إنشاء الحساب وتفعيل التجربة المجانية بنجاح!'
        );

        if (showFreeRecoveryCard && recRes?.success && recRes.code) {
          setSavedRecoveryCode(recRes.code);
          setRegOtpMode('free_recovery_saved');
          return;
        }

        setRegOtpCode('');
        proceedAfterRegistration();
      } else {
        toast.error(t(res.error || 'auth.signup_failed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestRegistrationOtp = async () => {
    setIsLoading(true);
    try {
      const otpRes = await sendWhatsAppOtp({
        phone: phoneValidation.e164,
        purpose: 'register',
        lang,
      });

      if (!otpRes.success) {
        toast.error(mapOtpErrorMessage(otpRes.error, lang, otpRes.retryAfterSeconds));
        return;
      }

      if (otpRes.delivery === 'gateway_not_configured') {
        await completeRegistration(false, true);
        return;
      }

      setRegOtpMode('otp');
      setRegOtpCode('');
      setRegResendCooldown(60);
      toast.success(
        lang === 'fr'
          ? `Code d'activation envoyé sur WhatsApp (${phoneValidation.displayFormatted})`
          : `تم إرسال كود التفعيل إلى واتساب (${phoneValidation.displayFormatted})`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRegistrationOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = regOtpCode.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez saisir le code à 6 chiffres reçu sur WhatsApp'
          : 'يرجى إدخال كود التفعيل المكون من 6 أرقام'
      );
      return;
    }

    setIsLoading(true);
    try {
      const verRes = await verifyWhatsAppOtp({
        phone: phoneValidation.e164,
        purpose: 'register',
        code: cleanCode,
      });

      if (!verRes.success) {
        const extra =
          typeof verRes.remainingAttempts === 'number'
            ? lang === 'fr'
              ? ` (${verRes.remainingAttempts} essai(s) restant(s))`
              : ` (تبقى ${verRes.remainingAttempts} محاولات)`
            : '';
        toast.error(mapOtpErrorMessage(verRes.error, lang) + extra);
        return;
      }

      await completeRegistration(true);
    } finally {
      setIsLoading(false);
    }
  };

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

    if (mode === 'login') {
      setIsLoading(true);
      try {
        const res = await loginWithPhone(phone, password);

        if (res.success) {
          toast.success(
            lang === 'fr' ? 'Connexion réussie !' : 'تم تسجيل الدخول بنجاح!'
          );
          const actualRole = res.role || profile?.role;
          if (actualRole === 'admin' || isSuperAdmin) {
            navigate('/admin');
            return;
          }
          if (actualRole === 'driver') {
            navigate('/driver');
            return;
          }
          if (actualRole === 'supplier' || actualRole === 'dealer') {
            navigate('/supplier');
            return;
          }
          const isClient = actualRole === 'client' || actualRole === 'contractor';
          navigate(isClient ? '/entreprise' : '/owner');
        } else {
          toast.error(t(res.error || 'auth.auth_failed'));
        }
      } catch {
        toast.error(t('auth.network_error'));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Register Mode Validation
    if (role === 'owner' || role === 'supplier' || role === 'dealer') {
      if (!fullName.trim()) {
        toast.error(lang === 'fr' ? 'Veuillez saisir votre nom complet' : 'يرجى إدخال الاسم الكامل للمسؤول');
        return;
      }
      if (!companyName.trim()) {
        toast.error(
          role === 'supplier' || role === 'dealer'
            ? lang === 'fr'
              ? 'Veuillez saisir le nom de votre magasin ou société d\'importation'
              : 'يرجى إدخال اسم المتجر أو شركة الاستيراد'
            : lang === 'fr'
            ? 'Veuillez saisir le nom de votre entreprise'
            : 'يرجى إدخال اسم الشركة أو المقاولة'
        );
        return;
      }
    } else if (role === 'driver') {
      if (!fullName.trim()) {
        toast.error(
          lang === 'fr'
            ? 'Veuillez saisir votre nom complet'
            : 'يرجى إدخال اسمك الكامل'
        );
        return;
      }
      if (driverMachines.length === 0) {
        toast.error(
          lang === 'fr'
            ? 'Veuillez cocher au moins un engin que vous maîtrisez'
            : 'يرجى اختيار آلية واحدة على الأقل من الآليات التي تحترف قيادتها'
        );
        return;
      }
    } else {
      if (isClientCompany && !companyName.trim()) {
        toast.error(
          lang === 'fr'
            ? 'Veuillez saisir le nom de l\'entreprise'
            : 'يرجى إدخال اسم المقاولة'
        );
        return;
      }
      if (!fullName.trim()) {
        toast.error(
          isClientCompany
            ? lang === 'fr'
              ? 'Veuillez saisir le nom du propriétaire / gérant'
              : 'يرجى إدخال اسم المالك / المسؤول'
            : lang === 'fr'
            ? 'Veuillez saisir votre nom complet'
            : 'يرجى إدخال الاسم الكامل'
        );
        return;
      }
    }

    await handleRequestRegistrationOtp();
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <PublicHeader />

      <main className="flex-1 max-w-lg mx-auto w-full px-3.5 sm:px-4 py-6 sm:py-12 text-start">
        <Card className="p-5 sm:p-8 bg-white border border-steel-200 shadow-elevated rounded-3xl">
          {/* Header */}
          <div className="text-center mb-5 sm:mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-ink text-[11px] font-black uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'fr' ? 'Accès direct sans e-mail' : 'تسجيل سريع برقم الهاتف'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-ink">
              {mode === 'login' ? t('auth.login_title') : t('auth.register_title')}
            </h1>
            <p className="text-xs text-steel-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {mode === 'login'
                ? t('auth.login_subtitle')
                : t('auth.register_subtitle')}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-steel-100 rounded-2xl mb-5 sm:mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setRegOtpMode('none');
              }}
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
              onClick={() => {
                setMode('register');
                setRegOtpMode('none');
              }}
              className={`py-2.5 text-xs font-black rounded-xl transition-all min-h-[44px] cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
            >
              {t('nav.register')}
            </button>
          </div>

          {/* Registration Role Selection: Owner vs Client vs Driver */}
          {mode === 'register' && regOtpMode === 'none' && (
            <div className="mb-5">
              <label className="text-xs font-black text-steel-700 block mb-2.5">
                {t('auth.role_select')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Role 1: Equipment Owner */}
                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  className={`p-3.5 rounded-2xl border text-start flex flex-col justify-between transition-all min-h-[92px] cursor-pointer ${
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

                {/* Role 2: Client (Entreprise, Farmer, Artisan, Individual, etc.) */}
                <button
                  type="button"
                  onClick={() => setRole('client')}
                  className={`p-3.5 rounded-2xl border text-start flex flex-col justify-between transition-all min-h-[92px] cursor-pointer ${
                    role === 'client'
                      ? 'border-primary bg-amber-50/60 ring-2 ring-primary text-ink shadow-sm'
                      : 'border-steel-200 bg-white text-steel-700 hover:bg-steel-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="w-8 h-8 rounded-xl bg-steel-100 flex items-center justify-center text-steel-700 font-black">
                      <Users className="w-4 h-4" />
                    </div>
                    {role === 'client' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-black block text-ink">
                      {lang === 'fr'
                        ? 'Client / Locataire d\'engins'
                        : 'زبون مستأجر أو مشتري للآليات'}
                    </span>
                    <span className="text-[10px] text-steel-500 line-clamp-2 mt-0.5 leading-snug">
                      {lang === 'fr'
                        ? 'Entreprise, agriculteur, artisan, particulier...'
                        : 'مقاولة، فلاح، مهني، فرد، تعاونية أو أخرى'}
                    </span>
                  </div>
                </button>

                {/* Role 3: Professional Heavy Machinery Driver */}
                <button
                  type="button"
                  onClick={() => setRole('driver')}
                  className={`p-3.5 rounded-2xl border text-start flex flex-col justify-between transition-all min-h-[96px] cursor-pointer ${
                    role === 'driver'
                      ? 'border-primary bg-amber-50/60 ring-2 ring-primary text-ink shadow-sm'
                      : 'border-steel-200 bg-white text-steel-700 hover:bg-steel-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="w-8 h-8 rounded-xl bg-ink text-primary flex items-center justify-center font-black">
                      <HardHat className="w-4 h-4" />
                    </div>
                    {role === 'driver' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-ink">
                        {t('auth.role_driver')}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700">
                        {lang === 'fr' ? 'Gratuit' : 'مجاني'}
                      </span>
                    </div>
                    <span className="text-[10px] text-steel-500 line-clamp-2 mt-0.5 leading-snug">
                      {t('auth.role_driver_desc')}
                    </span>
                  </div>
                </button>

                {/* Role 4: Machinery / Spare Parts Supplier & International Importer */}
                <button
                  type="button"
                  onClick={() => setRole('supplier')}
                  className={`p-3.5 rounded-2xl border text-start flex flex-col justify-between transition-all min-h-[96px] cursor-pointer ${
                    role === 'supplier' || role === 'dealer'
                      ? 'border-primary bg-amber-50/60 ring-2 ring-primary text-ink shadow-sm'
                      : 'border-steel-200 bg-white text-steel-700 hover:bg-steel-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-primary-dark flex items-center justify-center font-black">
                      <Package className="w-4 h-4" />
                    </div>
                    {(role === 'supplier' || role === 'dealer') && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-black block text-ink">
                      {lang === 'fr'
                        ? 'Fournisseur Engins, Pièces & Import'
                        : 'مورد آليات وقطع غيار / شركة استيراد'}
                    </span>
                    <span className="text-[10px] text-steel-500 line-clamp-2 mt-0.5 leading-snug">
                      {lang === 'fr'
                        ? 'Vente pièces, engins au Maroc ou import depuis l’étranger'
                        : 'بيع الآليات وقطع الغيار أو الاستيراد من أوروبا وآسيا للملاك'}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Client Category Checklist (قائمة cocher mobile-first) */}
          {mode === 'register' && regOtpMode === 'none' && role === 'client' && (
            <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-steel-50/80 border border-steel-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-black text-ink">
                  {lang === 'fr' ? 'Quelle est votre catégorie ? *' : 'اختر صفتك أو فئة حسابك (قائمة للاختيار) *'}
                </label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  {lang === 'fr' ? '100% Gratuit' : 'مجاني للزبناء'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {CLIENT_SEGMENTS.map((seg) => {
                  const isChecked = clientSegment === seg.id;
                  const isLastOdd = seg.id === 'other';
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => setClientSegment(seg.id)}
                      className={`p-2.5 sm:p-3 rounded-xl border text-start transition-all min-h-[56px] flex items-start gap-2 cursor-pointer ${
                        isLastOdd ? 'col-span-2' : ''
                      } ${
                        isChecked
                          ? 'bg-white border-primary ring-2 ring-primary/40 text-ink shadow-xs'
                          : 'bg-white/75 border-steel-200 text-steel-700 hover:bg-white hover:border-steel-300'
                      }`}
                    >
                      <span
                        className={`mt-0.5 shrink-0 ${
                          isChecked ? 'text-primary-dark' : 'text-steel-400'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={isChecked ? 'text-primary-dark' : 'text-steel-500'}>
                            {SEGMENT_ICONS[seg.id]}
                          </span>
                          <span className="text-xs font-black text-ink truncate">
                            {lang === 'fr' ? seg.labelFr : seg.labelAr}
                          </span>
                        </div>
                        <span className="text-[10px] text-steel-500 block mt-0.5 leading-snug line-clamp-1">
                          {lang === 'fr' ? seg.shortDescFr : seg.shortDescAr}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Registration Step 2a: 6-Digit WhatsApp OTP Verification */}
          {mode === 'register' && regOtpMode === 'otp' && (
            <form onSubmit={handleVerifyRegistrationOtp} className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-xs">
                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Vérification WhatsApp requise'
                      : 'تفعيل الحساب عبر واتساب'}
                  </span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  {lang === 'fr'
                    ? 'Nous avons envoyé un code à 6 chiffres sur votre WhatsApp :'
                    : 'أرسلنا كود تفعيل من 6 أرقام إلى تطبيق واتساب على الرقم:'}
                </p>
                <div className="text-sm font-mono font-black text-emerald-700" dir="ltr">
                  {phoneValidation.displayFormatted}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-steel-700">
                    {lang === 'fr' ? 'Code d’activation (6 chiffres) *' : 'كود التفعيل (6 أرقام) *'}
                  </label>
                  <button
                    type="button"
                    disabled={regResendCooldown > 0 || isLoading}
                    onClick={handleRequestRegistrationOtp}
                    className={`text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                      regResendCooldown > 0
                        ? 'text-steel-400 cursor-not-allowed'
                        : 'text-primary-dark hover:underline'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>
                      {regResendCooldown > 0
                        ? lang === 'fr'
                          ? `Renvoyer (${regResendCooldown}s)`
                          : `إعادة الإرسال (${regResendCooldown}ث)`
                        : lang === 'fr'
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
                  value={regOtpCode}
                  onChange={(e) => setRegOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3.5 rounded-xl border border-steel-300 text-center text-xl font-mono font-black tracking-[0.45em] focus:outline-none focus:ring-2 focus:ring-primary bg-surface min-h-[54px]"
                  required
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="w-full justify-center font-black min-h-[50px]"
              >
                {lang === 'fr'
                  ? 'Valider le code et créer mon compte'
                  : 'تأكيد الكود وإنشاء الحساب'}
              </Button>

              <button
                type="button"
                onClick={() => setRegOtpMode('none')}
                className="w-full py-2 text-xs font-bold text-steel-600 hover:text-ink inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {lang === 'fr' ? (
                  <ArrowLeft className="w-3.5 h-3.5" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                <span>
                  {lang === 'fr'
                    ? 'Modifier le numéro ou les informations'
                    : 'الرجوع لتعديل الرقم أو البيانات'}
                </span>
              </button>
            </form>
          )}

          {/* Registration Step 2b: 100% Free Personal WhatsApp Recovery Code Card */}
          {mode === 'register' && regOtpMode === 'free_recovery_saved' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs text-emerald-950">
                <div className="flex items-center gap-2 font-black text-emerald-800 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Compte créé ! Sauvegardez votre code de récupération'
                      : 'تم إنشاء حسابك! احفظ كود استرجاع كلمة السر مجاناً'}
                  </span>
                </div>
                <p className="leading-relaxed text-emerald-900">
                  {lang === 'fr'
                    ? 'En cas d’oubli de votre mot de passe, ce code personnel vous permet de le réinitialiser instantanément sans frais. Envoyez-le dans votre propre WhatsApp pour le garder en sécurité :'
                    : 'إذا نسيت كلمة السر مستقبلاً، هذا الكود الشخصي يمكّنك من استرجاع حسابك فوراً وبشكل مجاني 100%. احفظه الآن في محادثتك على واتساب:'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface border-2 border-dashed border-primary/60 text-center space-y-2">
                <span className="text-[11px] font-bold text-steel-500 block">
                  {lang === 'fr' ? 'Votre code personnel (8 chiffres)' : 'كود الاسترجاع الشخصي الخاص بك'}
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-mono font-black tracking-widest text-ink" dir="ltr">
                    {savedRecoveryCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(savedRecoveryCode);
                      setCopiedRecovery(true);
                      setTimeout(() => setCopiedRecovery(false), 2000);
                    }}
                    className="p-2 rounded-xl bg-white border border-steel-200 text-steel-600 hover:text-ink cursor-pointer"
                    title="نسخ الكود"
                  >
                    {copiedRecovery ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {(() => {
                const userDigits = phoneValidation.e164.replace(/\D/g, '');
                const saveText =
                  lang === 'fr'
                    ? `🔐 Mon code de récupération JADIJCB (${phoneValidation.displayFormatted}) : *${savedRecoveryCode}*\nÀ conserver pour réinitialiser le mot de passe gratuitement.`
                    : `🔐 كود استرجاع حسابي في منصة JADIJCB\n📱 الرقم: ${phoneValidation.displayFormatted}\n🔑 كود الاسترجاع: *${savedRecoveryCode}*\n(احتفظ بهذه الرسالة لاستعادة كلمة السر مجاناً في أي وقت)`;
                return (
                  <a
                    href={`https://wa.me/${userDigits}?text=${encodeURIComponent(saveText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition-colors min-h-[48px]"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>
                      {lang === 'fr'
                        ? 'Sauvegarder ce code dans mon WhatsApp (Gratuit)'
                        : 'إرسال وحفظ الكود في واتسابي الآن (مجاناً)'}
                    </span>
                  </a>
                );
              })()}

              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={proceedAfterRegistration}
                className="w-full justify-center font-black min-h-[50px]"
              >
                {lang === 'fr' ? 'Accéder à mon tableau de bord' : 'دخول إلى حسابي ←'}
              </Button>
            </div>
          )}

          {/* Main Login / Registration Form */}
          {(mode === 'login' || regOtpMode === 'none') && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Registration Specific Conditional Fields */}
            {mode === 'register' && (
              <>
                {role === 'client' ? (
                  <>
                    {/* When client chooses 'company': Ask for Company Name FIRST, then Owner Name, then City (NO tax info) */}
                    {isClientCompany ? (
                      <>
                        <div>
                          <label className="text-xs font-bold text-steel-700 block mb-1.5">
                            {lang === 'fr' ? 'Nom de l\'entreprise / Société *' : 'اسم المقاولة أو الشركة *'}
                          </label>
                          <input
                            type="text"
                            placeholder={
                              lang === 'fr'
                                ? 'ex. Atlas Travaux & Bâtiment SARL'
                                : 'مثال: مقاولة أطلس للبناء والأشغال'
                            }
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required
                            className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-steel-700 block mb-1.5">
                            {lang === 'fr' ? 'Nom du propriétaire / gérant *' : 'اسم المالك أو المسؤول *'}
                          </label>
                          <input
                            type="text"
                            placeholder={lang === 'fr' ? 'ex. Karim Benjelloun' : 'مثال: كريم بنجلون'}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                          />
                        </div>
                      </>
                    ) : (
                      /* Non-company clients (Farmer, Artisan, Individual, Cooperative, Developer, Other): General info only, NO tax info */
                      <>
                        <div>
                          <label className="text-xs font-bold text-steel-700 block mb-1.5">
                            {lang === 'fr' ? 'Nom complet *' : 'الاسم الكامل *'}
                          </label>
                          <input
                            type="text"
                            placeholder={
                              clientSegment === 'farmer'
                                ? lang === 'fr'
                                  ? 'ex. Hassan El Filali'
                                  : 'مثال: الحسن الفيلالي'
                                : clientSegment === 'individual'
                                ? lang === 'fr'
                                  ? 'ex. Amine Alami'
                                  : 'مثال: أمين العلمي'
                                : lang === 'fr'
                                ? 'ex. Mohammed Tazi'
                                : 'مثال: محمد التازي'
                            }
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                          />
                        </div>

                        {clientSegment === 'other' && (
                          <div>
                            <label className="text-xs font-bold text-steel-700 block mb-1.5">
                              {lang === 'fr'
                                ? 'Précision sur votre activité (optionnel)'
                                : 'توضيح النشاط أو الغرض (اختياري)'}
                            </label>
                            <input
                              type="text"
                              placeholder={
                                lang === 'fr'
                                  ? 'ex. Forage, aménagement terrain, transport...'
                                  : 'مثال: حفر بئر، تسوية بقعة، تهيئة طريق...'
                              }
                              value={clientActivityNote}
                              onChange={(e) => setClientActivityNote(e.target.value)}
                              className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* City Selector for all Client segments */}
                    <div>
                      <label className="text-xs font-bold text-steel-700 block mb-1.5">
                        {lang === 'fr' ? 'Ville / Région principale' : 'المدينة أو الإقليم الرئيسي'}
                      </label>
                      <select
                        value={cityId}
                        onChange={(e) => setCityId(e.target.value)}
                        className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                      >
                        {MOROCCAN_CITIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {lang === 'fr' ? c.name_fr : c.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : role === 'driver' ? (
                  /* Professional Machinery Driver Registration Fields */
                  <>
                    <div>
                      <label className="text-xs font-bold text-steel-700 block mb-1.5">
                        {lang === 'fr' ? 'Nom complet du conducteur *' : 'الاسم الكامل للسائق *'}
                      </label>
                      <input
                        type="text"
                        placeholder={lang === 'fr' ? 'ex. Youssef El Mansouri' : 'مثال: يوسف المنصوري'}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-steel-700 block mb-1.5">
                          {lang === 'fr' ? 'Ville de résidence *' : 'المدينة *'}
                        </label>
                        <select
                          value={cityId}
                          onChange={(e) => setCityId(e.target.value)}
                          className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                        >
                          {MOROCCAN_CITIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {lang === 'fr' ? c.name_fr : c.name_ar}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-primary-dark" />
                          <span>{lang === 'fr' ? 'Années d’expérience *' : 'سنوات التجربة *'}</span>
                        </label>
                        <select
                          value={driverExperienceYears}
                          onChange={(e) => setDriverExperienceYears(e.target.value)}
                          className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                        >
                          {DRIVER_EXPERIENCE_LEVELS.map((exp) => (
                            <option key={exp.id} value={exp.id}>
                              {lang === 'fr' ? exp.labelFr : exp.labelAr}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Mastered Machines Checklist */}
                    <div className="p-3.5 rounded-2xl bg-steel-50/80 border border-steel-200 space-y-2.5">
                      <div>
                        <label className="text-xs font-black text-ink block">
                          {lang === 'fr'
                            ? 'Engins que vous maîtrisez au Maroc (cochez un ou plusieurs) *'
                            : 'الآليات التي تحترف قيادتها في المغرب (اختر آلية أو أكثر) *'}
                        </label>
                        <p className="text-[11px] text-steel-500 mt-0.5">
                          {lang === 'fr'
                            ? 'Vous recevrez en priorité les offres d’emploi urgentes correspondant à ces engins.'
                            : 'ستصلك إشعارات عروض العمل العاجلة حسب الآليات التي تختارها هنا.'}
                        </p>
                      </div>
                      <DriverMachineChecklist
                        selectedIds={driverMachines}
                        onChange={setDriverMachines}
                        compact
                      />
                    </div>
                  </>
                ) : role === 'supplier' || role === 'dealer' ? (
                  /* Machinery / Spare Parts Supplier & International Importer Registration Fields */
                  <>
                    <div className="p-3.5 rounded-2xl bg-steel-50/90 border border-steel-200 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-black text-ink flex items-center gap-1.5">
                          <Ship className="w-4 h-4 text-primary-dark" />
                          <span>
                            {lang === 'fr'
                              ? 'Type de fournisseur / activité *'
                              : 'طبيعة نشاط المورد أو شركة الاستيراد *'}
                          </span>
                        </label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {SUPPLIER_TYPES.map((st) => {
                          const active = supplierType === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => setSupplierType(st.id)}
                              className={`p-2.5 rounded-xl border text-start transition-all min-h-[54px] cursor-pointer ${
                                active
                                  ? 'bg-white border-primary ring-2 ring-primary/35 text-ink'
                                  : 'bg-white/75 border-steel-200 text-steel-700 hover:bg-white'
                              }`}
                            >
                              <span className="text-xs font-black block text-ink">
                                {lang === 'fr' ? st.labelFr : st.labelAr}
                              </span>
                              <span className="text-[10px] text-steel-500 block mt-0.5 leading-snug">
                                {lang === 'fr' ? st.descFr : st.descAr}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-steel-700 block mb-1.5">
                        {lang === 'fr'
                          ? 'Nom du magasin / société ou importateur *'
                          : 'اسم المتجر أو شركة التوريد / الاستيراد *'}
                      </label>
                      <input
                        type="text"
                        placeholder={
                          lang === 'fr'
                            ? 'ex. EuroParts & Engins Import SARL'
                            : 'مثال: شركة النخبة لقطع الغيار واستيراد الآليات'
                        }
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                        className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-steel-700 block mb-1.5">
                        {lang === 'fr' ? 'Nom complet du responsable *' : 'الاسم الكامل للمسؤول *'}
                      </label>
                      <input
                        type="text"
                        placeholder={lang === 'fr' ? 'ex. Rachid Bennani' : 'مثال: رشيد بناني'}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-steel-700 block mb-1.5">
                        {lang === 'fr'
                          ? 'Ville / Siège principal au Maroc (ou Port d\'entrée)'
                          : 'المدينة أو المقر الرئيسي في المغرب (أو ميناء التسليم)'}
                      </label>
                      <select
                        value={cityId}
                        onChange={(e) => setCityId(e.target.value)}
                        className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                      >
                        {MOROCCAN_CITIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {lang === 'fr' ? c.name_fr : c.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(supplierType === 'importer' || supplierType === 'all') && (
                      <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                        <div>
                          <label className="text-xs font-black text-ink flex items-center gap-1.5 mb-1">
                            <Globe className="w-3.5 h-3.5 text-primary-dark" />
                            <span>
                              {lang === 'fr'
                                ? 'Pays / Régions d\'importation habituels'
                                : 'بلدان الاستيراد المتاحة (أوروبا، الصين، تركيا...)'}
                            </span>
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {IMPORT_ORIGIN_COUNTRIES.map((country) => {
                              const selected = importCountries.includes(country.id);
                              return (
                                <button
                                  key={country.id}
                                  type="button"
                                  onClick={() => toggleImportCountry(country.id)}
                                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer min-h-[36px] ${
                                    selected
                                      ? 'bg-ink text-primary border-ink'
                                      : 'bg-white text-steel-700 border-steel-200 hover:bg-steel-50'
                                  }`}
                                >
                                  {country.flag} {lang === 'fr' ? country.nameFr : country.nameAr}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-steel-700 block mb-1">
                            {lang === 'fr'
                              ? 'Délai moyen d\'importation jusqu\'au Maroc'
                              : 'المدة المعتادة لوصول الاستيراد والديوانة'}
                          </label>
                          <select
                            value={importLeadTime}
                            onChange={(e) => setImportLeadTime(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-white min-h-[44px]"
                          >
                            {IMPORT_LEAD_TIMES.map((lt) => (
                              <option key={lt.id} value={lt.id}>
                                {lang === 'fr' ? lt.labelFr : lt.labelAr}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={deliversNationwide}
                      onClick={() => setDeliversNationwide((prev) => !prev)}
                      className={`w-full p-3 rounded-xl border text-start flex items-center gap-2.5 transition-colors cursor-pointer min-h-[46px] ${
                        deliversNationwide
                          ? 'bg-emerald-50/70 border-emerald-300 text-ink'
                          : 'bg-steel-50 border-steel-200 text-steel-700'
                      }`}
                    >
                      <span className={deliversNationwide ? 'text-emerald-600' : 'text-steel-400'}>
                        {deliversNationwide ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </span>
                      <span className="text-xs font-bold">
                        {lang === 'fr'
                          ? 'Livraison et expédition vers toutes les villes du Maroc'
                          : 'نوفر التوصيل والشحن لجميع مدن وموانئ المغرب'}
                      </span>
                    </button>
                  </>
                ) : (
                  /* Equipment Owner Registration Fields */
                  <>
                    <div>
                      <label className="text-xs font-bold text-steel-700 block mb-1.5">
                        {lang === 'fr' ? 'Nom complet du responsable *' : 'الاسم الكامل للمسؤول *'}
                      </label>
                      <input
                        type="text"
                        placeholder={lang === 'fr' ? 'ex. Karim Benjelloun' : 'مثال: كريم بنجلون أو أحمد التازي'}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-steel-700 block mb-1.5">
                        {lang === 'fr' ? 'Nom de la société / parc d\'engins *' : 'اسم الشركة أو أسطول الآليات *'}
                      </label>
                      <input
                        type="text"
                        placeholder={
                          lang === 'fr'
                            ? 'ex. Atlas Terrassement S.A.R.L.'
                            : 'مثال: شركة أطلس لكراء الآليات'
                        }
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                        className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-steel-700 block mb-1.5">
                        {lang === 'fr'
                          ? 'Ville principale de stationnement des engins'
                          : 'المدينة الرئيسية لتمركز أسطول الآليات'}
                      </label>
                      <select
                        value={cityId}
                        onChange={(e) => setCityId(e.target.value)}
                        className="w-full px-3.5 py-3 rounded-xl border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white min-h-[46px]"
                      >
                        {MOROCCAN_CITIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {lang === 'fr' ? c.name_fr : c.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </>
            )}

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
                  {isPhoneTouched &&
                    (phoneValidation.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ))}
                </div>
              </div>

              <div className="flex items-center justify-between mt-1 text-[11px]">
                <span className="text-steel-400">{t('auth.phone_hint')}</span>
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
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {isPasswordTouched && password.length < 8 && (
                <p className="mt-1.5 text-[11px] font-bold text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? `Minimum 8 caractères (${password.length}/8)`
                      : `كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل (${password.length}/8)`}
                  </span>
                </p>
              )}

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
                    <span className="text-steel-500">{t('auth.password_strength')}:</span>
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

              {mode === 'login' && (
                <div className="mt-2.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-black text-primary-dark hover:underline cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'fr'
                        ? 'Mot de passe oublié ? Réinitialiser via WhatsApp'
                        : 'نسيت كلمة المرور؟ استعادة عبر واتساب'}
                    </span>
                  </button>
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
          )}
        </Card>
      </main>

      <Footer />

      {/* Welcome Modal triggered for machinery owners (72h trial) */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />

      {/* Post-Registration 2-Section Action Modal for Clients */}
      <ClientNextStepsModal
        isOpen={showClientNextStepsModal}
        onClose={() => setShowClientNextStepsModal(false)}
      />

      {/* Self-Service WhatsApp OTP Password Reset Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        initialPhone={phone}
        onPasswordResetSuccess={(normPhone, newPass) => {
          setMode('login');
          setPhone(normPhone);
          setPassword(newPass);
        }}
      />
    </div>
  );
};

export default AuthPage;
