import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Square,
  Building2,
  Tractor,
  Wrench,
  User,
  Handshake,
  Landmark,
  Briefcase,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { Logo } from '../components/ui/Logo';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { ClientNextStepsModal } from '../components/auth/ClientNextStepsModal';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { MOROCCAN_CITIES } from '../data/cities';
import { CLIENT_SEGMENTS } from '../data/clientSegments';
import { ClientSegment } from '../types/database';
import { generateUniqueStorefrontSlug } from '../lib/storefrontSlug';

const SEGMENT_ICONS: Record<ClientSegment, React.ReactNode> = {
  company: <Building2 className="w-4 h-4 shrink-0" />,
  farmer: <Tractor className="w-4 h-4 shrink-0" />,
  artisan: <Wrench className="w-4 h-4 shrink-0" />,
  individual: <User className="w-4 h-4 shrink-0" />,
  cooperative: <Handshake className="w-4 h-4 shrink-0" />,
  developer: <Landmark className="w-4 h-4 shrink-0" />,
  other: <Briefcase className="w-4 h-4 shrink-0" />,
};

export const OnboardingPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();

  const isClient = profile?.role === 'client' || profile?.role === 'contractor';

  const [clientSegment, setClientSegment] = useState<ClientSegment>(
    profile?.client_segment || 'company'
  );
  const [clientActivityNote, setClientActivityNote] = useState(
    profile?.client_activity_note || ''
  );
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [cityId, setCityId] = useState(profile?.city || 'casablanca');
  const [whatsappPhone, setWhatsappPhone] = useState(profile?.phone || '');
  const [iceNumber, setIceNumber] = useState(profile?.ice_number || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClientNextStepsModal, setShowClientNextStepsModal] = useState(false);

  React.useEffect(() => {
    if (profile) {
      if (profile.client_segment) setClientSegment(profile.client_segment);
      if (profile.client_activity_note && !clientActivityNote) {
        setClientActivityNote(profile.client_activity_note);
      }
      if (profile.full_name && !fullName) setFullName(profile.full_name);
      if (profile.company_name && !companyName) setCompanyName(profile.company_name);
      if (profile.phone && !whatsappPhone) setWhatsappPhone(profile.phone);
      if (profile.ice_number && !iceNumber) setIceNumber(profile.ice_number);
      if (profile.city) {
        const found = MOROCCAN_CITIES.find(
          (c) =>
            c.id === profile.city ||
            c.name_ar === profile.city ||
            c.name_fr === profile.city
        );
        if (found) setCityId(found.id);
      }
    }
  }, [profile]);

  const isClientCompany = isClient && clientSegment === 'company';

  const cityOptions = MOROCCAN_CITIES.map((c) => ({
    value: c.id,
    label: lang === 'fr' ? c.name_fr : c.name_ar,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isClient && isClientCompany && !companyName.trim()) {
      toast.error(lang === 'fr' ? 'Veuillez saisir le nom de la société' : 'يرجى إدخال اسم المقاولة');
      return;
    }

    setIsSubmitting(true);

    const cityName = MOROCCAN_CITIES.find((c) => c.id === cityId)?.name_ar || cityId;
    const finalCompanyName =
      !isClient || isClientCompany ? companyName.trim() : '';

    try {
      await updateProfile({
        full_name: fullName.trim(),
        company_name: finalCompanyName,
        city: cityName,
        client_segment: isClient ? clientSegment : undefined,
        client_activity_note:
          isClient && clientSegment === 'other' ? clientActivityNote.trim() : '',
        ice_number: !isClient ? iceNumber.trim() : '',
        whatsapp_verified: Boolean(whatsappPhone),
        onboarding_completed: true,
      });

      if (!isClient) {
        const existingSlug = localStorage.getItem('jadijcb_owner_storefront_slug');
        if (!existingSlug) {
          const newSlug = generateUniqueStorefrontSlug(
            finalCompanyName || fullName.trim()
          );
          localStorage.setItem('jadijcb_owner_storefront_slug', newSlug);
        }
      }
    } catch (err) {
      console.warn('Onboarding save notice:', err);
    }

    setIsSubmitting(false);

    if (isClient) {
      toast.success(
        lang === 'fr' ? 'Vos informations ont été enregistrées !' : 'تم حفظ بياناتك بنجاح!'
      );
      setShowClientNextStepsModal(true);
    } else {
      toast.success(t('onboarding.success_toast'));
      navigate('/owner');
    }
  };

  const handleSkip = async () => {
    await updateProfile({ onboarding_completed: true });
    navigate(isClient ? '/entreprise' : '/owner');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      {/* Top Header */}
      <header className="h-16 border-b border-steel-200 bg-white px-4 sm:px-6 flex items-center justify-between">
        <Logo size="md" />
        <LanguageSwitcher />
      </header>

      {/* Main Content Card */}
      <main className="max-w-xl mx-auto w-full px-4 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        <Card className="p-5 sm:p-8 bg-white border border-steel-200 shadow-elevated rounded-3xl text-start">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mb-6">
            <span className="w-8 h-8 rounded-full bg-primary text-ink font-extrabold text-xs flex items-center justify-center">
              1
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-primary" />
            <span className="w-8 h-8 rounded-full bg-steel-100 text-steel-400 font-bold text-xs flex items-center justify-center">
              2
            </span>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 text-primary-dark font-extrabold text-xs uppercase mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Configuration initiale' : 'إعداد الحساب'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
              {isClient
                ? lang === 'fr'
                  ? 'Compléter vos informations personnelles'
                  : 'إكمال بيانات حساب الزبون'
                : t('onboarding.title')}
            </h1>
            <p className="text-xs text-steel-600 mt-1 leading-relaxed">
              {isClient
                ? lang === 'fr'
                  ? 'Sélectionnez votre profil (entreprise, agriculteur, artisan, particulier...) pour adapter les suggestions d\'engins.'
                  : 'حدد فئة نشاطك ومعلوماتك العامة للبدء مباشرة بدون أي تعقيدات أو معلومات ضريبية.'
                : t('onboarding.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client Segment Checklist */}
            {isClient && (
              <div className="p-3.5 rounded-2xl bg-steel-50 border border-steel-200 space-y-2.5">
                <label className="text-xs font-black text-ink block">
                  {lang === 'fr' ? 'Votre catégorie *' : 'اختر فئة حسابك *'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CLIENT_SEGMENTS.map((seg) => {
                    const isChecked = clientSegment === seg.id;
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        onClick={() => setClientSegment(seg.id)}
                        className={`p-2.5 rounded-xl border text-start transition-all min-h-[52px] flex items-start gap-2 cursor-pointer ${
                          seg.id === 'other' ? 'col-span-2' : ''
                        } ${
                          isChecked
                            ? 'bg-white border-primary ring-2 ring-primary/40 text-ink shadow-xs'
                            : 'bg-white/75 border-steel-200 text-steel-700 hover:bg-white'
                        }`}
                      >
                        <span className={`mt-0.5 shrink-0 ${isChecked ? 'text-primary-dark' : 'text-steel-400'}`}>
                          {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
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
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conditional Company + Owner Name vs General Name */}
            {isClient ? (
              isClientCompany ? (
                <>
                  <Input
                    label={lang === 'fr' ? 'Nom de l\'entreprise / المقاولة *' : 'اسم المقاولة *'}
                    placeholder={lang === 'fr' ? 'ex. Atlas BTP S.A.R.L.' : 'مثال: مقاولة أطلس للأشغال'}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                  <Input
                    label={lang === 'fr' ? 'Nom du propriétaire / gérant *' : 'اسم المالك / المسؤول *'}
                    placeholder={t('onboarding.full_name_placeholder')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </>
              ) : (
                <>
                  <Input
                    label={lang === 'fr' ? 'Nom complet *' : 'الاسم الكامل *'}
                    placeholder={t('onboarding.full_name_placeholder')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                  {clientSegment === 'other' && (
                    <Input
                      label={lang === 'fr' ? 'Précision sur votre activité (optionnel)' : 'توضيح النشاط (اختياري)'}
                      placeholder={lang === 'fr' ? 'ex. Forage, aménagement...' : 'مثال: حفر، تسوية أرض...'}
                      value={clientActivityNote}
                      onChange={(e) => setClientActivityNote(e.target.value)}
                    />
                  )}
                </>
              )
            ) : (
              <>
                <Input
                  label={t('onboarding.full_name_label')}
                  placeholder={t('onboarding.full_name_placeholder')}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <Input
                  label={t('onboarding.company_label')}
                  placeholder={t('onboarding.company_placeholder')}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label={
                  isClient
                    ? lang === 'fr'
                      ? 'Ville / Région principale'
                      : 'المدينة الرئيسية'
                    : t('onboarding.city_label')
                }
                options={cityOptions}
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
              />

              <Input
                label={t('onboarding.whatsapp_label')}
                placeholder={t('onboarding.whatsapp_placeholder')}
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                dir="ltr"
              />
            </div>

            {/* ICE Tax field ONLY for machinery owners, NEVER for clients */}
            {!isClient && (
              <Input
                label={t('onboarding.ice_label')}
                placeholder={t('onboarding.ice_placeholder')}
                value={iceNumber}
                onChange={(e) => setIceNumber(e.target.value)}
                hint={t('onboarding.ice_hint')}
              />
            )}

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1 justify-center font-black min-h-[48px]"
                isLoading={isSubmitting}
                rightIcon={
                  isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />
                }
              >
                {t('onboarding.save_btn')}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={handleSkip}
                className="text-steel-600 hover:text-ink text-xs min-h-[48px]"
              >
                {t('onboarding.skip_btn')}
              </Button>
            </div>
          </form>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-steel-400 border-t border-steel-200">
        JADIJCB Maroc © {new Date().getFullYear()} · Tous droits réservés
      </footer>

      <ClientNextStepsModal
        isOpen={showClientNextStepsModal}
        onClose={() => setShowClientNextStepsModal(false)}
      />
    </div>
  );
};

export default OnboardingPage;
