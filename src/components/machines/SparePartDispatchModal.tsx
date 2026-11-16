// ============================================================================
// JADIJCB: Owner Spare Parts Live Dispatch Campaign Modal
// Allows machinery owners to broadcast an urgent live search for a specific
// unique Reference (Réf / OEM Part Number), choose between the machine's
// location or any custom map location, select km radius or nationwide Morocco,
// and notify matching spare-parts suppliers in real time.
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Wrench,
  MapPin,
  Radar,
  Globe,
  Send,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Truck,
  Navigation,
  Hash,
} from 'lucide-react';
import { DispatchCampaign, Machine } from '../../types/database';
import { MOROCCAN_CITIES } from '../../data/cities';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { toast } from '../ui/Toast';
import { MapLocationPicker } from './MapLocationPicker';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import {
  findMatchingSparePartSuppliersForCampaign,
  launchDispatchCampaign,
  MatchedOwnerTarget,
  resolveMachineCoordinates,
} from '../../lib/dispatchService';
import { formatDistanceKm } from '../../lib/geoUtils';

interface SparePartDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine | null;
  onCampaignLaunched: (campaign: DispatchCampaign) => void;
}

const PRESET_RADII = [15, 30, 50, 100, 200];

const PART_TYPE_OPTIONS = [
  { value: 'all', ar: 'جميع أصناف قطع الغيار', fr: 'Toutes catégories de pièces' },
  { value: 'filters', ar: 'فلاتر وزيوت وتشحيم (زيت، مازوت، هواء)', fr: 'Filtres & Lubrifiants' },
  { value: 'hydraulic', ar: 'هيدروليك، مضخات، موزعات وخراطيم', fr: 'Hydraulique (Pompes, Vérins, Flexibles)' },
  { value: 'engine', ar: 'محركات، رؤوس أسطوانات وناقل الحركة', fr: 'Moteurs & Boîtes de vitesse' },
  { value: 'teeth', ar: 'أسنان وشفرات كباش ومثبتات', fr: 'Dents, Lames de godet & Fixations' },
  { value: 'tracks', ar: 'جنازير مطاطية وحديدية وعجلات', fr: 'Chenilles & Galets' },
  { value: 'electric', ar: 'كهرباء، دينامو، إنارة وبطاريات تشغيل', fr: 'Électricité, Démarreurs & Batteries' },
  { value: 'attachments', ar: 'كواسر ومرفقات هيدروليكية BRH', fr: 'Brise-roche (BRH) & Équipements' },
  { value: 'other', ar: 'مستلزمات وصيانة عامة', fr: 'Autres composants mécaniques' },
];

export const SparePartDispatchModal: React.FC<SparePartDispatchModalProps> = ({
  isOpen,
  onClose,
  machine,
  onCampaignLaunched,
}) => {
  const { lang, t } = useLanguage();
  const { user, profile } = useAuth();

  // Unique Reference & confirmation
  const [partReference, setPartReference] = useState('');
  const [isRefConfirmed, setIsRefConfirmed] = useState(false);
  const [partCategory, setPartCategory] = useState('all');
  const [partConditionPref, setPartConditionPref] = useState<'any' | 'new' | 'used'>('any');
  const [notes, setNotes] = useState('');

  // Location choice: 1. Machine location vs 2. Custom map location
  const [locationMode, setLocationMode] = useState<'machine' | 'custom'>('machine');
  const [customCityId, setCustomCityId] = useState('casablanca');
  const [customLat, setCustomLat] = useState<number>(33.5731);
  const [customLng, setCustomLng] = useState<number>(-7.5898);

  // Radius / Nationwide
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [isNationwide, setIsNationwide] = useState<boolean>(false);

  // Scan & Submit states
  const [matchedTargets, setMatchedTargets] = useState<MatchedOwnerTarget[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  const machineCoords = useMemo(() => {
    if (!machine) return { lat: 33.5731, lng: -7.5898, hasExact: false };
    const resolved = resolveMachineCoordinates(machine);
    const hasExact = Boolean(
      Number.isFinite(Number(machine.lat ?? machine.location_lat)) &&
        Number.isFinite(Number(machine.lng ?? machine.location_lng)) &&
        Number(machine.lat ?? machine.location_lat) !== 0
    );
    return {
      lat: resolved?.lat ?? 33.5731,
      lng: resolved?.lng ?? -7.5898,
      hasExact,
    };
  }, [machine]);

  // Reset modal state whenever opened for a machine
  useEffect(() => {
    if (isOpen && machine) {
      setPartReference('');
      setIsRefConfirmed(false);
      setPartCategory('all');
      setPartConditionPref('any');
      setNotes('');
      setLocationMode('machine');
      setRadiusKm(50);
      setIsNationwide(false);
      setCustomCityId(machine.city_id || 'casablanca');
      setCustomLat(machineCoords.lat);
      setCustomLng(machineCoords.lng);
    }
  }, [isOpen, machine, machineCoords.lat, machineCoords.lng]);

  const activeOrigin = useMemo(() => {
    if (locationMode === 'custom') {
      const cityObj = MOROCCAN_CITIES.find((c) => c.id === customCityId);
      return {
        lat: customLat,
        lng: customLng,
        city: cityObj ? (lang === 'fr' ? cityObj.name_fr : cityObj.name_ar) : customCityId,
      };
    }
    return {
      lat: machineCoords.lat,
      lng: machineCoords.lng,
      city: machine?.city || 'المغرب',
    };
  }, [locationMode, customLat, customLng, customCityId, machineCoords, machine?.city, lang]);

  const normalizedDisplayRef = useMemo(
    () => partReference.trim().toUpperCase(),
    [partReference]
  );

  // Live scan of matching spare-parts suppliers
  useEffect(() => {
    if (!isOpen || !machine) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsScanning(true);
      try {
        const targets = await findMatchingSparePartSuppliersForCampaign({
          originLat: activeOrigin.lat,
          originLng: activeOrigin.lng,
          partReference: normalizedDisplayRef,
          partCategory,
          machineBrand: machine.brand,
          machineModel: machine.model,
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
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    machine,
    activeOrigin.lat,
    activeOrigin.lng,
    normalizedDisplayRef,
    partCategory,
    radiusKm,
    isNationwide,
    user?.id,
    profile?.id,
  ]);

  if (!isOpen || !machine) return null;

  const exactRefCount = matchedTargets.filter((t) => t.exact_reference_match).length;

  const requesterName =
    profile?.company_name?.trim() ||
    profile?.full_name?.trim() ||
    (lang === 'fr' ? 'Propriétaire d’engin' : 'مالك آلية');

  const machineLabel = `${machine.brand || ''} ${machine.model || ''}`.trim() || machine.title_ar;

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (normalizedDisplayRef.length < 2) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez saisir le numéro de référence unique (Réf / Part Number) de la pièce'
          : 'يرجى إدخال رقم المرجع الفريد (Reference) لقطعة الغيار أولاً'
      );
      return;
    }

    if (!isRefConfirmed) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez confirmer l’exactitude du numéro de référence unique avant de lancer la recherche'
          : 'يجب تأكيد صحة رقم المرجع الفريد (Reference) قبل إطلاق الحملة'
      );
      return;
    }

    setIsSending(true);
    try {
      const targets = await findMatchingSparePartSuppliersForCampaign({
        originLat: activeOrigin.lat,
        originLng: activeOrigin.lng,
        partReference: normalizedDisplayRef,
        partCategory,
        machineBrand: machine.brand,
        machineModel: machine.model,
        radiusKm: isNationwide ? null : radiusKm,
        isNationwide,
        excludeOwnerId: user?.id || profile?.id,
      });

      const condLabel =
        partConditionPref === 'new'
          ? lang === 'fr'
            ? 'Neuve uniquement'
            : 'الحالة المطلوبة: جديدة أصلية'
          : partConditionPref === 'used'
          ? lang === 'fr'
            ? 'Occasion bon état acceptée'
            : 'الحالة المطلوبة: مستعملة بحالة جيدة'
          : '';

      const combinedNotes = [
        lang === 'fr'
          ? `Engin concerné : ${machineLabel} (${machine.year || ''})`
          : `الآلية المعنية: ${machineLabel} (${machine.year || ''})`,
        condLabel,
        notes.trim(),
      ]
        .filter(Boolean)
        .join(' · ');

      const locationLabel =
        locationMode === 'machine'
          ? lang === 'fr'
            ? `Près de l’engin (${activeOrigin.city})`
            : `قرب مكان الآلية (${activeOrigin.city})`
          : lang === 'fr'
          ? `Position choisie sur carte (${activeOrigin.city})`
          : `مكان محدد على الخريطة (${activeOrigin.city})`;

      const campaignDisplayName =
        lang === 'fr'
          ? `Pièce Réf: ${normalizedDisplayRef} (${machineLabel})`
          : `قطعة غيار Réf: ${normalizedDisplayRef} (${machineLabel})`;

      const result = await launchDispatchCampaign({
        contractorId: user?.id || profile?.id || machine.owner_id,
        companyName: requesterName,
        campaignType: 'spare_part',
        partReference: normalizedDisplayRef,
        partCategory,
        siteId: machine.id,
        siteName: locationLabel,
        siteCity: activeOrigin.city,
        siteLat: activeOrigin.lat,
        siteLng: activeOrigin.lng,
        sitePhone: profile?.phone || '',
        machineCategory: 'spare-parts',
        machineName: campaignDisplayName,
        radiusKm: isNationwide ? null : radiusKm,
        isNationwide,
        notes: combinedNotes,
        targets,
      });

      onCampaignLaunched(result.campaign);
      onClose();

      if (targets.length > 0) {
        if (result.persistedToSupabase) {
          toast.success(
            lang === 'fr'
              ? `Campagne pièce lancée ! Alerte envoyée à ${targets.length} fournisseur(s) 🔧`
              : `تم إطلاق حملة البحث عن قطعة الغيار وإرسال التنبيه لـ ${targets.length} مورد(ين) 🔧`
          );
        } else {
          toast.error(
            lang === 'fr'
              ? 'Campagne enregistrée localement, mais l’envoi cloud a échoué.'
              : 'تعذر إرسال الإشعارات عبر السحابة. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.'
          );
        }
      } else {
        toast.info(
          lang === 'fr'
            ? 'Campagne enregistrée (0 fournisseur trouvé dans ce rayon). Essayez "Tout le Maroc".'
            : 'تم تسجيل الحملة، لكن لا يوجد موردو قطع غيار منشورون حالياً في هذا القطر. جرّب اختيار المغرب كاملاً.'
        );
      }
    } catch {
      toast.error(
        lang === 'fr'
          ? 'Impossible de lancer la campagne actuellement'
          : 'تعذر إطلاق حملة البحث عن قطعة الغيار حالياً'
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
                <Wrench className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  {lang === 'fr'
                    ? 'Lancer une recherche directe de pièce détachée'
                    : 'أطلق حملة مباشرة للبحث عن قطعة غيار'}
                </h3>
                <p className="text-[11px] text-primary font-bold truncate flex items-center gap-1.5">
                  <Truck className="w-3 h-3 shrink-0" />
                  <span>
                    {lang === 'fr' ? machine.title_fr || machineLabel : machine.title_ar || machineLabel}
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

        {/* Form */}
        <form onSubmit={handleLaunch} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* 1. Unique Part Reference + Mandatory Confirmation */}
            <div className="space-y-3 bg-steel-50 p-3.5 sm:p-4 rounded-2xl border border-steel-200">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-black text-ink flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-primary-dark shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Référence unique de la pièce (Réf / OEM Part Number) :'
                      : 'رقم المرجع الفريد للقطعة (Reference / Part Number) :'}
                  </span>
                </label>
                <span className="text-[10px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                  {lang === 'fr' ? 'Unique & Obligatoire' : 'فريد وإلزامي'}
                </span>
              </div>

              <input
                type="text"
                dir="ltr"
                required
                value={partReference}
                onChange={(e) => {
                  setPartReference(e.target.value);
                  setIsRefConfirmed(false);
                }}
                placeholder="Ex: 320/08560, 1R-0750, 708-2L-00300..."
                className="w-full px-3.5 py-2.5 text-sm font-mono font-black uppercase bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px] tracking-wider"
              />

              <p className="text-[11px] text-steel-500 leading-relaxed">
                {lang === 'fr'
                  ? 'Chaque pièce possède une référence unique constructeur. Vérifiez bien ce code sur la pièce usée ou le catalogue avant de diffuser.'
                  : 'رقم المرجع (Reference) خاص وفريد لكل قطعة غيار — يرجى التحقق منه جيداً على القطعة أو الكتالوج لتفادي أي خطأ في التوريد.'}
              </p>

              {/* Explicit Confirmation Box */}
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors cursor-pointer ${
                  isRefConfirmed
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50/90 border-amber-300 text-amber-950'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isRefConfirmed}
                  onChange={(e) => setIsRefConfirmed(e.target.checked)}
                  disabled={normalizedDisplayRef.length < 2}
                  className="w-5 h-5 mt-0.5 accent-emerald-600 cursor-pointer shrink-0"
                />
                <div className="text-xs leading-snug space-y-1 min-w-0">
                  <div className="font-black flex items-center gap-1.5 flex-wrap">
                    <ShieldCheck
                      className={`w-4 h-4 shrink-0 ${
                        isRefConfirmed ? 'text-emerald-600' : 'text-amber-700'
                      }`}
                    />
                    <span>
                      {lang === 'fr'
                        ? 'Je confirme l’exactitude de cette référence unique :'
                        : 'أؤكد صحة رقم المرجع الفريد (Reference) :'}
                    </span>
                    {normalizedDisplayRef && (
                      <span
                        dir="ltr"
                        className="font-mono bg-white px-2 py-0.5 rounded-md border border-current/20 text-ink text-xs"
                      >
                        {normalizedDisplayRef}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-85">
                    {lang === 'fr'
                      ? 'La référence saisie correspond exactement à la pièce recherchée pour cet engin.'
                      : 'أؤكد أن المرجع المدخل أعلاه صحيح ومطابق تماماً للقطعة المطلوبة لهذه الآلية.'}
                  </p>
                </div>
              </label>
            </div>

            {/* 2. Part Category & Condition Preference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Catégorie de pièce :' : 'نوع وتصنيف القطعة :'}
                </label>
                <select
                  value={partCategory}
                  onChange={(e) => setPartCategory(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                >
                  {PART_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {lang === 'fr' ? opt.fr : opt.ar}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'État souhaité :' : 'حالة القطعة المطلوبة :'}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'any', ar: 'الكل', fr: 'Tout' },
                    { id: 'new', ar: 'جديدة', fr: 'Neuve' },
                    { id: 'used', ar: 'مستعملة', fr: 'Occasion' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPartConditionPref(c.id as 'any' | 'new' | 'used')}
                      className={`min-h-[44px] px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        partConditionPref === c.id
                          ? 'bg-ink text-primary border-ink'
                          : 'bg-white text-steel-700 border-steel-300 hover:bg-steel-50'
                      }`}
                    >
                      {lang === 'fr' ? c.fr : c.ar}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Reference Location Choice: Two Buttons (1. Machine location vs 2. Custom map location) */}
            <div className="space-y-3">
              <label className="text-xs font-black text-ink flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary-dark shrink-0" />
                <span>
                  {lang === 'fr'
                    ? 'Souhaitez-vous que la pièce soit proche de :'
                    : 'هل تريد قطعة الغيار أن تكون قريبة لـ :'}
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Button 1: Machine Location */}
                <button
                  type="button"
                  onClick={() => setLocationMode('machine')}
                  className={`p-3 rounded-2xl border text-start transition-all min-h-[56px] cursor-pointer flex items-center gap-2.5 ${
                    locationMode === 'machine'
                      ? 'bg-ink text-white border-ink ring-2 ring-primary shadow-sm'
                      : 'bg-white text-ink border-steel-200 hover:border-steel-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      locationMode === 'machine'
                        ? 'bg-primary text-ink'
                        : 'bg-steel-100 text-steel-700'
                    }`}
                  >
                    1
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black block">
                      {lang === 'fr' ? 'Emplacement de l’engin' : 'مكان الآلية'}
                    </span>
                    <span
                      className={`text-[11px] block truncate ${
                        locationMode === 'machine' ? 'text-steel-300' : 'text-steel-500'
                      }`}
                    >
                      {machine.city || 'المغرب'}{' '}
                      <span dir="ltr" className="font-mono text-[10px]">
                        ({machineCoords.lat.toFixed(3)}, {machineCoords.lng.toFixed(3)})
                      </span>
                    </span>
                  </div>
                </button>

                {/* Button 2: Custom Location on Map */}
                <button
                  type="button"
                  onClick={() => setLocationMode('custom')}
                  className={`p-3 rounded-2xl border text-start transition-all min-h-[56px] cursor-pointer flex items-center gap-2.5 ${
                    locationMode === 'custom'
                      ? 'bg-ink text-white border-ink ring-2 ring-primary shadow-sm'
                      : 'bg-white text-ink border-steel-200 hover:border-steel-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      locationMode === 'custom'
                        ? 'bg-primary text-ink'
                        : 'bg-steel-100 text-steel-700'
                    }`}
                  >
                    2
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black block">
                      {lang === 'fr' ? 'Autre lieu (choisir sur carte)' : 'مكان آخر (تحديده في الخريطة)'}
                    </span>
                    <span
                      className={`text-[11px] block truncate ${
                        locationMode === 'custom' ? 'text-steel-300' : 'text-steel-500'
                      }`}
                    >
                      {lang === 'fr'
                        ? 'Atelier, chantier ou position GPS'
                        : 'ورشة إصلاح، مدينة أو نقطة أخرى'}
                    </span>
                  </div>
                </button>
              </div>

              {locationMode === 'custom' && (
                <div className="p-3 rounded-2xl bg-steel-50 border border-steel-200 space-y-2">
                  <MapLocationPicker
                    lat={customLat}
                    lng={customLng}
                    cityId={customCityId}
                    showGpsButton={true}
                    mapHeightClass="h-52 sm:h-60"
                    instructionText={
                      lang === 'fr'
                        ? 'Cliquez sur la carte ou déplacez le marqueur vers le lieu souhaité'
                        : 'انقر على الخريطة أو اسحب العلامة لتحديد المكان المرجعي للبحث عن قطعة الغيار'
                    }
                    onLocationChange={(newLat, newLng, newCityId) => {
                      setCustomLat(newLat);
                      setCustomLng(newLng);
                      if (newCityId) setCustomCityId(newCityId);
                    }}
                  />
                </div>
              )}
            </div>

            {/* 4. Search Radius + Nationwide Option */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-black text-ink flex items-center gap-1.5">
                  <Radar className="w-4 h-4 text-primary-dark shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Diamètre / Rayon de recherche :'
                      : 'قطر منطقة البحث عن الموردين :'}
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
                  <span>{lang === 'fr' ? 'Tout Maroc' : 'المغرب كاملاً'}</span>
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

            {/* 5. Optional Details */}
            <div>
              <label className="text-xs font-bold text-steel-700 block mb-1.5">
                {lang === 'fr'
                  ? 'Précisions supplémentaires (nom de la pièce, urgence, livraison...)'
                  : 'تفاصيل إضافية للموردين (اسم القطعة، الاستعجال، التوصيل...)'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  lang === 'fr'
                    ? 'Ex: Pompe hydraulique principale pour JCB 3CX 2022, besoin urgent avec livraison...'
                    : 'مثال: فلتر أو مضخة هيدروليك أصلية لآلية JCB 3CX، الحاجة مستعجلة مع إمكانية التوصيل...'
                }
                className="w-full px-3 py-2 text-xs border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 6. Live Match Scan Summary */}
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
                  <Navigation className="w-5 h-5 text-amber-700 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-black">
                    {isScanning
                      ? lang === 'fr'
                        ? 'Recherche des fournisseurs dans le périmètre...'
                        : 'جاري مسح موردي قطع الغيار في النطاق...'
                      : lang === 'fr'
                      ? `${matchedTargets.length} fournisseur(s) de pièces détecté(s)`
                      : `تم رصد ${matchedTargets.length} مورد(ين) لقطع الغيار داخل النطاق`}
                  </p>
                  {!isScanning && matchedTargets.length > 0 && (
                    <p className="text-[11px] opacity-85 truncate tabular-nums">
                      {exactRefCount > 0
                        ? lang === 'fr'
                          ? `${exactRefCount} correspondance(s) exacte(s) Réf · `
                          : `${exactRefCount} مطابقة تامة للمرجع · `
                        : ''}
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
                ? `Lancer l’alerte pièce (${matchedTargets.length})`
                : `إرسال الحملة الآن (${matchedTargets.length})`}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default SparePartDispatchModal;
