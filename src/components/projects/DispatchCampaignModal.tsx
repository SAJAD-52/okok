// ============================================================================
// JADIJCB: InDrive-Style Live Dispatch Campaign Launch Modal
// Allows contractors to select an equipment category (identical to owner's
// machine form), choose a geographic km radius or nationwide Morocco, and add
// work/budget details to broadcast an immediate audio & push opportunity.
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Radio,
  MapPin,
  Radar,
  Globe,
  Send,
  Loader2,
  CheckCircle2,
  Truck,
} from 'lucide-react';
import { ContractorSite, DispatchCampaign } from '../../types/database';
import { EQUIPMENT_CATEGORIES } from '../../data/categories';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import {
  findMatchingOwnersForCampaign,
  launchDispatchCampaign,
  MatchedOwnerTarget,
} from '../../lib/dispatchService';
import { formatDistanceKm } from '../../lib/geoUtils';

interface DispatchCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: ContractorSite | null;
  onCampaignLaunched: (campaign: DispatchCampaign) => void;
}

const PRESET_RADII = [15, 30, 50, 100, 200];

export const DispatchCampaignModal: React.FC<DispatchCampaignModalProps> = ({
  isOpen,
  onClose,
  site,
  onCampaignLaunched,
}) => {
  const { lang, t } = useLanguage();
  const { user, profile } = useAuth();

  const machineryCategories = useMemo(
    () => EQUIPMENT_CATEGORIES.filter((c) => c.slug !== 'spare-parts'),
    []
  );

  const [machineCategory, setMachineCategory] = useState<string>(
    machineryCategories[0]?.slug || 'loader'
  );
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [isNationwide, setIsNationwide] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const [matchedTargets, setMatchedTargets] = useState<MatchedOwnerTarget[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  const selectedCategoryObj = useMemo(
    () => machineryCategories.find((c) => c.slug === machineCategory) || machineryCategories[0],
    [machineryCategories, machineCategory]
  );

  const derivedMachineName = selectedCategoryObj
    ? lang === 'fr'
      ? selectedCategoryObj.name_fr
      : selectedCategoryObj.name_ar
    : lang === 'fr'
    ? 'Engin BTP'
    : 'آلية أشغال';

  useEffect(() => {
    if (!isOpen) {
      setNotes('');
    }
  }, [isOpen]);

  // Live preview of matching owners in selected radius
  useEffect(() => {
    if (!isOpen || !site) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsScanning(true);
      try {
        const targets = await findMatchingOwnersForCampaign({
          siteLat: site.lat,
          siteLng: site.lng,
          machineCategory,
          machineName: derivedMachineName,
          radiusKm: isNationwide ? null : radiusKm,
          isNationwide,
          excludeOwnerId: user?.id || profile?.id,
        });
        if (!cancelled) {
          setMatchedTargets(targets);
        }
      } catch {
        if (!cancelled) setMatchedTargets([]);
      } finally {
        if (!cancelled) setIsScanning(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, site, machineCategory, derivedMachineName, radiusKm, isNationwide, user?.id, profile?.id]);

  if (!isOpen || !site) return null;

  const companyName =
    profile?.company_name?.trim() ||
    profile?.full_name?.trim() ||
    site.manager_name?.trim() ||
    site.name;

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSending(true);
    try {
      const targets = await findMatchingOwnersForCampaign({
        siteLat: site.lat,
        siteLng: site.lng,
        machineCategory,
        machineName: derivedMachineName,
        radiusKm: isNationwide ? null : radiusKm,
        isNationwide,
        excludeOwnerId: user?.id || profile?.id,
      });

      const result = await launchDispatchCampaign({
        contractorId: user?.id || profile?.id || site.contractor_id || 'demo',
        companyName,
        siteId: site.id,
        siteName: site.name,
        siteCity: site.city,
        siteLat: site.lat,
        siteLng: site.lng,
        sitePhone: site.manager_phone || profile?.phone || '',
        machineCategory,
        machineName: derivedMachineName,
        radiusKm: isNationwide ? null : radiusKm,
        isNationwide,
        notes: notes.trim(),
        targets,
      });

      onCampaignLaunched(result.campaign);
      onClose();

      if (targets.length > 0) {
        if (result.persistedToSupabase) {
          toast.success(
            lang === 'fr'
              ? `Campagne lancée ! Alerte envoyée à ${targets.length} propriétaire(s) ⚡`
              : `تم إطلاق حملة البحث وإرسال الإشعار لـ ${targets.length} مالك آليات ⚡`
          );
        } else {
          toast.error(
            lang === 'fr'
              ? 'Campagne enregistrée localement, mais l’envoi cloud a échoué. Vérifiez votre connexion.'
              : 'تعذر إرسال الإشعارات للملاك عبر السحابة. تأكد من تسجيل الدخول أو اتصالك بالإنترنت ثم أعد المحاولة.'
          );
        }
      } else {
        toast.info(
          lang === 'fr'
            ? 'Campagne enregistrée (0 engin disponible dans ce périmètre pour le moment).'
            : 'تم تسجيل الحملة، لكن لا توجد آليات مطابقة حالياً في هذا القطر. جرّب توسيع المسافة أو اختيار المغرب كاملاً.'
        );
      }
    } catch {
      toast.error(
        lang === 'fr'
          ? 'Impossible de lancer la campagne pour le moment'
          : 'تعذر إطلاق حملة البحث حالياً، يرجى المحاولة مجدداً'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <Card className="w-full sm:max-w-xl max-h-[92dvh] flex flex-col bg-white border border-steel-200 shadow-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden p-0 text-start">
        {/* Header */}
        <div className="bg-ink text-white px-4 py-3.5 sm:p-5 shrink-0 border-b-2 border-primary">
          <div className="sm:hidden w-10 h-1 bg-steel-600 rounded-full mx-auto mb-2.5" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary text-ink flex items-center justify-center shrink-0 shadow-sm">
                <Radio className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  {lang === 'fr' ? 'Campagne de recherche directe' : 'إطلاق حملة بحث مباشر عن آلية'}
                </h3>
                <p className="text-[11px] text-primary font-bold truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>{site.name}</span>
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

        {/* Form */}
        <form onSubmit={handleLaunch} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* 1. Category Select (Identical to Owner Add-Machine Categories) */}
            <div>
              <label className="text-xs font-black text-ink block mb-1.5">
                {t('machines.category_label')}
              </label>
              <select
                value={machineCategory}
                onChange={(e) => setMachineCategory(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              >
                {machineryCategories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {lang === 'fr' ? cat.name_fr : cat.name_ar}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Radius / Nationwide Target Scope */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-black text-ink flex items-center gap-1.5">
                  <Radar className="w-4 h-4 text-primary-dark shrink-0" />
                  <span>
                    {lang === 'fr' ? 'Périmètre de diffusion (Rayon)' : 'نطاق وقطر البث الجغرافي'}
                  </span>
                </label>
                <span className="text-xs font-black text-primary-dark font-mono tabular-nums">
                  {isNationwide
                    ? lang === 'fr'
                      ? 'Tout le Maroc'
                      : 'المغرب كاملاً'
                    : `${radiusKm} ${lang === 'fr' ? 'km' : 'كم'}`}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PRESET_RADII.map((km) => {
                  const selected = !isNationwide && radiusKm === km;
                  return (
                    <button
                      key={km}
                      type="button"
                      onClick={() => {
                        setIsNationwide(false);
                        setRadiusKm(km);
                      }}
                      className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer tabular-nums ${
                        selected
                          ? 'bg-ink text-primary border-ink shadow-sm'
                          : 'bg-white text-steel-700 border-steel-200 hover:border-steel-400'
                      }`}
                    >
                      {km} {lang === 'fr' ? 'km' : 'كم'}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsNationwide(true)}
                  className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    isNationwide
                      ? 'bg-primary text-ink border-ink shadow-sm'
                      : 'bg-amber-50 text-ink border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'fr' ? 'Maroc' : 'المغرب كاملاً'}</span>
                </button>
              </div>

              {!isNationwide && (
                <div className="bg-steel-50 border border-steel-200 rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-steel-600">
                    <span>{lang === 'fr' ? 'Ajuster le rayon précis :' : 'ضبط القطر الكيلومتري بدقة:'}</span>
                    <span dir="ltr" className="font-mono tabular-nums text-ink font-black">
                      {radiusKm} km
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={300}
                    step={5}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* 3. Additional Details (Duration, Start Date, Budget, Work Type) */}
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr'
                  ? 'Détails supplémentaires (durée, date de début, budget, type de travaux...)'
                  : 'تفاصيل إضافية للملاك (المدة، تاريخ البدء، الميزانية، نوع الأشغال...)'}
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  lang === 'fr'
                    ? 'Ex: Travaux terrassement dès demain matin, durée 15 jours, budget 2200 DH/jour avec chauffeur...'
                    : 'مثال: أشغال الحفر ابتداءً من غد صباحاً لمدة 15 يوم، الميزانية 2200 درهم/اليوم مع السائق...'
                }
                className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Live Match Scan Summary */}
            <div
              className={`rounded-2xl p-3.5 border flex items-center justify-between gap-3 ${
                matchedTargets.length > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isScanning ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary-dark shrink-0" />
                ) : matchedTargets.length > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Truck className="w-5 h-5 text-amber-700 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-black">
                    {isScanning
                      ? lang === 'fr'
                        ? 'Scan des engins dans le périmètre...'
                        : 'جاري مسح الآليات المتاحة في النطاق...'
                      : lang === 'fr'
                      ? `${matchedTargets.length} propriétaire(s) correspondant(s) détecté(s)`
                      : `تم رصد ${matchedTargets.length} مالك آليات مطابق داخل النطاق`}
                  </p>
                  {!isScanning && matchedTargets.length > 0 && (
                    <p className="text-[11px] opacity-80 truncate tabular-nums">
                      {lang === 'fr' ? 'Plus proche à' : 'الأقرب على بعد'}{' '}
                      {formatDistanceKm(matchedTargets[0].distance_km, lang)} ·{' '}
                      {matchedTargets[0].matched_machine_title}
                    </p>
                  )}
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-xl bg-white/90 text-ink font-black text-sm font-mono tabular-nums border border-current/15 shrink-0">
                {matchedTargets.length}
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
                ? `Lancer l’alerte (${matchedTargets.length})`
                : `إرسال الحملة الآن (${matchedTargets.length})`}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default DispatchCampaignModal;
