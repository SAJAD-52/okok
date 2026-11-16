// ============================================================================
// JADIJCB: User Profile Settings Modal (تعديل معلوماتي الشخصية)
// Works for both Equipment Owners (/owner) and All Clients (/entreprise)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  User,
  Building2,
  MapPin,
  Phone,
  FileCheck,
  Lock,
  Eye,
  EyeOff,
  X,
  Truck,
  Save,
  CheckSquare,
  Square,
  Tractor,
  Wrench,
  Handshake,
  Landmark,
  Briefcase,
  Users,
  HardHat,
  Award,
} from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { toast } from '../ui/Toast';
import { DriverMachineChecklist } from '../driver/DriverMachineChecklist';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { MOROCCAN_CITIES } from '../../data/cities';
import { CLIENT_SEGMENTS, getClientSegmentOption } from '../../data/clientSegments';
import { DRIVER_EXPERIENCE_LEVELS } from '../../data/driverMachines';
import { ClientSegment } from '../../types/database';
import { supabase } from '../../lib/supabase';
import { normalizeMoroccanPhone } from '../../lib/authHelpers';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEGMENT_ICONS: Record<ClientSegment, React.ReactNode> = {
  company: <Building2 className="w-3.5 h-3.5 shrink-0" />,
  farmer: <Tractor className="w-3.5 h-3.5 shrink-0" />,
  artisan: <Wrench className="w-3.5 h-3.5 shrink-0" />,
  individual: <User className="w-3.5 h-3.5 shrink-0" />,
  cooperative: <Handshake className="w-3.5 h-3.5 shrink-0" />,
  developer: <Landmark className="w-3.5 h-3.5 shrink-0" />,
  other: <Briefcase className="w-3.5 h-3.5 shrink-0" />,
};

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, lang } = useLanguage();
  const { profile, updateProfile, refreshProfile } = useAuth();

  const isClient = profile?.role === 'client' || profile?.role === 'contractor';
  const isDriver = profile?.role === 'driver';

  const [clientSegment, setClientSegment] = useState<ClientSegment>('company');
  const [clientActivityNote, setClientActivityNote] = useState('');
  const [driverMachines, setDriverMachines] = useState<string[]>([]);
  const [driverExperienceYears, setDriverExperienceYears] = useState('3_5');
  const [driverAvailable, setDriverAvailable] = useState(true);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cityId, setCityId] = useState('casablanca');
  const [phone, setPhone] = useState('');
  const [iceNumber, setIceNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever modal opens or profile changes
  useEffect(() => {
    if (isOpen && profile) {
      setClientSegment(profile.client_segment || (profile.company_name ? 'company' : 'individual'));
      setClientActivityNote(profile.client_activity_note || '');
      setDriverMachines(Array.isArray(profile.driver_machines) ? profile.driver_machines : []);
      setDriverExperienceYears(profile.driver_experience_years || '3_5');
      setDriverAvailable(profile.driver_available ?? true);
      setFullName(profile.full_name || '');
      setCompanyName(profile.company_name || '');
      const matchedCity = MOROCCAN_CITIES.find(
        (c) => c.id === profile.city || c.name_ar === profile.city || c.name_fr === profile.city
      );
      setCityId(matchedCity?.id || 'casablanca');
      setPhone(profile.phone || '');
      setIceNumber(profile.ice_number || '');
      setNewPassword('');
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const isClientCompany = isClient && clientSegment === 'company';
  const currentSegmentMeta = getClientSegmentOption(clientSegment);

  const cityOptions = MOROCCAN_CITIES.map((c) => ({
    value: c.id,
    label: lang === 'fr' ? c.name_fr : c.name_ar,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error(lang === 'fr' ? 'Veuillez saisir votre nom complet' : 'يرجى إدخال الاسم الكامل');
      return;
    }

    if (!isDriver && (!isClient || isClientCompany) && !companyName.trim()) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez saisir le nom de votre entreprise'
          : 'يرجى إدخال اسم الشركة أو المقاولة'
      );
      return;
    }

    if (isDriver && driverMachines.length === 0) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez sélectionner au moins un engin maîtrisé'
          : 'يرجى اختيار آلية واحدة على الأقل'
      );
      return;
    }

    const cityName = MOROCCAN_CITIES.find((c) => c.id === cityId)?.name_ar || cityId;
    const finalCompanyName =
      !isDriver && (!isClient || isClientCompany) ? companyName.trim() : '';

    setIsSubmitting(true);

    try {
      const updatePayload: any = {
        full_name: fullName.trim(),
        company_name: finalCompanyName,
        city: cityName,
        client_segment: isClient ? clientSegment : undefined,
        client_activity_note:
          isClient && clientSegment === 'other' ? clientActivityNote.trim() : '',
        driver_machines: isDriver ? driverMachines : undefined,
        driver_experience_years: isDriver ? driverExperienceYears : undefined,
        driver_available: isDriver ? driverAvailable : undefined,
        ice_number: !isClient && !isDriver ? iceNumber.trim() : '',
        whatsapp_verified: true,
      };

      if (phone.trim()) {
        const norm = normalizeMoroccanPhone(phone.trim());
        if (norm.isValid) {
          updatePayload.phone = norm.e164;
        }
      }

      const res = await updateProfile(updatePayload);

      if (newPassword.trim()) {
        if (newPassword.trim().length < 8) {
          toast.error(
            lang === 'fr'
              ? 'Le mot de passe doit comporter au moins 8 caractères'
              : 'كلمة المرور يجب أن لا تقل عن 8 أحرف'
          );
          setIsSubmitting(false);
          return;
        }

        const { error: passError } = await supabase.auth.updateUser({
          password: newPassword.trim(),
        });

        if (passError) {
          toast.error(
            lang === 'fr'
              ? 'Impossible de mettre à jour le mot de passe'
              : 'تعذر تغيير كلمة المرور: ' + passError.message
          );
        } else {
          toast.success(
            lang === 'fr' ? 'Mot de passe mis à jour !' : 'تم تغيير كلمة المرور بنجاح!'
          );
        }
      }

      await refreshProfile();
      setIsSubmitting(false);

      if (res.success) {
        toast.success(
          lang === 'fr'
            ? 'Informations personnelles mises à jour avec succès !'
            : 'تم حفظ وتحديث معلوماتك الشخصية بنجاح!'
        );
        onClose();
      } else {
        toast.error(res.error || (lang === 'fr' ? 'Erreur lors de la mise à jour' : 'حدث خطأ أثناء الحفظ'));
      }
    } catch {
      setIsSubmitting(false);
      toast.error(lang === 'fr' ? 'Erreur imprévue' : 'حدث خطأ غير متوقع');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative bg-white border border-steel-200 rounded-3xl max-w-xl w-full shadow-2xl my-6 overflow-hidden text-start">
        {/* Header */}
        <div className="bg-ink p-5 sm:p-6 text-white border-b-2 border-primary flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary text-ink flex items-center justify-center font-black shrink-0">
              {isDriver ? (
                <HardHat className="w-5 h-5" />
              ) : isClient ? (
                <Users className="w-5 h-5" />
              ) : (
                <Truck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="profile-settings-title" className="text-base sm:text-lg font-black text-white">
                  {lang === 'fr' ? 'Modifier mes informations personnelles' : 'تعديل معلوماتي الشخصية'}
                </h2>
                <Badge variant={isDriver ? 'success' : isClient ? 'info' : 'warning'} className="text-[10px] font-bold">
                  {isDriver
                    ? lang === 'fr'
                      ? 'Conducteur d’engins'
                      : 'سائق آليات'
                    : isClient
                    ? lang === 'fr'
                      ? currentSegmentMeta.labelFr
                      : currentSegmentMeta.labelAr
                    : lang === 'fr'
                    ? 'Propriétaire d\'engins'
                    : 'مالك آليات'}
                </Badge>
              </div>
              <p className="text-[11px] text-steel-400 mt-0.5">
                {isDriver
                  ? lang === 'fr'
                    ? 'Gérez votre nom, ville, expérience et engins maîtrisés'
                    : 'تحديث اسمك، مدينتك، سنوات الخبرة والآليات التي تحترفها'
                  : isClient
                  ? lang === 'fr'
                    ? 'Gérez votre catégorie, nom, ville et numéro de contact'
                    : 'تحديث فئة نشاطك، اسمك، مدينتك ورقم الهاتف'
                  : lang === 'fr'
                  ? 'Gérez votre nom, entreprise, ville, téléphone et identifiant fiscal'
                  : 'تحديث اسمك، شركتك، مدينتك، أرقام التواصل ورقم الـ ICE'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-steel-800 text-steel-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Client Segment Checklist */}
          {isClient && (
            <div className="p-3 rounded-2xl bg-steel-50 border border-steel-200 space-y-2">
              <label className="text-xs font-black text-ink block">
                {lang === 'fr' ? 'Catégorie de client' : 'فئة الزبون'}
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
                      className={`p-2 rounded-xl border text-start transition-all min-h-[44px] flex items-center gap-2 cursor-pointer ${
                        seg.id === 'other' ? 'col-span-2' : ''
                      } ${
                        isChecked
                          ? 'bg-white border-primary ring-2 ring-primary/35 text-ink'
                          : 'bg-white/75 border-steel-200 text-steel-700 hover:bg-white'
                      }`}
                    >
                      <span className={isChecked ? 'text-primary-dark' : 'text-steel-400'}>
                        {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </span>
                      <span className={isChecked ? 'text-primary-dark' : 'text-steel-500'}>
                        {SEGMENT_ICONS[seg.id]}
                      </span>
                      <span className="text-xs font-black text-ink truncate">
                        {lang === 'fr' ? seg.labelFr : seg.labelAr}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full Name & Optional Company Name */}
          <div className={`grid grid-cols-1 ${!isDriver && (!isClient || isClientCompany) ? 'sm:grid-cols-2' : ''} gap-3.5`}>
            {!isDriver && (!isClient || isClientCompany) && (
              <div>
                <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary-dark" />
                  <span>{lang === 'fr' ? 'Nom de la société / المقاولة' : 'اسم الشركة أو المقاولة'}</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={lang === 'fr' ? 'ex. Atlas Terrassement S.A.R.L.' : 'مثال: مقاولة أطلس للبناء والأشغال'}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary-dark" />
                <span>
                  {isDriver || (isClient && !isClientCompany)
                    ? lang === 'fr'
                      ? 'Nom complet'
                      : 'الاسم الكامل'
                    : lang === 'fr'
                    ? 'Nom du propriétaire / gérant'
                    : 'اسم المالك أو المسؤول'}
                </span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={lang === 'fr' ? 'ex. Karim Benjelloun' : 'مثال: كريم بنجلون'}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
              />
            </div>
          </div>

          {isClient && clientSegment === 'other' && (
            <Input
              label={lang === 'fr' ? 'Précision sur votre activité (optionnel)' : 'توضيح النشاط (اختياري)'}
              value={clientActivityNote}
              onChange={(e) => setClientActivityNote(e.target.value)}
              placeholder={lang === 'fr' ? 'ex. Forage, aménagement terrain...' : 'مثال: حفر بئر، تهيئة أرض...'}
            />
          )}

          {/* City & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary-dark" />
                <span>{lang === 'fr' ? 'Ville principale' : 'المدينة الرئيسية'}</span>
              </label>
              <Select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                options={cityOptions}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-primary-dark" />
                <span>{lang === 'fr' ? 'Numéro de téléphone' : 'رقم الهاتف المغربي'}</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+2126XXXXXXXX"
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
              />
            </div>
          </div>

          {/* Driver Specific Fields: Experience + Mastered Machines */}
          {isDriver && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-primary-dark" />
                    <span>{lang === 'fr' ? 'Années d’expérience' : 'سنوات التجربة'}</span>
                  </label>
                  <Select
                    value={driverExperienceYears}
                    onChange={(e) => setDriverExperienceYears(e.target.value)}
                    options={DRIVER_EXPERIENCE_LEVELS.map((exp) => ({
                      value: exp.id,
                      label: lang === 'fr' ? exp.labelFr : exp.labelAr,
                    }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-steel-700 block mb-1.5">
                    {lang === 'fr' ? 'Disponibilité' : 'حالة التوفر للعمل'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setDriverAvailable((prev) => !prev)}
                    className={`w-full min-h-[42px] px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      driverAvailable
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-steel-100 border-steel-300 text-steel-700'
                    }`}
                  >
                    {driverAvailable
                      ? lang === 'fr'
                        ? 'Disponible pour travailler'
                        : 'متاح للعمل الآن'
                      : lang === 'fr'
                      ? 'Actuellement occupé'
                      : 'مشغول حالياً'}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-steel-50 border border-steel-200 space-y-2">
                <label className="text-xs font-black text-ink block">
                  {lang === 'fr' ? 'Engins que vous maîtrisez *' : 'الآليات التي تحترف قيادتها *'}
                </label>
                <DriverMachineChecklist
                  selectedIds={driverMachines}
                  onChange={setDriverMachines}
                  compact
                />
              </div>
            </div>
          )}

          {/* ICE Tax Field ONLY for machinery owners, NOT for clients or drivers */}
          {!isClient && !isDriver && (
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-primary-dark" />
                <span>{lang === 'fr' ? 'Identifiant Commun de l\'Entreprise (ICE)' : 'رقم التعريف الموحد للمقاولة (ICE)'}</span>
              </label>
              <input
                type="text"
                value={iceNumber}
                onChange={(e) => setIceNumber(e.target.value)}
                placeholder="001928471000085"
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 font-mono text-xs font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
              />
              <span className="text-[10px] text-steel-400 mt-1 block">
                {lang === 'fr'
                  ? '15 chiffres figurant sur votre modèle J ou attestation fiscale'
                  : '15 رقماً مسجلة بالسجل التجاري المغربي وشهادة الـ ICE'}
              </span>
            </div>
          )}

          {/* Password Change Option */}
          <div className="pt-3 border-t border-steel-200">
            <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-primary-dark" />
              <span>{lang === 'fr' ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'تغيير كلمة المرور (اتركه فارغاً إن لم ترغب في التغيير)'}</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={lang === 'fr' ? 'Min. 8 caractères' : '8 أحرف على الأقل'}
                className="w-full px-3.5 py-2.5 pe-10 rounded-xl border border-steel-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-2.5 text-steel-400 hover:text-ink cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-steel-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-bold"
            >
              {t('common.cancel')}
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              leftIcon={<Save className="w-4 h-4" />}
              className="font-black text-xs px-5 shadow-md"
            >
              {isSubmitting
                ? lang === 'fr'
                  ? 'Enregistrement...'
                  : 'جاري الحفظ...'
                : lang === 'fr'
                ? 'Enregistrer les modifications'
                : 'حفظ التعديلات'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
