// ============================================================================
// JADIJCB: Professional Heavy Machinery Driver Dashboard (/driver)
// Displays driver availability toggle, mastered machines & experience summary,
// mobile alert readiness, and quick jump to /driver/joboffer urgent offers.
// ============================================================================

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Bell,
  CheckCircle2,
  MapPin,
  Award,
  Wrench,
  ArrowLeft,
  ArrowRight,
  Clock,
  Volume2,
  UserCheck,
  PauseCircle,
  Edit3,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { toast } from '../components/ui/Toast';
import { ProfileSettingsModal } from '../components/profile/ProfileSettingsModal';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { DriverJobOffer } from '../types/database';
import {
  getDriverExperienceOption,
  getDriverMachineOption,
} from '../data/driverMachines';
import {
  fetchDriverJobOffers,
  subscribeDriverJobOffers,
} from '../lib/driverOfferService';
import { registerOwnerPushNotifications } from '../lib/pushService';
import {
  playOpportunitySound,
  showBrowserOpportunityNotification,
  unlockAudioContextNow,
} from '../lib/opportunityAudio';

export const DriverDashboardPage: React.FC = () => {
  const { lang, isRTL } = useLanguage();
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [offers, setOffers] = useState<DriverJobOffer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [isTogglingAvail, setIsTogglingAvail] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default'
  );

  const driverMachines = useMemo(
    () => (Array.isArray(profile?.driver_machines) ? profile.driver_machines : []),
    [profile?.driver_machines]
  );

  const loadOffers = useCallback(async () => {
    try {
      const list = await fetchDriverJobOffers(profile?.id || user?.id);
      setOffers(list);
    } finally {
      setIsLoadingOffers(false);
    }
  }, [profile?.id, user?.id]);

  useEffect(() => {
    loadOffers();
    const unsub = subscribeDriverJobOffers(driverMachines, () => {
      loadOffers();
    });
    return unsub;
  }, [loadOffers, driverMachines]);

  const isAvailable = profile?.driver_available ?? true;
  const experienceMeta = getDriverExperienceOption(profile?.driver_experience_years);

  const matchingOffers = useMemo(() => {
    if (driverMachines.length === 0) return offers;
    return offers.filter((o) => driverMachines.includes(o.machine_category));
  }, [offers, driverMachines]);

  const urgentOffersCount = useMemo(
    () => offers.filter((o) => o.is_urgent).length,
    [offers]
  );

  const appliedOffersCount = useMemo(
    () => offers.filter((o) => o.has_applied).length,
    [offers]
  );

  const previewOffers = useMemo(() => {
    const prioritized = [...matchingOffers];
    for (const o of offers) {
      if (!prioritized.some((p) => p.id === o.id)) prioritized.push(o);
    }
    return prioritized.slice(0, 3);
  }, [matchingOffers, offers]);

  const handleToggleAvailability = async () => {
    setIsTogglingAvail(true);
    const nextState = !isAvailable;
    await updateProfile({ driver_available: nextState });
    setIsTogglingAvail(false);
    toast.success(
      nextState
        ? lang === 'fr'
          ? 'Statut mis à jour : Disponible pour travailler'
          : 'أنت الآن متاح لاستقبال عروض العمل العاجلة من الملاك'
        : lang === 'fr'
        ? 'Statut mis à jour : Actuellement en mission'
        : 'تم ضبط حالتك إلى: مشغول حالياً في ورش'
    );
  };

  const handleEnableNotifications = async () => {
    unlockAudioContextNow();
    const uid = profile?.id || user?.id || '';
    const perm = await registerOwnerPushNotifications(uid, 'driver', driverMachines);
    setNotifPerm(perm);
    if (perm === 'granted') {
      playOpportunitySound();
      showBrowserOpportunityNotification({
        title:
          lang === 'fr'
            ? 'Alertes Conducteur activées'
            : 'تم تفعيل تنبيهات السائق على هاتفك',
        body:
          lang === 'fr'
            ? 'Vous recevrez les offres urgentes des propriétaires avec tarif et durée.'
            : 'ستصلك إشعارات عروض العمل العاجلة من ملاك الآليات مع نوع الآلية والثمن والمدة.',
        tag: 'jadijcb-driver-ready',
        url: '/driver/joboffer',
      }).catch(() => {});
      toast.success(
        lang === 'fr'
          ? 'Alertes mobiles activées avec succès !'
          : 'تم تفعيل إشعارات وصوت تنبيه عروض العمل على هاتفك!'
      );
    } else if (perm === 'denied') {
      toast.error(
        lang === 'fr'
          ? 'Notifications bloquées par le navigateur.'
          : 'المتصفح حظر الإشعارات؛ يرجى السماح بها من إعدادات الموقع.'
      );
    }
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-6 text-start">
      {/* Top Hero & Availability Strip */}
      <Card className="p-5 sm:p-6 bg-white border border-steel-200 rounded-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-steel-500">
              <span>
                {lang === 'fr' ? 'Compte Conducteur Professionnel' : 'حساب سائق محترف'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-ink font-semibold">
                <MapPin className="w-3.5 h-3.5 text-primary-dark" />
                {profile?.city || 'الدار البيضاء'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-ink font-semibold">
                <Award className="w-3.5 h-3.5 text-primary-dark" />
                {lang === 'fr' ? experienceMeta.labelFr : experienceMeta.labelAr}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-ink">
              {lang === 'fr'
                ? `Bonjour, ${profile?.full_name || 'Conducteur'}`
                : `مرحباً بك، ${profile?.full_name || 'سائق محترف'}`}
            </h1>
            <p className="text-xs sm:text-sm text-steel-600 max-w-2xl">
              {lang === 'fr'
                ? 'Suivez les demandes urgentes des propriétaires d’engins et postulez directement aux chantiers proches de votre ville.'
                : 'تابع عروض العمل العاجلة التي يطلقها ملاك الآليات والمقاولات، وقدّم على الورش المناسب لخبرتك ومدينتك.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleAvailability}
              disabled={isTogglingAvail}
              className={`min-h-[46px] px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                isAvailable
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-steel-100 border-steel-300 text-steel-700 hover:bg-steel-200'
              }`}
            >
              {isAvailable ? (
                <>
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                  <span>{lang === 'fr' ? 'Disponible pour travailler' : 'متاح للعمل الآن'}</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-4 h-4 text-steel-600" />
                  <span>{lang === 'fr' ? 'Occupé actuellement' : 'مشغول في ورش حالياً'}</span>
                </>
              )}
            </button>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate('/driver/joboffer')}
              leftIcon={<Briefcase className="w-4 h-4" />}
              rightIcon={<ArrowIcon className="w-4 h-4" />}
              className="min-h-[46px] font-black text-xs whitespace-nowrap"
            >
              {lang === 'fr' ? 'Voir les offres d’emploi' : 'تصفح عروض العمل'}
            </Button>
          </div>
        </div>
      </Card>

      {/* 3 Key Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 sm:p-5 bg-white border border-steel-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-steel-500">
              {lang === 'fr' ? 'Offres ouvertes' : 'العروض المتاحة الآن'}
            </span>
            <Briefcase className="w-4 h-4 text-primary-dark" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-ink tabular-nums">
              {offers.length}
            </span>
            <span className="text-xs font-semibold text-amber-700 tabular-nums">
              {urgentOffersCount}{' '}
              {lang === 'fr' ? 'urgentes' : 'طلب عاجل'}
            </span>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 bg-white border border-steel-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-steel-500">
              {lang === 'fr' ? 'Adaptées à vos engins' : 'تطابق آلياتك المحترفة'}
            </span>
            <Wrench className="w-4 h-4 text-primary-dark" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-ink tabular-nums">
              {matchingOffers.length}
            </span>
            <span className="text-xs text-steel-500">
              {lang === 'fr' ? 'offres ciblées' : 'عرض مناسب لك'}
            </span>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 bg-white border border-steel-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-steel-500">
              {lang === 'fr' ? 'Candidatures envoyées' : 'طلبات تقدمت لها'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-ink tabular-nums">
              {appliedOffersCount}
            </span>
            <span className="text-xs text-steel-500">
              {lang === 'fr' ? 'en attente de retour' : 'بانتظار رد المالك'}
            </span>
          </div>
        </Card>
      </div>

      {/* Mobile Urgent Campaign Alert Readiness Card */}
      <Card className="p-4 sm:p-5 bg-amber-50/70 border border-amber-200 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-ink flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-sm font-black text-ink">
                {lang === 'fr'
                  ? 'Alertes mobiles pour les campagnes urgentes des propriétaires'
                  : 'إشعارات الهاتف الفورية لحملات البحث العاجل عن السائقين'}
              </h2>
              <p className="text-xs text-steel-600 leading-relaxed">
                {notifPerm === 'granted'
                  ? lang === 'fr'
                    ? 'Vos alertes sont actives : dès qu’un propriétaire lance une recherche urgente, vous recevrez une notification mobile avec le type d’engin, le tarif et la ville.'
                    : 'إشعارات هاتفك مفعّلة وجاهزة: فور إطلاق أي مالك حملة بحث عاجلة عن سائق، سيصلك تنبيه فوري على الهاتف بنوع الآلية، الثمن، والمدينة.'
                  : lang === 'fr'
                  ? 'Activez les notifications sur votre téléphone pour recevoir instantanément les offres urgentes des propriétaires.'
                  : 'فعّل إشعارات الهاتف الآن ليصلك صوت وتنبيه فوري عند إطلاق ملاك الآليات عروض عمل عاجلة في مدينتك.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnableNotifications}
            className={`min-h-[44px] px-4 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer whitespace-nowrap transition-colors ${
              notifPerm === 'granted'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-ink text-primary hover:bg-steel-900'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>
              {notifPerm === 'granted'
                ? lang === 'fr'
                  ? 'Tester l’alerte'
                  : 'إشعار مفعّل · تجربة الصوت'
                : lang === 'fr'
                ? 'Activer les alertes'
                : 'تفعيل إشعارات الهاتف'}
            </span>
          </button>
        </div>
      </Card>

      {/* Main Grid: Mastered Machines & Latest Offers Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Driver Skills Card */}
        <Card className="p-5 bg-white border border-steel-200 rounded-2xl flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black text-ink">
                {lang === 'fr' ? 'Engins maîtrisés & Profil' : 'الآليات التي تحترفها وخبرتك'}
              </h2>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="text-xs font-bold text-primary-dark hover:underline flex items-center gap-1 cursor-pointer min-h-[36px]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Modifier' : 'تعديل'}</span>
              </button>
            </div>

            <div className="text-xs text-steel-600 flex items-center gap-2 pb-2 border-b border-steel-100">
              <span>{lang === 'fr' ? 'Expérience :' : 'سنوات التجربة:'}</span>
              <span className="font-bold text-ink">
                {lang === 'fr' ? experienceMeta.labelFr : experienceMeta.labelAr}
              </span>
            </div>

            {driverMachines.length === 0 ? (
              <p className="text-xs text-steel-500 py-2">
                {lang === 'fr'
                  ? 'Ajoutez les engins que vous conduisez pour recevoir des offres ciblées.'
                  : 'لم تحدد الآليات بعد. أضف الآليات التي تحترفها لتصلك العروض المطابقة.'}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {driverMachines.map((id) => {
                  const opt = getDriverMachineOption(id);
                  return (
                    <li
                      key={id}
                      className="text-xs font-bold text-ink py-1.5 px-2.5 rounded-lg bg-surface border border-steel-200/80 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">
                        {lang === 'fr' ? opt.labelFr : opt.labelAr}
                      </span>
                      <span className="text-[11px] text-steel-400 truncate">
                        {lang === 'fr' ? opt.labelAr : opt.labelFr}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full justify-center text-xs font-bold min-h-[44px]"
          >
            {lang === 'fr' ? 'Mettre à jour mes engins' : 'تحديث الآليات والخبرة'}
          </Button>
        </Card>

        {/* Latest Job Offers Preview */}
        <Card className="lg:col-span-2 p-5 bg-white border border-steel-200 rounded-2xl space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-ink">
                {lang === 'fr'
                  ? 'Dernières offres pour conducteurs'
                  : 'أحدث عروض العمل للسائقين'}
              </h2>
              <p className="text-xs text-steel-500">
                {lang === 'fr'
                  ? 'Consultez la liste complète et postulez en un clic'
                  : 'معاينة سريعة لأحدث الطلبات المتاحة — افتح صفحة العروض للتفاصيل الكاملة'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/driver/joboffer')}
              className="text-xs font-black text-primary-dark hover:underline whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] flex items-center gap-1"
            >
              <span>{lang === 'fr' ? 'Tout voir' : 'كل العروض'}</span>
              <ArrowIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoadingOffers ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-steel-100 animate-pulse"
                />
              ))}
            </div>
          ) : previewOffers.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-bold text-steel-600">
                {lang === 'fr'
                  ? 'Aucune offre disponible pour le moment.'
                  : 'لا توجد عروض عمل متاحة حالياً.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {previewOffers.map((offer) => {
                const isMatch = driverMachines.includes(offer.machine_category);
                return (
                  <div
                    key={offer.id}
                    className="p-4 rounded-xl border border-steel-200 hover:border-primary transition-colors bg-surface/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-steel-500">
                        {offer.is_urgent && (
                          <span className="font-black text-rose-600">
                            {lang === 'fr' ? 'Urgent' : 'طلب عاجل'}
                          </span>
                        )}
                        {offer.is_urgent && <span aria-hidden="true">·</span>}
                        <span>{offer.city}</span>
                        <span aria-hidden="true">·</span>
                        <span>{offer.duration_label}</span>
                        {isMatch && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-emerald-700">
                              {lang === 'fr' ? 'Correspond à votre profil' : 'يطابق آليتك'}
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="text-sm font-black text-ink truncate">
                        {lang === 'fr' ? offer.machine_label_fr : offer.machine_label_ar}
                      </h3>

                      <div className="text-xs text-steel-600 truncate">
                        {offer.owner_company || offer.owner_name}
                        {offer.work_location_note ? ` · ${offer.work_location_note}` : ''}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                      <div className="text-sm font-black text-ink tabular-nums">
                        {offer.offered_salary.toLocaleString('fr-FR')}{' '}
                        <span className="text-xs font-bold text-steel-600">
                          {lang === 'fr'
                            ? `MAD / ${offer.salary_unit === 'month' ? 'mois' : 'jour'}`
                            : `د.م / ${offer.salary_unit === 'month' ? 'شهر' : 'يوم'}`}
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          navigate(`/driver/joboffer?offer=${encodeURIComponent(offer.id)}`)
                        }
                        className="min-h-[40px] text-xs font-bold whitespace-nowrap"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {lang === 'fr' ? 'Voir & Contacter' : 'عرض والتواصل'}
                        </span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default DriverDashboardPage;
