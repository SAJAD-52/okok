import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  UserCheck,
  MapPin,
  Phone,
  FileCheck,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Truck,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { Logo } from '../components/ui/Logo';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { MOROCCAN_CITIES } from '../data/cities';
import { generateUniqueStorefrontSlug } from '../lib/storefrontSlug';

export const OnboardingPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [cityId, setCityId] = useState(profile?.city || 'casablanca');
  const [whatsappPhone, setWhatsappPhone] = useState(profile?.phone || '');
  const [iceNumber, setIceNumber] = useState(profile?.ice_number || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (profile) {
      if (profile.full_name && !fullName) setFullName(profile.full_name);
      if (profile.company_name && !companyName) setCompanyName(profile.company_name);
      if (profile.phone && !whatsappPhone) setWhatsappPhone(profile.phone);
      if (profile.ice_number && !iceNumber) setIceNumber(profile.ice_number);
      if (profile.city) {
        const found = MOROCCAN_CITIES.find(
          (c) => c.id === profile.city || c.name_ar === profile.city || c.name_fr === profile.city
        );
        if (found) setCityId(found.id);
      }
    }
  }, [profile]);

  const cityOptions = MOROCCAN_CITIES.map((c) => ({
    value: c.id,
    label: lang === 'fr' ? c.name_fr : c.name_ar,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const cityName = MOROCCAN_CITIES.find((c) => c.id === cityId)?.name_ar || cityId;

    const res = await updateProfile({
      full_name: fullName.trim(),
      company_name: companyName.trim(),
      city: cityName,
      ice_number: iceNumber.trim(),
      whatsapp_verified: Boolean(whatsappPhone),
      onboarding_completed: true,
    });

    // Ensure unique storefront slug is generated for this owner
    try {
      const existingSlug = localStorage.getItem('jadijcb_owner_storefront_slug');
      if (!existingSlug) {
        const newSlug = generateUniqueStorefrontSlug(companyName.trim() || fullName.trim());
        localStorage.setItem('jadijcb_owner_storefront_slug', newSlug);
      }
    } catch {
      // Ignore
    }

    setIsSubmitting(false);

    const targetRoute = profile?.role === 'client' || profile?.role === 'contractor' ? '/entreprise' : '/owner';
    toast.success(t('onboarding.success_toast'));
    navigate(targetRoute);
  };

  const handleSkip = async () => {
    await updateProfile({ onboarding_completed: true });
    const targetRoute = profile?.role === 'client' || profile?.role === 'contractor' ? '/entreprise' : '/owner';
    navigate(targetRoute);
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
        <Card className="p-6 sm:p-8 bg-white border border-steel-200 shadow-elevated rounded-3xl text-start">
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
              {t('onboarding.title')}
            </h1>
            <p className="text-xs text-steel-600 mt-1 leading-relaxed">
              {t('onboarding.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label={t('onboarding.city_label')}
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

            <Input
              label={t('onboarding.ice_label')}
              placeholder={t('onboarding.ice_placeholder')}
              value={iceNumber}
              onChange={(e) => setIceNumber(e.target.value)}
              hint={t('onboarding.ice_hint')}
            />

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
    </div>
  );
};

export default OnboardingPage;
