// ============================================================================
// JADIJCB: User Profile Settings Modal (تعديل معلوماتي الشخصية)
// Works for both Equipment Owners (/owner) and Contractors (/entreprise)
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
  Check,
  X,
  ShieldCheck,
  Truck,
  HardHat,
  Sparkles,
  Save,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { MOROCCAN_CITIES } from '../../data/cities';
import { supabase } from '../../lib/supabase';
import { normalizeMoroccanPhone } from '../../lib/authHelpers';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, lang, isRTL } = useLanguage();
  const { profile, updateProfile, refreshProfile, user } = useAuth();

  const isContractor = profile?.role === 'client' || profile?.role === 'contractor';

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
      setFullName(profile.full_name || '');
      setCompanyName(profile.company_name || '');
      // Match city to city options
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

    if (!companyName.trim()) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez saisir le nom de votre entreprise'
          : 'يرجى إدخال اسم الشركة أو المقاولة'
      );
      return;
    }

    const cityName = MOROCCAN_CITIES.find((c) => c.id === cityId)?.name_ar || cityId;

    setIsSubmitting(true);

    try {
      // 1. Update personal & business profile details
      const updatePayload: any = {
        full_name: fullName.trim(),
        company_name: companyName.trim(),
        city: cityName,
        ice_number: iceNumber.trim(),
        whatsapp_verified: true,
      };

      if (phone.trim()) {
        const norm = normalizeMoroccanPhone(phone.trim());
        if (norm.isValid) {
          updatePayload.phone = norm.e164;
        }
      }

      const res = await updateProfile(updatePayload);

      // 2. Optionally update password if provided
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
    } catch (err: any) {
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
              {isContractor ? <HardHat className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="profile-settings-title" className="text-base sm:text-lg font-black text-white">
                  {lang === 'fr' ? 'Modifier mes informations personnelles' : 'تعديل معلوماتي الشخصية'}
                </h2>
                <Badge variant={isContractor ? 'info' : 'warning'} className="text-[10px] font-bold">
                  {isContractor
                    ? lang === 'fr'
                      ? 'Entreprise BTP'
                      : 'مقاولة معتمدة'
                    : lang === 'fr'
                    ? 'Propriétaire d\'engins'
                    : 'مالك آليات'}
                </Badge>
              </div>
              <p className="text-[11px] text-steel-400 mt-0.5">
                {lang === 'fr'
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Full Name & Company Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary-dark" />
                <span>{lang === 'fr' ? 'Nom complet du responsable' : 'الاسم الكامل للمسؤول'}</span>
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

            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary-dark" />
                <span>{lang === 'fr' ? 'Nom de la société / مقاولة' : 'اسم الشركة أو المقاولة'}</span>
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
          </div>

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

          {/* ICE Number */}
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
