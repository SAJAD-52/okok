// ============================================================================
// JADIJCB: Machinery Purchase & International Import Dispatch Modal
// Allows equipment owners to broadcast a machine purchase / import search
// campaign to Moroccan machinery dealers AND international import companies.
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Ship,
  MapPin,
  Radar,
  Globe,
  Send,
  Loader2,
  CheckCircle2,
  Building2,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { DispatchCampaign } from '../../types/database';
import { MOROCCAN_CITIES } from '../../data/cities';
import { EQUIPMENT_CATEGORIES } from '../../data/categories';
import { IMPORT_ORIGIN_COUNTRIES, getImportCountryLabel } from '../../data/supplierOptions';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { MapLocationPicker } from './MapLocationPicker';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import {
  findMatchingMachinerySuppliersForCampaign,
  launchDispatchCampaign,
  MatchedOwnerTarget,
} from '../../lib/dispatchService';
import { formatDistanceKm } from '../../lib/geoUtils';

interface MachinePurchaseDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignLaunched: (campaign: DispatchCampaign) => void;
}

const PRESET_RADII = [30, 60, 120, 250];

const MACHINERY_CATS = EQUIPMENT_CATEGORIES.filter((c) => c.id !== 'spare-parts');

export const MachinePurchaseDispatchModal: React.FC<MachinePurchaseDispatchModalProps> = ({
  isOpen,
  onClose,
  onCampaignLaunched,
}) => {
  const { lang, t } = useLanguage();
  const { user, profile } = useAuth();

  const [machineCategory, setMachineCategory] = useState<string>('excavator');
  const [machineName, setMachineName] = useState<string>('');
  const [desiredCondition, setDesiredCondition] = useState<'any' | 'new' | 'used' | 'import'>('any');
  const [budgetMad, setBudgetMad] = useState<string>('');
  const [importAllowed, setImportAllowed] = useState<boolean>(true);
  const [preferredOrigin, setPreferredOrigin] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [cityId, setCityId] = useState<string>('casablanca');
  const [lat, setLat] = useState<number>(33.5731);
  const [lng, setLng] = useState<number>(-7.5898);
  const [showMapPicker, setShowMapPicker] = useState<boolean>(false);

  const [radiusKm, setRadiusKm] = useState<number>(120);
  const [isNationwide, setIsNationwide] = useState<boolean>(true);

  const [matchedTargets, setMatchedTargets] = useState<MatchedOwnerTarget[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setMachineCategory('excavator');
    setMachineName('');
    setDesiredCondition('any');
    setBudgetMad('');
    setImportAllowed(true);
    setPreferredOrigin('');
    setNotes('');
    setShowMapPicker(false);
    setIsNationwide(true);
    setRadiusKm(120);

    const profileCity = MOROCCAN_CITIES.find(
      (c) =>
        c.id === profile?.city_id ||
        c.name_ar === profile?.city ||
        c.name_fr === profile?.city
    );
    if (profileCity) {
      setCityId(profileCity.id);
      setLat(profileCity.lat);
      setLng(profileCity.lng);
    } else {
      setCityId('casablanca');
      setLat(33.5731);
      setLng(-7.5898);
    }
  }, [isOpen, profile?.city, profile?.city_id]);

  const activeCity = useMemo(() => {
    return MOROCCAN_CITIES.find((c) => c.id === cityId) || MOROCCAN_CITIES[0];
  }, [cityId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsScanning(true);
      try {
        const targets = await findMatchingMachinerySuppliersForCampaign({
          originLat: lat,
          originLng: lng,
          machineCategory,
          machineName,
          desiredCondition,
          importAllowed: desiredCondition === 'import' ? true : importAllowed,
          preferredOrigin,
          radiusKm: isNationwide ? null : radiusKm,
          isNationwide,
          excludeOwnerId: user?.id || profile?.id,
        });
        if (!cancelled) setMatchedTargets(targets);
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
    lat,
    lng,
    machineCategory,
    machineName,
    desiredCondition,
    importAllowed,
    preferredOrigin,
    radiusKm,
    isNationwide,
    user?.id,
    profile?.id,
  ]);

  if (!isOpen) return null;

  const importerCount = matchedTargets.filter((t) => t.is_importer).length;
  const localDealerCount = matchedTargets.length - importerCount;

  const requesterName =
    profile?.company_name?.trim() ||
    profile?.full_name?.trim() ||
    (lang === 'fr' ? 'Propriétaire d’engins' : 'مالك آليات');

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = machineName.trim();
    const catObj = MACHINERY_CATS.find((c) => c.id === machineCategory);
    const resolvedTitle =
      cleanName ||
      (catObj ? (lang === 'fr' ? catObj.name_fr : catObj.name_ar) : 'آلية ثقيلة');

    setIsSending(true);
    try {
      const effectiveImportAllowed = desiredCondition === 'import' ? true : importAllowed;
      const targets = await findMatchingMachinerySuppliersForCampaign({
        originLat: lat,
        originLng: lng,
        machineCategory,
        machineName: resolvedTitle,
        desiredCondition,
        importAllowed: effectiveImportAllowed,
        preferredOrigin,
        radiusKm: isNationwide ? null : radiusKm,
        isNationwide,
        excludeOwnerId: user?.id || profile?.id,
      });

      const parsedBudget = Number(budgetMad);
      const cleanBudget = Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : null;

      const condLabel =
        desiredCondition === 'new'
          ? lang === 'fr'
            ? 'État : Neuve'
            : 'الحالة المطلوبة: جديدة'
          : desiredCondition === 'used'
          ? lang === 'fr'
            ? 'État : Occasion'
            : 'الحالة المطلوبة: مستعملة'
          : desiredCondition === 'import'
          ? lang === 'fr'
            ? 'Mode : Importation directe'
            : 'الحالة المطلوبة: استيراد مباشر من الخارج'
          : '';

      const originLabel = preferredOrigin
        ? `${lang === 'fr' ? 'Origine souhaitée :' : 'البلد / المصدر المفضل:'} ${getImportCountryLabel(
            preferredOrigin,
            lang
          )}`
        : '';

      const combinedNotes = [condLabel, originLabel, notes.trim()].filter(Boolean).join(' · ');

      const cityDisplay = activeCity
        ? lang === 'fr'
          ? activeCity.name_fr
          : activeCity.name_ar
        : cityId;

      const { campaign } = await launchDispatchCampaign({
        contractorId: user?.id || profile?.id || 'owner-guest',
        companyName: requesterName,
        campaignType: 'machine_purchase',
        budgetMad: cleanBudget,
        importAllowed: effectiveImportAllowed,
        preferredOrigin: preferredOrigin || '',
        desiredCondition,
        siteName: `${lang === 'fr' ? 'Livraison à' : 'التسليم في'} ${cityDisplay}`,
        siteCity: cityDisplay,
        siteLat: lat,
        siteLng: lng,
        sitePhone: profile?.phone || '',
        machineCategory,
        machineName: resolvedTitle,
        radiusKm: isNationwide ? null : radiusKm,
        isNationwide,
        notes: combinedNotes,
        targets,
      });

      toast.success(
        targets.length > 0
          ? lang === 'fr'
            ? `Campagne envoyée à ${targets.length} fournisseur(s) & importateur(s) !`
            : `تم إطلاق حملة البحث عن الشراء وإشعار ${targets.length} مورد وشركة استيراد!`
          : lang === 'fr'
          ? 'Campagne publiée sur le portail fournisseurs & importateurs !'
          : 'تم نشر طلب الشراء في بوابة الموردين وشركات الاستيراد بنجاح!'
      );

      onCampaignLaunched(campaign);
      onClose();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border border-steel-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-ink text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary text-ink flex items-center justify-center shrink-0">
              <Ship className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white truncate">
                {lang === 'fr'
                  ? 'Campagne Achat / Import d’Engin'
                  : 'إطلاق حملة شراء آلية أو استيرادها من الخارج'}
              </h2>
              <p className="text-xs text-steel-300 truncate mt-0.5">
                {lang === 'fr'
                  ? 'Diffusez votre besoin aux concessionnaires au Maroc et importateurs internationaux'
                  : 'أرسل مواصفات الآلية لموردي الآليات بالمغرب وشركات الاستيراد من أوروبا وآسيا'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl text-steel-300 hover:text-white hover:bg-steel-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleLaunch} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* 1. Machine Category & Exact Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Catégorie d’engin :' : 'صنف الآلية المطلوبة :'}
                </label>
                <select
                  value={machineCategory}
                  onChange={(e) => setMachineCategory(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                >
                  {MACHINERY_CATS.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {lang === 'fr' ? cat.name_fr : cat.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr'
                    ? 'Marque, modèle ou année souhaitée :'
                    : 'الماركة، الموديل أو السنة المطلوبة :'}
                </label>
                <input
                  type="text"
                  required
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  placeholder={
                    lang === 'fr'
                      ? 'Ex: JCB 3CX 2021 / CAT 320D'
                      : 'مثال: JCB 3CX / CAT 320D موديل 2020+'
                  }
                  className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                />
              </div>
            </div>

            {/* 2. Condition & Budget */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Condition & Provenance :' : 'الحالة المطلوبة :'}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'any', ar: 'الكل (جديد/مستعمل)', fr: 'Tout' },
                    { id: 'new', ar: 'جديدة', fr: 'Neuve' },
                    { id: 'used', ar: 'مستعملة بالمغرب', fr: 'Occasion' },
                    { id: 'import', ar: 'استيراد من الخارج', fr: 'Import direct' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const next = opt.id as 'any' | 'new' | 'used' | 'import';
                        setDesiredCondition(next);
                        if (next === 'import') setImportAllowed(true);
                      }}
                      className={`min-h-[42px] px-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                        desiredCondition === opt.id
                          ? 'bg-ink text-primary border-ink'
                          : 'bg-white text-steel-700 border-steel-300 hover:bg-steel-50'
                      }`}
                    >
                      {lang === 'fr' ? opt.fr : opt.ar}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr'
                    ? 'Budget approximatif (MAD) — optionnel :'
                    : 'الميزانية التقريبية (درهم) — اختياري :'}
                </label>
                <input
                  type="number"
                  min={0}
                  dir="ltr"
                  value={budgetMad}
                  onChange={(e) => setBudgetMad(e.target.value)}
                  placeholder="450000"
                  className="w-full px-3.5 py-2.5 text-sm font-mono font-black bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                />
              </div>
            </div>

            {/* 3. International Import Toggle & Origin Country */}
            <div className="p-4 rounded-2xl bg-steel-50 border border-steel-200 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={desiredCondition === 'import' ? true : importAllowed}
                  disabled={desiredCondition === 'import'}
                  onChange={(e) => setImportAllowed(e.target.checked)}
                  className="w-5 h-5 mt-0.5 accent-ink cursor-pointer shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-black text-ink flex items-center gap-1.5">
                    <Ship className="w-4 h-4 text-primary-dark shrink-0" />
                    <span>
                      {lang === 'fr'
                        ? 'Envoyer aussi aux sociétés d’importation internationale'
                        : 'إرسال الطلب أيضاً لشركات الاستيراد من الخارج'}
                    </span>
                  </div>
                  <p className="text-[11px] text-steel-600 mt-0.5 leading-relaxed">
                    {lang === 'fr'
                      ? 'Recevez des devis clé en main avec fret maritime et dédouanement depuis l’Europe, la Chine ou le Golfe.'
                      : 'استقبل عروض استيراد جاهزة بالشحن والتعشير الجمركي مباشرة من أوروبا، الصين، تركيا أو الخليج.'}
                  </p>
                </div>
              </label>

              {(importAllowed || desiredCondition === 'import') && (
                <div>
                  <label className="text-[11px] font-black text-steel-700 block mb-1.5">
                    {lang === 'fr'
                      ? 'Pays / Zone d’importation préférée (optionnel) :'
                      : 'دولة / مصدر الاستيراد المفضل (اختياري) :'}
                  </label>
                  <select
                    value={preferredOrigin}
                    onChange={(e) => setPreferredOrigin(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  >
                    <option value="">
                      {lang === 'fr'
                        ? 'Toutes les provenances (Europe, Chine, Turquie...)'
                        : 'جميع مصادر الاستيراد (أوروبا، الصين، تركيا، الخليج...)'}
                    </option>
                    {IMPORT_ORIGIN_COUNTRIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.flag} {lang === 'fr' ? c.nameFr : c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 4. Delivery City & Radius */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-black text-ink flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary-dark shrink-0" />
                  <span>
                    {lang === 'fr' ? 'Ville de livraison au Maroc :' : 'مدينة التسليم بالمغرب :'}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowMapPicker((v) => !v)}
                  className="text-xs font-black text-primary-dark hover:underline cursor-pointer"
                >
                  {showMapPicker
                    ? lang === 'fr'
                      ? 'Masquer la carte'
                      : 'إخفاء الخريطة'
                    : lang === 'fr'
                    ? 'Ajuster sur la carte'
                    : 'تحديد دقيق على الخريطة'}
                </button>
              </div>

              <select
                value={cityId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setCityId(nextId);
                  const found = MOROCCAN_CITIES.find((c) => c.id === nextId);
                  if (found) {
                    setLat(found.lat);
                    setLng(found.lng);
                  }
                }}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              >
                {MOROCCAN_CITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {lang === 'fr' ? c.name_fr : c.name_ar}
                  </option>
                ))}
              </select>

              {showMapPicker && (
                <div className="p-3 rounded-2xl bg-steel-50 border border-steel-200">
                  <MapLocationPicker
                    lat={lat}
                    lng={lng}
                    cityId={cityId}
                    showGpsButton={true}
                    mapHeightClass="h-48"
                    onLocationChange={(newLat, newLng, newCityId) => {
                      setLat(newLat);
                      setLng(newLng);
                      if (newCityId) setCityId(newCityId);
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setIsNationwide(true)}
                  className={`min-h-[44px] px-2.5 rounded-xl text-xs font-black border transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    isNationwide
                      ? 'bg-primary text-ink border-ink'
                      : 'bg-white text-steel-700 border-steel-300 hover:bg-steel-50'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'fr' ? 'Tout Maroc' : 'كل المغرب'}</span>
                </button>

                {PRESET_RADII.map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => {
                      setIsNationwide(false);
                      setRadiusKm(km);
                    }}
                    className={`min-h-[44px] px-2.5 rounded-xl text-xs font-black border transition-colors cursor-pointer tabular-nums whitespace-nowrap ${
                      !isNationwide && radiusKm === km
                        ? 'bg-ink text-primary border-ink'
                        : 'bg-white text-steel-700 border-steel-300 hover:bg-steel-50'
                    }`}
                  >
                    {km} {lang === 'fr' ? 'km' : 'كم'}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Technical Notes */}
            <div>
              <label className="text-xs font-black text-ink block mb-1.5">
                {lang === 'fr'
                  ? 'Spécifications complémentaires (heures max, équipements, port) :'
                  : 'مواصفات إضافية (عدد الساعات الأقصى، الملحقات المطلوبة، طريقة الأداء) :'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  lang === 'fr'
                    ? 'Ex: Moins de 6000h, avec ligne BRH, livraison souhaitée sous 30 jours...'
                    : 'مثال: أقل من 6000 ساعة عمل، مجهزة بخط مارتو، الدفع عند المعاينة أو عبر اعتمادات...'
                }
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 6. Live Supplier Match Preview */}
            <div className="p-3.5 rounded-2xl bg-steel-50 border border-steel-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white border border-steel-200 flex items-center justify-center shrink-0">
                  {isScanning ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary-dark" />
                  ) : (
                    <Radar className="w-4 h-4 text-primary-dark" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-ink">
                    {isScanning
                      ? lang === 'fr'
                        ? 'Recherche des vendeurs et importateurs...'
                        : 'جاري مسح الموردين وشركات الاستيراد...'
                      : lang === 'fr'
                      ? `${matchedTargets.length} fournisseur(s) & importateur(s) détecté(s)`
                      : `سيتم إشعار ${matchedTargets.length} بائع وشركة استيراد مطابقة`}
                  </p>
                  {!isScanning && matchedTargets.length > 0 && (
                    <p className="text-[11px] text-steel-600 font-bold tabular-nums">
                      {lang === 'fr'
                        ? `${localDealerCount} au Maroc · ${importerCount} importateur(s)`
                        : `${localDealerCount} داخل المغرب · ${importerCount} شركة استيراد`}
                      {matchedTargets[0]?.distance_km > 0
                        ? ` · ${formatDistanceKm(matchedTargets[0].distance_km, lang)}`
                        : ''}
                    </p>
                  )}
                </div>
              </div>
              {matchedTargets.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === 'fr' ? 'Prêt à diffuser' : 'جاهز للبث الفوري'}</span>
                </span>
              )}
            </div>
          </div>

          {/* Footer CTA */}
          <div className="px-4 sm:px-6 py-3.5 bg-steel-50 border-t border-steel-200 flex items-center justify-between gap-3 shrink-0">
            <Button type="button" variant="outline" size="md" onClick={onClose} className="min-h-[44px]">
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSending}
              leftIcon={isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              className="min-h-[44px] font-black"
            >
              {isSending
                ? lang === 'fr'
                  ? 'Envoi en cours...'
                  : 'جاري الإطلاق...'
                : lang === 'fr'
                ? 'Diffuser la demande d’achat'
                : 'إطلاق حملة البحث عن آلية'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MachinePurchaseDispatchModal;
