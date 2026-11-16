// ============================================================================
// JADIJCB: Moroccan Phone + Password Authentication Page
// Inclusive Client Registration (Entreprise, Agriculteur, Artisan, Particulier,
// Coopérative, Promoteur, Autre) + Conditional Fields (No tax info for clients)
// + 2-Section Post-Registration Next Steps Modal
// ============================================================================

import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Truck,
  Users,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
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
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { WelcomeModal } from '../components/dashboard/WelcomeModal';
import { ClientNextStepsModal } from '../components/auth/ClientNextStepsModal';
import { DriverMachineChecklist } from '../components/driver/DriverMachineChecklist';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import {
  normalizeMoroccanPhone,
  calculatePasswordStrength,
} from '../lib/authHelpers';
import { MOROCCAN_CITIES } from '../data/cities';
import { CLIENT_SEGMENTS } from '../data/clientSegments';
import { DRIVER_EXPERIENCE_LEVELS } from '../data/driverMachines';
import { UserRole, ClientSegment } from '../types/database';
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

  // Form State
  const [role, setRole] = useState<UserRole>('owner'); // 'owner' | 'client' | 'driver'
  const [clientSegment, setClientSegment] = useState<ClientSegment>('company');
  const [clientActivityNote, setClientActivityNote] = useState('');
  const [driverMachines, setDriverMachines] = useState<string[]>(['tractopelle']);
  const [driverExperienceYears, setDriverExperienceYears] = useState<string>('3_5');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cityId, setCityId] = useState('casablanca');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showClientNextStepsModal, setShowClientNextStepsModal] = useState(false);

  const isClientCompany = role === 'client' && clientSegment === 'company';

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
        const actualRole = res.role || profile?.role;
        if (actualRole === 'admin' || isSuperAdmin) {
          navigate('/admin');
          return;
        }
        if (actualRole === 'driver') {
          navigate('/driver');
          return;
        }
        const isClient = actualRole === 'client' || actualRole === 'contractor';
        navigate(isClient ? '/entreprise' : '/owner');
      } else {
        toast.error(t(res.error || 'auth.auth_failed'));
      }
    } else {
      // Register Mode
      if (role === 'owner') {
        if (!fullName.trim()) {
          toast.error(lang === 'fr' ? 'Veuillez saisir votre nom complet' : 'يرجى إدخال الاسم الكامل للمسؤول');
          setIsLoading(false);
          return;
        }
        if (!companyName.trim()) {
          toast.error(
            lang === 'fr'
              ? 'Veuillez saisir le nom de votre entreprise'
              : 'يرجى إدخال اسم الشركة أو المقاولة'
          );
          setIsLoading(false);
          return;
        }
      } else if (role === 'driver') {
        if (!fullName.trim()) {
          toast.error(
            lang === 'fr'
              ? 'Veuillez saisir votre nom complet'
              : 'يرجى إدخال اسمك الكامل'
          );
          setIsLoading(false);
          return;
        }
        if (driverMachines.length === 0) {
          toast.error(
            lang === 'fr'
              ? 'Veuillez cocher au moins un engin que vous maîtrisez'
              : 'يرجى اختيار آلية واحدة على الأقل من الآليات التي تحترف قيادتها'
          );
          setIsLoading(false);
          return;
        }
      } else {
        // Client Registration Validation (based on chosen segment)
        if (isClientCompany && !companyName.trim()) {
          toast.error(
            lang === 'fr'
              ? 'Veuillez saisir le nom de l\'entreprise'
              : 'يرجى إدخال اسم المقاولة'
          );
          setIsLoading(false);
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
          setIsLoading(false);
          return;
        }
      }

      const cityName = MOROCCAN_CITIES.find((c) => c.id === cityId)?.name_ar || cityId;
      const finalCompanyName =
        role === 'owner' || isClientCompany ? companyName.trim() : '';

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
      });

      if (res.success) {
        await updateProfile({
          full_name: fullName.trim(),
          company_name: finalCompanyName,
          city: cityName,
          role: role === 'owner' ? 'owner' : role === 'driver' ? 'driver' : 'client',
          client_segment: role === 'client' ? clientSegment : undefined,
          client_activity_note:
            role === 'client' && clientSegment === 'other'
              ? clientActivityNote.trim()
              : '',
          driver_machines: role === 'driver' ? driverMachines : undefined,
          driver_experience_years: role === 'driver' ? driverExperienceYears : undefined,
          driver_available: role === 'driver' ? true : undefined,
        });

        setIsLoading(false);
        toast.success(
          role === 'driver'
            ? lang === 'fr'
              ? 'Compte conducteur créé ! Bienvenue sur votre espace offres.'
              : 'تم إنشاء حساب السائق بنجاح! مرحباً بك في بوابة عروض العمل.'
            : role === 'client'
            ? lang === 'fr'
              ? 'Compte créé avec succès !'
              : 'تم إنشاء حسابك وحفظ معلوماتك بنجاح!'
            : lang === 'fr'
            ? 'Compte créé avec succès ! 72h d\'essai activées.'
            : 'تم إنشاء الحساب وتفعيل التجربة المجانية بنجاح!'
        );

        if (role === 'driver') {
          navigate('/driver');
        } else if (role === 'client') {
          setShowClientNextStepsModal(true);
        } else {
          setShowWelcomeModal(true);
        }
      } else {
        setIsLoading(false);
        toast.error(t(res.error || 'auth.signup_failed'));
      }
    }
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

          {/* Registration Role Selection: Owner vs Client vs Driver */}
          {mode === 'register' && (
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
                  className={`sm:col-span-2 p-3.5 rounded-2xl border text-start flex items-center justify-between gap-3 transition-all min-h-[82px] cursor-pointer ${
                    role === 'driver'
                      ? 'border-primary bg-amber-50/60 ring-2 ring-primary text-ink shadow-sm'
                      : 'border-steel-200 bg-white text-steel-700 hover:bg-steel-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-ink text-primary flex items-center justify-center font-black shrink-0">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-ink">
                          {t('auth.role_driver')}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700">
                          {lang === 'fr' ? '100% Gratuit' : 'حساب مجاني'}
                        </span>
                      </div>
                      <span className="text-[10px] text-steel-500 block mt-0.5 leading-snug">
                        {t('auth.role_driver_desc')}
                      </span>
                    </div>
                  </div>
                  {role === 'driver' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Client Category Checklist (قائمة cocher mobile-first) */}
          {mode === 'register' && role === 'client' && (
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

          {/* Form */}
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

              {mode === 'login' &&
                (() => {
                  const supportWa = (
                    platformSettingsStore.getSettings().whatsapp_number || ''
                  ).replace(/\D/g, '');
                  const forgotText =
                    lang === 'fr'
                      ? `Bonjour, j'ai oublié mon mot de passe JADIJCB pour le numéro: ${phone || '...'}`
                      : `السلام عليكم، نسيت كلمة المرور لحسابي في منصة JADIJCB المرتبط بالرقم: ${phone || '...'}`;
                  return (
                    <div className="mt-2 flex justify-end">
                      {supportWa.length >= 9 ? (
                        <a
                          href={`https://wa.me/${supportWa}?text=${encodeURIComponent(forgotText)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-primary-dark hover:underline"
                        >
                          {lang === 'fr'
                            ? 'Mot de passe oublié ? Contacter le support'
                            : 'نسيت كلمة المرور؟ تواصل مع الدعم لإعادة التعيين'}
                        </a>
                      ) : (
                        <a
                          href={`mailto:said.cpge24@gmail.com?subject=${encodeURIComponent(
                            'JADIJCB Password Reset'
                          )}&body=${encodeURIComponent(forgotText)}`}
                          className="text-[11px] font-bold text-primary-dark hover:underline"
                        >
                          {lang === 'fr'
                            ? 'Mot de passe oublié ? Contacter le support'
                            : 'نسيت كلمة المرور؟ تواصل مع الدعم لإعادة التعيين'}
                        </a>
                      )}
                    </div>
                  );
                })()}
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

          {/* Super Admin Quick Portal Link */}
          <div className="mt-5 pt-4 border-t border-steel-100 text-center">
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-steel-500 hover:text-ink transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary-dark" />
              <span>
                {lang === 'fr'
                  ? 'Accès Super Admin (Direction)'
                  : 'بوابة المشرف العام (Super Admin) ←'}
              </span>
            </Link>
          </div>
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
    </div>
  );
};

export default AuthPage;
