import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Save,
  MapPin,
  Phone,
  FileCheck,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { CURRENT_USER } from '../data/mockData';
import { MOROCCAN_CITIES } from '../data/cities';

export const StorefrontPage: React.FC = () => {
  const { t, lang } = useLanguage();

  const [companyName, setCompanyName] = useState(CURRENT_USER.company_name || '');
  const [phone, setPhone] = useState(CURRENT_USER.phone);
  const [email, setEmail] = useState(CURRENT_USER.email);
  const [cityId, setCityId] = useState(CURRENT_USER.city_id);
  const [iceNumber, setIceNumber] = useState(CURRENT_USER.ice_number || '');
  const [rcNumber, setRcNumber] = useState(CURRENT_USER.rc_number || '');
  const [address, setAddress] = useState(CURRENT_USER.address || '');
  const [about, setAbout] = useState(
    'شركة متخصصة في كراء آليات الحفر والأشغال الكبرى بالمغرب منذ عام 2018، نوفر أسطولاً حديثاً من جرافات JCB وحفارات CAT مع سائقين معتمدين وتأمين شامل على جميع أوراش العمل.'
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    setTimeout(() => {
      setIsSaving(false);
      toast.success(
        lang === 'fr'
          ? 'Profil entreprise et documents mis à jour avec succès'
          : 'تم تحديث الملف التعريفي والوثائق القانونية بنجاح'
      );
    }, 500);
  };

  return (
    <div className="space-y-6 text-start max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
          {t('storefront.title')}
        </h1>
        <p className="text-xs text-steel-500 mt-1">
          {t('storefront.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Verification Status Card */}
        <Card className="p-6 bg-emerald-50/50 border border-emerald-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-success text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink">
                  {lang === 'fr'
                    ? 'Entreprise vérifiée & Homologuée JADIJCB'
                    : 'شركة معتمدة وموثقة رسمياً في JADIJCB'}
                </h3>
                <Badge variant="success" size="sm">
                  {lang === 'fr' ? 'Vérifié' : 'موثق'}
                </Badge>
              </div>
              <p className="text-xs text-steel-600 mt-1 leading-relaxed">
                {t('storefront.ice_verified')}
              </p>
            </div>
          </div>
        </Card>

        {/* Company Legal Information */}
        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-steel-500">
            {lang === 'fr' ? 'Informations juridiques & Fiscales' : 'البيانات القانونية والجبائية'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('auth.company_name')}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
            <Input
              label={t('auth.ice')}
              value={iceNumber}
              onChange={(e) => setIceNumber(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Registre de Commerce (RC)"
              placeholder="Casablanca 439211"
              value={rcNumber}
              onChange={(e) => setRcNumber(e.target.value)}
            />
            <Select
              label={t('auth.city')}
              options={MOROCCAN_CITIES.map((c) => ({
                value: c.id,
                label: lang === 'fr' ? c.name_fr : c.name_ar,
              }))}
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
            />
          </div>

          <Input
            label={lang === 'fr' ? 'Siège social / Adresse' : 'المقر الاجتماعي / العنوان'}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Card>

        {/* Contact Information */}
        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-steel-500">
            {lang === 'fr' ? 'Coordonnées de contact' : 'معلومات الاتصال المباشر'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="tel"
              label={t('auth.phone')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              required
            />
            <Input
              type="email"
              label={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-steel-700 block mb-1.5">
              {t('storefront.about_company')}
            </label>
            <textarea
              rows={4}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="w-full bg-white border border-steel-300 rounded-xl p-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </Card>

        {/* Save CTA */}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
            className="font-bold min-w-[200px]"
          >
            {t('storefront.save_changes')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default StorefrontPage;
