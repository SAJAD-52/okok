// ============================================================================
// JADIJCB: Owner Driver Search Live Dispatch Modal ("إبحث عن سائق")
// Launches an urgent driver hiring offer WITHOUT city/location selection:
// broadcasts automatically to ALL registered drivers across Morocco whose
// profile includes the selected machine specialty, triggering audio & OS push.
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  HardHat,
  Send,
  Loader2,
  CheckCircle2,
  Users,
  Truck,
  Clock,
  Award,
  Home,
  Utensils,
  Zap,
  Banknote,
} from 'lucide-react';
import { DriverJobOffer, Machine } from '../../types/database';
import {
  DRIVER_EXPERIENCE_LEVELS,
  DRIVER_MACHINE_GROUPS,
  DRIVER_MACHINE_OPTIONS,
  getDriverMachineOption,
  inferDriverMachineCategory,
} from '../../data/driverMachines';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import {
  findMatchingDriversForOffer,
  launchDriverSearchCampaign,
  MatchedDriverTarget,
} from '../../lib/driverOfferService';

interface DriverDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine | null;
  onOfferLaunched: (offer: DriverJobOffer) => void;
}

const DURATION_PRESETS_AR = [
  'أسبوع واحد',
  '15 يوماً',
  'شهر واحد',
  '3 أشهر',
  'عمل مستمر / دائم',
];

const DURATION_PRESETS_FR = [
  '1 semaine',
  '15 jours',
  '1 mois',
  '3 mois',
  'Mission longue durée',
];

export const DriverDispatchModal: React.FC<DriverDispatchModalProps> = ({
  isOpen,
  onClose,
  machine,
  onOfferLaunched,
}) => {
  const { lang, t } = useLanguage();
  const { user, profile } = useAuth();

  const [machineCategory, setMachineCategory] = useState('tractopelle');
  const [offeredSalary, setOfferedSalary] = useState('350');
  const [salaryUnit, setSalaryUnit] = useState<'day' | 'month'>('day');
  const [durationLabel, setDurationLabel] = useState('شهر واحد');
  const [experienceRequired, setExperienceRequired] = useState('3_5');
  const [accommodationIncluded, setAccommodationIncluded] = useState(true);
  const [mealsIncluded, setMealsIncluded] = useState(false);
  const [isUrgent, setIsUrgent] = useState(true);
  const [descriptionAr, setDescriptionAr] = useState('');

  const [matchedDrivers, setMatchedDrivers] = useState<MatchedDriverTarget[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Reset form defaults when modal opens for a machine
  useEffect(() => {
    if (isOpen && machine) {
      const inferred = inferDriverMachineCategory(machine);
      setMachineCategory(inferred);
      setOfferedSalary('350');
      setSalaryUnit('day');
      setDurationLabel(lang === 'fr' ? '1 mois' : 'شهر واحد');
      setExperienceRequired('3_5');
      setAccommodationIncluded(true);
      setMealsIncluded(false);
      setIsUrgent(true);
      setDescriptionAr('');
    }
  }, [isOpen, machine, lang]);

  // Live scan of ALL matching registered drivers nationwide (no city filter)
  useEffect(() => {
    if (!isOpen || !machine) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsScanning(true);
      try {
        const list = await findMatchingDriversForOffer(
          machineCategory,
          user?.id || profile?.id
        );
        if (!cancelled) setMatchedDrivers(list);
      } catch {
        if (!cancelled) setMatchedDrivers([]);
      } finally {
        if (!cancelled) setIsScanning(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, machine, machineCategory, user?.id, profile?.id]);

  const selectedMachineMeta = useMemo(
    () => getDriverMachineOption(machineCategory),
    [machineCategory]
  );

  if (!isOpen || !machine) return null;

  const ownerName =
    profile?.full_name?.trim() ||
    profile?.company_name?.trim() ||
    (lang === 'fr' ? 'Propriétaire d’engin' : 'مالك آلية');
  const ownerCompany = profile?.company_name?.trim() || ownerName;
  const ownerPhone = profile?.phone?.trim() || '';
  const machineTitle =
    `${machine.brand || ''} ${machine.model || ''}`.trim() ||
    (lang === 'fr' ? machine.title_fr || machine.title_ar : machine.title_ar);

  const durationPresets = lang === 'fr' ? DURATION_PRESETS_FR : DURATION_PRESETS_AR;

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericSalary = Number(offeredSalary);
    if (!Number.isFinite(numericSalary) || numericSalary <= 0) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez indiquer la rémunération proposée (en MAD)'
          : 'يرجى تحديد الأجر المقترح للسائق بالدرهم'
      );
      return;
    }

    if (!durationLabel.trim()) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez préciser la durée estimée du travail'
          : 'يرجى تحديد مدة العمل أو الورش'
      );
      return;
    }

    setIsSending(true);
    try {
      const result = await launchDriverSearchCampaign({
        ownerId: user?.id || profile?.id || machine.owner_id,
        ownerName,
        ownerCompany,
        ownerPhone,
        machineId: machine.id,
        machineImage: machine.images?.[0] || '',
        machineCategory,
        machineTitle,
        offeredSalary: numericSalary,
        salaryUnit,
        durationLabel: durationLabel.trim(),
        experienceRequired,
        accommodationIncluded,
        mealsIncluded,
        isUrgent,
        descriptionAr: descriptionAr.trim(),
      });

      onOfferLaunched(result.offer);
      onClose();

      if (result.matchedDrivers.length > 0) {
        toast.success(
          lang === 'fr'
            ? `Offre diffusée ! Alerte sonore & push envoyée à ${result.matchedDrivers.length} conducteur(s) 👷`
            : `تم إطلاق حملة البحث وإرسال تنبيه صوتي وإشعار هاتف لـ ${result.matchedDrivers.length} سائق(ين) مسجلين بهذه الآلية 👷`
        );
      } else {
        toast.success(
          lang === 'fr'
            ? 'Offre publiée dans le portail des conducteurs (/driver/joboffer).'
            : 'تم نشر العرض بنجاح في بوابة السائقين، وسيصل لكل سائق يمتلك هذا التخصص.'
        );
      }
    } catch {
      toast.error(
        lang === 'fr'
          ? 'Impossible de diffuser l’offre actuellement'
          : 'تعذر إطلاق حملة البحث عن سائق حالياً'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <Card className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col bg-white border border-steel-200 shadow-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden p-0 text-start">
        {/* Header */}
        <div className="bg-ink text-white px-4 py-3.5 sm:p-5 shrink-0 border-b-2 border-primary">
          <div className="sm:hidden w-10 h-1 bg-steel-600 rounded-full mx-auto mb-2.5" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary text-ink flex items-center justify-center shrink-0 shadow-sm">
                <HardHat className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  {lang === 'fr'
                    ? 'Lancer une recherche urgente de conducteur'
                    : 'إطلاق حملة مباشرة للبحث عن سائق'}
                </h3>
                <p className="text-[11px] text-primary font-bold truncate flex items-center gap-1.5">
                  <Truck className="w-3 h-3 shrink-0" />
                  <span>
                    {lang === 'fr' ? machine.title_fr || machineTitle : machine.title_ar || machineTitle}
                    {machine.year ? ` (${machine.year})` : ''}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] -me-1.5 rounded-xl text-steel-300 hover:text-white hover:bg-steel-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLaunch} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* 1. Machine Specialty Selection (Nationwide broadcast — no city/location required) */}
            <div className="bg-steel-50 border border-steel-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-black text-ink flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-primary-dark shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Type d’engin maîtrisé requis :'
                      : 'تخصص الآلية المطلوب للسائق :'}
                  </span>
                </label>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                  {lang === 'fr'
                    ? 'Diffusion à tous les conducteurs de cet engin'
                    : 'يصل لجميع السائقين المسجلين بهذه الآلية'}
                </span>
              </div>

              <select
                value={machineCategory}
                onChange={(e) => setMachineCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              >
                {DRIVER_MACHINE_GROUPS.map((grp) => (
                  <optgroup
                    key={grp.id}
                    label={lang === 'fr' ? grp.labelFr : grp.labelAr}
                  >
                    {DRIVER_MACHINE_OPTIONS.filter((m) => m.group === grp.id).map((m) => (
                      <option key={m.id} value={m.id}>
                        {lang === 'fr' ? m.labelFr : m.labelAr}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <p className="text-[11px] text-steel-600 leading-relaxed">
                {lang === 'fr'
                  ? `Aucune ville à sélectionner : votre annonce sera envoyée par notification sonore et push mobile à tous les conducteurs ayant choisi « ${selectedMachineMeta.labelFr} » lors de leur inscription.`
                  : `لا حاجة لتحديد المدينة أو الموقع: سيظهر هذا الإعلان ويُرسل فوراً كإشعار هاتفي لكل سائق اختار «${selectedMachineMeta.labelAr}» عند التسجيل.`}
              </p>
            </div>

            {/* 2. Salary & Payment Basis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-black text-ink flex items-center gap-1.5 mb-1.5">
                  <Banknote className="w-4 h-4 text-primary-dark shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Salaire / Tarif proposé (MAD) :'
                      : 'الأجر المقترح للسائق (بالدرهم) :'}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={50}
                    step={10}
                    required
                    dir="ltr"
                    value={offeredSalary}
                    onChange={(e) => setOfferedSalary(e.target.value)}
                    placeholder={salaryUnit === 'month' ? '8000' : '350'}
                    className="w-full ps-3.5 pe-14 py-2.5 text-sm font-black font-mono tabular-nums bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-black text-steel-500">
                    {lang === 'fr' ? 'MAD' : 'د.م'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Périodicité de paiement :' : 'طريقة احتساب الأجر :'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      id: 'day' as const,
                      ar: 'باليوم (يومي)',
                      fr: 'Par jour',
                    },
                    {
                      id: 'month' as const,
                      ar: 'بالشهر (شهري)',
                      fr: 'Par mois',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSalaryUnit(opt.id);
                        if (opt.id === 'month' && Number(offeredSalary) < 1500) {
                          setOfferedSalary('7500');
                        } else if (opt.id === 'day' && Number(offeredSalary) >= 2000) {
                          setOfferedSalary('350');
                        }
                      }}
                      className={`min-h-[44px] px-3 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        salaryUnit === opt.id
                          ? 'bg-ink text-primary border-ink shadow-xs'
                          : 'bg-white text-steel-700 border-steel-300 hover:bg-steel-50'
                      }`}
                    >
                      {lang === 'fr' ? opt.fr : opt.ar}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Work Duration & Experience Required */}
            <div className="space-y-2.5">
              <label className="text-xs font-black text-ink flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary-dark shrink-0" />
                <span>
                  {lang === 'fr' ? 'Durée prévue de la mission :' : 'مدة العمل المطلوبة :'}
                </span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {durationPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDurationLabel(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer min-h-[38px] ${
                      durationLabel === preset
                        ? 'bg-ink text-primary border-ink'
                        : 'bg-steel-50 text-steel-700 border-steel-200 hover:bg-steel-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <input
                type="text"
                required
                value={durationLabel}
                onChange={(e) => setDurationLabel(e.target.value)}
                placeholder={
                  lang === 'fr'
                    ? 'Ex: 2 mois renouvelables, chantier continu...'
                    : 'أو اكتب المدة هنا: مثلاً شهرين قابلة للتمديد...'
                }
                className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-ink flex items-center gap-1.5">
                <Award className="w-4 h-4 text-primary-dark shrink-0" />
                <span>
                  {lang === 'fr' ? 'Expérience minimale souhaitée :' : 'الخبرة المطلوبة في السائق :'}
                </span>
              </label>
              <select
                value={experienceRequired}
                onChange={(e) => setExperienceRequired(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              >
                <option value="">
                  {lang === 'fr' ? 'Toutes expériences acceptées' : 'جميع مستويات الخبرة مقبولة'}
                </option>
                {DRIVER_EXPERIENCE_LEVELS.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {lang === 'fr' ? exp.labelFr : exp.labelAr}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Driver Perks & Urgency */}
            <div className="space-y-2">
              <label className="text-xs font-black text-ink block">
                {lang === 'fr'
                  ? 'Avantages et conditions de travail :'
                  : 'ظروف العمل والامتيازات المقدمة للسائق :'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAccommodationIncluded((v) => !v)}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    accommodationIncluded
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                      : 'bg-white border-steel-200 text-steel-600'
                  }`}
                >
                  <Home
                    className={`w-4 h-4 shrink-0 ${
                      accommodationIncluded ? 'text-emerald-600' : 'text-steel-400'
                    }`}
                  />
                  <span>{lang === 'fr' ? 'Logement assuré' : 'توفير السكن'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMealsIncluded((v) => !v)}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    mealsIncluded
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                      : 'bg-white border-steel-200 text-steel-600'
                  }`}
                >
                  <Utensils
                    className={`w-4 h-4 shrink-0 ${
                      mealsIncluded ? 'text-emerald-600' : 'text-steel-400'
                    }`}
                  />
                  <span>{lang === 'fr' ? 'Repas pris en charge' : 'توفير التغذية'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsUrgent((v) => !v)}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isUrgent
                      ? 'bg-amber-50 border-amber-400 text-amber-950'
                      : 'bg-white border-steel-200 text-steel-600'
                  }`}
                >
                  <Zap
                    className={`w-4 h-4 shrink-0 ${
                      isUrgent ? 'text-amber-600' : 'text-steel-400'
                    }`}
                  />
                  <span>{lang === 'fr' ? 'Démarrage urgent' : 'مطلوب بشكل عاجل'}</span>
                </button>
              </div>
            </div>

            {/* 5. Additional Notes for Driver */}
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr'
                  ? 'Détails utiles pour le conducteur (type de chantier, horaires, paiement...) :'
                  : 'تفاصيل إضافية تهم السائق (طبيعة الأشغال، أوقات العمل، طريقة الدفع...) :'}
              </label>
              <textarea
                rows={3}
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                placeholder={
                  lang === 'fr'
                    ? 'Ex: Travaux VRD et tranchées, paiement hebdomadaire chaque samedi, démarrage dès demain...'
                    : 'مثال: أشغال الحفر أو التسوية، الدفع أسبوعياً أو شهرياً بانتظام، الانطلاق الفوري...'
                }
                className="w-full px-3.5 py-2.5 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 6. Live Matched Drivers Summary */}
            <div
              className={`rounded-2xl p-3.5 border flex items-center justify-between gap-3 ${
                matchedDrivers.length > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isScanning ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary-dark shrink-0" />
                ) : matchedDrivers.length > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Users className="w-5 h-5 text-amber-700 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-black">
                    {isScanning
                      ? lang === 'fr'
                        ? 'Recherche des conducteurs inscrits pour cet engin...'
                        : 'جاري فحص السائقين المسجلين لهذه الآلية...'
                      : lang === 'fr'
                      ? `${matchedDrivers.length} conducteur(s) inscrit(s) pour cet engin`
                      : `تم العثور على ${matchedDrivers.length} سائق(ين) مسجلين يحترفون هذه الآلية`}
                  </p>
                  <p className="text-[11px] opacity-85 truncate">
                    {lang === 'fr'
                      ? 'Tous recevront une alerte sonore et push mobile instantanée.'
                      : 'سيصل التنبيه الصوتي وإشعار الهاتف مباشرة لجميع السائقين المعنيين.'}
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-xl bg-white/90 text-ink font-black text-sm font-mono tabular-nums border border-current/15 shrink-0">
                {matchedDrivers.length}
              </span>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="shrink-0 p-4 sm:px-6 bg-steel-50 border-t border-steel-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              className="w-full sm:w-auto justify-center min-h-[44px]"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSending}
              leftIcon={<Send className="w-4 h-4" />}
              className="w-full sm:w-auto justify-center min-h-[44px] font-black"
            >
              {lang === 'fr'
                ? `Diffuser l’offre (${matchedDrivers.length})`
                : `إطلاق حملة البحث عن سائق (${matchedDrivers.length})`}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default DriverDispatchModal;
