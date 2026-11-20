// ============================================================================
// JADIJCB: Guided Owner -> Supplier Search Campaign Modal ("حملة بحث جديدة")
// Step-by-step wizard:
//   1. Choose between "آلية" (Machinery Purchase/Import) or "قطعة غيار" (Spare Part)
//   2. If آلية: Name, Category, Model/Year, Condition, Customs ("الديوانة"), Origin, City, Notes
//   3. If قطعة غيار: Ask "هل قطعة الغيار لآلية في أسطولك؟"
//      - نعم: Custom dropdown with mini thumbnails of Owner's fleet machines
//      - لا: Manual part + machine compatibility inputs
//   4. Broadcast live notifications to matching suppliers & importers
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Truck,
  Wrench,
  Ship,
  Globe,
  Send,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ShieldCheck,
  MapPin,
  Hash,
  FileCheck2,
  Building2,
  Radar,
} from 'lucide-react';
import { DispatchCampaign, Machine } from '../../types/database';
import { MOROCCAN_CITIES } from '../../data/cities';
import { EQUIPMENT_CATEGORIES } from '../../data/categories';
import { IMPORT_ORIGIN_COUNTRIES, getImportCountryLabel } from '../../data/supplierOptions';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { machineStore } from '../../lib/machineStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  findMatchingMachinerySuppliersForCampaign,
  findMatchingSparePartSuppliersForCampaign,
  launchDispatchCampaign,
  MatchedOwnerTarget,
  resolveMachineCoordinates,
} from '../../lib/dispatchService';
import { formatDistanceKm } from '../../lib/geoUtils';

export type SearchNeedType = 'machine_purchase' | 'spare_part';

interface SupplierSearchCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNeedType?: SearchNeedType | null;
  onCampaignLaunched: (campaign: DispatchCampaign) => void;
}

const MACHINERY_CATS = EQUIPMENT_CATEGORIES.filter((c) => c.id !== 'spare-parts');
const PRESET_RADII = [30, 80, 150, 300];

const PART_TYPE_OPTIONS = [
  { value: 'all', ar: 'جميع أصناف قطع الغيار', fr: 'Toutes catégories de pièces' },
  { value: 'filters', ar: 'فلاتر وزيوت وتشحيم', fr: 'Filtres & Lubrifiants' },
  { value: 'hydraulic', ar: 'هيدروليك، مضخات وخراطيم', fr: 'Hydraulique (Pompes, Flexibles)' },
  { value: 'engine', ar: 'محركات وناقل الحركة', fr: 'Moteurs & Boîtes de vitesse' },
  { value: 'teeth', ar: 'أسنان وشفرات كباش', fr: 'Dents & Lames de godet' },
  { value: 'tracks', ar: 'جنازير وعجلات', fr: 'Chenilles & Galets' },
  { value: 'electric', ar: 'كهرباء وبطاريات', fr: 'Électricité & Batteries' },
  { value: 'attachments', ar: 'كواسر هيدروليكية BRH', fr: 'Brise-roche & Équipements' },
  { value: 'other', ar: 'قطع ومستلزمات أخرى', fr: 'Autres composants' },
];

export const SupplierSearchCampaignModal: React.FC<SupplierSearchCampaignModalProps> = ({
  isOpen,
  onClose,
  initialNeedType = null,
  onCampaignLaunched,
}) => {
  const { lang } = useLanguage();
  const { user, profile } = useAuth();
  const ownerId = user?.id || profile?.id || '';

  // Primary choice: null (ask) | 'machine_purchase' | 'spare_part'
  const [needType, setNeedType] = useState<SearchNeedType | null>(initialNeedType);

  // Fleet machines for "هل قطعة الغيار لآلية في أسطولك؟"
  const [fleetMachines, setFleetMachines] = useState<Machine[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(false);
  const [hasFleetMachine, setHasFleetMachine] = useState<boolean | null>(null);
  const [selectedFleetMachineId, setSelectedFleetMachineId] = useState<string>('');
  const [isFleetDropdownOpen, setIsFleetDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Machine purchase fields
  const [machineCategory, setMachineCategory] = useState<string>('excavator');
  const [machineName, setMachineName] = useState<string>('');
  const [desiredModel, setDesiredModel] = useState<string>('');
  const [desiredCondition, setDesiredCondition] = useState<'any' | 'new' | 'used' | 'import'>('any');
  const [customsClearance, setCustomsClearance] = useState<boolean>(true);
  const [importAllowed, setImportAllowed] = useState<boolean>(true);
  const [preferredOrigin, setPreferredOrigin] = useState<string>('');
  const [budgetMad, setBudgetMad] = useState<string>('');

  // Spare part fields
  const [partName, setPartName] = useState<string>('');
  const [partReference, setPartReference] = useState<string>('');
  const [partCategory, setPartCategory] = useState<string>('all');
  const [manualMachineLabel, setManualMachineLabel] = useState<string>('');
  const [partCondition, setPartCondition] = useState<'any' | 'new' | 'used'>('any');

  // Common location & notes
  const [cityId, setCityId] = useState<string>('casablanca');
  const [isNationwide, setIsNationwide] = useState<boolean>(true);
  const [radiusKm, setRadiusKm] = useState<number>(150);
  const [notes, setNotes] = useState<string>('');

  // Matching & submission state
  const [matchedTargets, setMatchedTargets] = useState<MatchedOwnerTarget[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);

  // Sync initial prop & reset when opening
  useEffect(() => {
    if (!isOpen) return;
    setNeedType(initialNeedType ?? null);
    setHasFleetMachine(null);
    setSelectedFleetMachineId('');
    setIsFleetDropdownOpen(false);
    setMachineCategory('excavator');
    setMachineName('');
    setDesiredModel('');
    setDesiredCondition('any');
    setCustomsClearance(true);
    setImportAllowed(true);
    setPreferredOrigin('');
    setBudgetMad('');
    setPartName('');
    setPartReference('');
    setPartCategory('all');
    setManualMachineLabel('');
    setPartCondition('any');
    setIsNationwide(true);
    setNotes('');

    if (profile?.city) {
      const matchedCity = MOROCCAN_CITIES.find(
        (c) =>
          c.nameAr === profile.city ||
          c.nameFr.toLowerCase() === String(profile.city).toLowerCase()
      );
      if (matchedCity) setCityId(matchedCity.id);
    }
  }, [isOpen, initialNeedType, profile?.city]);

  // Close custom fleet dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsFleetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Load Owner's fleet machines when spare part is selected
  useEffect(() => {
    if (!isOpen || !ownerId) return;
    let cancelled = false;
    setIsLoadingFleet(true);

    const loadFleet = async () => {
      const cached = machineStore
        .getCachedMachines()
        .filter((m) => m.owner_id === ownerId && m.category !== 'spare-parts');
      let result: Machine[] = cached;

      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase
            .from('machines')
            .select('*')
            .eq('owner_id', ownerId)
            .neq('category', 'spare-parts')
            .order('created_at', { ascending: false });
          if (data && data.length > 0) {
            result = data as Machine[];
          }
        } catch {
          // keep cache
        }
      }

      if (!cancelled) {
        setFleetMachines(result);
        setIsLoadingFleet(false);
      }
    };

    loadFleet();
    return () => {
      cancelled = true;
    };
  }, [isOpen, ownerId]);

  const selectedFleetMachine = useMemo(
    () => fleetMachines.find((m) => m.id === selectedFleetMachineId) || null,
    [fleetMachines, selectedFleetMachineId]
  );

  // Resolve origin coordinates (from selected fleet machine or chosen city)
  const originCoords = useMemo(() => {
    if (needType === 'spare_part' && hasFleetMachine && selectedFleetMachine) {
      const mCoords = resolveMachineCoordinates(selectedFleetMachine);
      if (mCoords) {
        return {
          lat: mCoords.lat,
          lng: mCoords.lng,
          cityName: selectedFleetMachine.city || profile?.city || 'المغرب',
        };
      }
    }
    const cityObj = MOROCCAN_CITIES.find((c) => c.id === cityId) || MOROCCAN_CITIES[0];
    return {
      lat: cityObj.lat,
      lng: cityObj.lng,
      cityName: lang === 'fr' ? cityObj.nameFr : cityObj.nameAr,
    };
  }, [needType, hasFleetMachine, selectedFleetMachine, cityId, lang, profile?.city]);

  // Live scan of matching suppliers & importers
  useEffect(() => {
    if (!isOpen || !needType) {
      setMatchedTargets([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsScanning(true);
      try {
        if (needType === 'machine_purchase') {
          const catObj = MACHINERY_CATS.find((c) => c.id === machineCategory);
          const effectiveName =
            machineName.trim() || (lang === 'fr' ? catObj?.name_fr : catObj?.name_ar) || 'آلية بناء';
          const found = await findMatchingMachinerySuppliersForCampaign({
            originLat: originCoords.lat,
            originLng: originCoords.lng,
            machineCategory,
            machineName: `${effectiveName} ${desiredModel}`.trim(),
            desiredCondition,
            importAllowed,
            preferredOrigin: preferredOrigin || undefined,
            radiusKm: isNationwide ? null : radiusKm,
            isNationwide,
            excludeOwnerId: ownerId,
          });
          if (!cancelled) setMatchedTargets(found);
        } else {
          const found = await findMatchingSparePartSuppliersForCampaign({
            originLat: originCoords.lat,
            originLng: originCoords.lng,
            partReference: partReference.trim() || partName.trim(),
            partCategory,
            machineBrand: selectedFleetMachine?.brand || manualMachineLabel.trim(),
            machineModel: selectedFleetMachine?.model || '',
            radiusKm: isNationwide ? null : radiusKm,
            isNationwide,
            excludeOwnerId: ownerId,
          });
          if (!cancelled) setMatchedTargets(found);
        }
      } catch {
        if (!cancelled) setMatchedTargets([]);
      } finally {
        if (!cancelled) setIsScanning(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    needType,
    machineCategory,
    machineName,
    desiredModel,
    desiredCondition,
    importAllowed,
    preferredOrigin,
    partName,
    partReference,
    partCategory,
    selectedFleetMachine,
    manualMachineLabel,
    originCoords.lat,
    originCoords.lng,
    isNationwide,
    radiusKm,
    ownerId,
    lang,
  ]);

  if (!isOpen) return null;

  const getMachineThumb = (m: Machine | null): string => {
    if (!m) return '';
    const imgs = Array.isArray(m.images) ? m.images : [];
    return imgs[0] || '';
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!needType) return;

    if (!ownerId) {
      toast.error(lang === 'fr' ? 'Veuillez vous reconnecter' : 'يرجى تسجيل الدخول أولاً');
      return;
    }

    if (needType === 'machine_purchase') {
      if (!machineName.trim()) {
        toast.error(
          lang === 'fr'
            ? 'Veuillez préciser le nom ou le modèle de l’engin recherché'
            : 'يرجى إدخال اسم الآلية المطلوبة'
        );
        return;
      }
    } else {
      if (hasFleetMachine === null) {
        toast.error(
          lang === 'fr'
            ? 'Précisez si la pièce concerne un engin de votre flotte'
            : 'يرجى تحديد هل قطعة الغيار لآلية في أسطولك أم لا'
        );
        return;
      }
      if (hasFleetMachine && !selectedFleetMachine) {
        toast.error(
          lang === 'fr'
            ? 'Veuillez sélectionner l’engin dans votre flotte'
            : 'يرجى اختيار الآلية من قائمة أسطولك'
        );
        return;
      }
      if (!partName.trim() && !partReference.trim()) {
        toast.error(
          lang === 'fr'
            ? 'Veuillez saisir le nom ou la référence de la pièce'
            : 'يرجى إدخال اسم قطعة الغيار أو رقمها المرجعي (Réf)'
        );
        return;
      }
    }

    setIsLaunching(true);
    try {
      const companyName =
        profile?.company_name?.trim() ||
        profile?.full_name?.trim() ||
        (lang === 'fr' ? 'Propriétaire JADIJCB' : 'مالك آليات JADIJCB');

      const sitePhone =
        profile?.phone ||
        (user?.user_metadata as any)?.phone ||
        '+212600000000';

      if (needType === 'machine_purchase') {
        const parsedBudget = budgetMad.trim() ? Number(budgetMad.trim()) : null;
        const cleanTitle = machineName.trim();
        const combinedNotes = [
          desiredModel.trim() ? `الموديل المطلوب: ${desiredModel.trim()}` : '',
          customsClearance
            ? 'الديوانة: مع التخليص الجمركي بالمغرب (مُعشّرة)'
            : 'الديوانة: بدون تعشير أو تسليم حر / متوفرة محلياً',
          notes.trim(),
        ]
          .filter(Boolean)
          .join(' · ');

        const res = await launchDispatchCampaign({
          contractorId: ownerId,
          companyName,
          campaignType: 'machine_purchase',
          desiredModel: desiredModel.trim() || undefined,
          customsClearance,
          budgetMad: parsedBudget && Number.isFinite(parsedBudget) ? parsedBudget : null,
          importAllowed,
          preferredOrigin: preferredOrigin || undefined,
          desiredCondition,
          siteName: originCoords.cityName,
          siteCity: originCoords.cityName,
          siteLat: originCoords.lat,
          siteLng: originCoords.lng,
          sitePhone,
          machineCategory,
          machineName: cleanTitle,
          radiusKm: isNationwide ? null : radiusKm,
          isNationwide,
          notes: combinedNotes,
          targets: matchedTargets,
        });

        toast.success(
          matchedTargets.length > 0
            ? lang === 'fr'
              ? `Campagne lancée ! ${matchedTargets.length} fournisseur(s) notifié(s).`
              : `تم إطلاق حملة البحث بنجاح وإشعار ${matchedTargets.length} مورد/مستورد!`
            : lang === 'fr'
            ? 'Campagne publiée dans la bourse des fournisseurs !'
            : 'تم نشر حملة البحث في بورصة الموردين بنجاح!'
        );
        onCampaignLaunched(res.campaign);
        onClose();
      } else {
        const fleetTitle = selectedFleetMachine
          ? selectedFleetMachine.title_ar ||
            selectedFleetMachine.title_fr ||
            `${selectedFleetMachine.brand || ''} ${selectedFleetMachine.model || ''}`.trim()
          : '';
        const fleetImg = getMachineThumb(selectedFleetMachine);
        const targetLabel = hasFleetMachine
          ? fleetTitle
          : manualMachineLabel.trim();

        const resolvedPartTitle = partName.trim()
          ? targetLabel
            ? `${partName.trim()} — ${targetLabel}`
            : partName.trim()
          : targetLabel
          ? `قطعة غيار (${partReference.trim()}) — ${targetLabel}`
          : `قطعة غيار (${partReference.trim()})`;

        const partCondLabel =
          partCondition === 'new'
            ? 'الحالة: جديدة (أصلية)'
            : partCondition === 'used'
            ? 'الحالة: مستعملة (بون أوكازيون)'
            : '';
        const combinedNotes = [
          partCondLabel,
          hasFleetMachine && selectedFleetMachine
            ? `تابعة لآلية الأسطول: ${fleetTitle}`
            : manualMachineLabel.trim()
            ? `متوافقة مع: ${manualMachineLabel.trim()}`
            : '',
          notes.trim(),
        ]
          .filter(Boolean)
          .join(' · ');

        const res = await launchDispatchCampaign({
          contractorId: ownerId,
          companyName,
          campaignType: 'spare_part',
          partReference: partReference.trim() || undefined,
          partCategory,
          desiredCondition: partCondition,
          desiredModel: selectedFleetMachine?.model || manualMachineLabel.trim() || undefined,
          importAllowed: true,
          hasFleetMachine: Boolean(hasFleetMachine && selectedFleetMachine),
          fleetMachineId: selectedFleetMachine?.id,
          fleetMachineTitle: fleetTitle || undefined,
          fleetMachineImage: fleetImg || undefined,
          fleetMachineBrand: selectedFleetMachine?.brand,
          fleetMachineModel: selectedFleetMachine?.model,
          fleetMachineYear: selectedFleetMachine?.year ?? null,
          siteName: originCoords.cityName,
          siteCity: originCoords.cityName,
          siteLat: originCoords.lat,
          siteLng: originCoords.lng,
          sitePhone,
          machineCategory: 'spare-parts',
          machineName: resolvedPartTitle,
          radiusKm: isNationwide ? null : radiusKm,
          isNationwide,
          notes: combinedNotes,
          targets: matchedTargets,
        });

        toast.success(
          matchedTargets.length > 0
            ? lang === 'fr'
              ? `Campagne pièce lancée ! ${matchedTargets.length} fournisseur(s) notifié(s).`
              : `تم إطلاق طلب قطعة الغيار وإشعار ${matchedTargets.length} مورد!`
            : lang === 'fr'
            ? 'Campagne pièce publiée dans la bourse des fournisseurs !'
            : 'تم نشر طلب قطعة الغيار في بورصة الموردين بنجاح!'
        );
        onCampaignLaunched(res.campaign);
        onClose();
      }
    } catch {
      toast.error(
        lang === 'fr' ? 'Erreur lors du lancement de la campagne' : 'تعذر إطلاق حملة البحث حالياً'
      );
    } finally {
      setIsLaunching(false);
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
              <Radar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black truncate">
                {lang === 'fr' ? 'Nouvelle campagne de recherche' : 'حملة بحث جديدة لدى الموردين'}
              </h2>
              <p className="text-xs text-steel-300 truncate mt-0.5">
                {lang === 'fr'
                  ? 'Avertissez instantanément tous les fournisseurs et importateurs concernés'
                  : 'حدد حاجتك ليصلك الرد مباشرة من الموردين وشركات الاستيراد عبر الإشعارات والمحادثة'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl text-steel-300 hover:text-white hover:bg-steel-800 flex items-center justify-center cursor-pointer shrink-0"
            aria-label={lang === 'fr' ? 'Fermer' : 'إغلاق'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleLaunchCampaign} className="p-4 sm:p-6 space-y-5 overflow-y-auto text-start">
          {/* Step 1: Machine vs Spare Part Choice */}
          <div className="space-y-2">
            <label className="text-xs font-black text-ink block">
              {lang === 'fr'
                ? '1. Que recherchez-vous actuellement ?'
                : '1. عمّا تبحث في هذه الحملة؟ (اختر نوع الطلب)'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNeedType('machine_purchase')}
                className={`p-4 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-start gap-3 min-h-[72px] ${
                  needType === 'machine_purchase'
                    ? 'bg-ink text-white border-primary'
                    : 'bg-white text-ink border-steel-200 hover:border-steel-400'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    needType === 'machine_purchase' ? 'bg-primary text-ink' : 'bg-steel-100 text-ink'
                  }`}
                >
                  <Truck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-black block">
                    {lang === 'fr' ? 'Un engin / Machine' : 'آلية بناء (شراء أو استيراد)'}
                  </span>
                  <span
                    className={`text-[11px] block mt-0.5 ${
                      needType === 'machine_purchase' ? 'text-steel-300' : 'text-steel-500'
                    }`}
                  >
                    {lang === 'fr'
                      ? 'Nom, modèle, année & dédouanement'
                      : 'حدد اسم الآلية، الموديل، الحالة والديوانة'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setNeedType('spare_part')}
                className={`p-4 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-start gap-3 min-h-[72px] ${
                  needType === 'spare_part'
                    ? 'bg-ink text-white border-primary'
                    : 'bg-white text-ink border-steel-200 hover:border-steel-400'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    needType === 'spare_part' ? 'bg-primary text-ink' : 'bg-steel-100 text-ink'
                  }`}
                >
                  <Wrench className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-black block">
                    {lang === 'fr' ? 'Une pièce détachée' : 'قطعة غيار (محلي أو استيراد)'}
                  </span>
                  <span
                    className={`text-[11px] block mt-0.5 ${
                      needType === 'spare_part' ? 'text-steel-300' : 'text-steel-500'
                    }`}
                  >
                    {lang === 'fr'
                      ? 'Pour un engin de votre flotte ou autre'
                      : 'لآلية من أسطولك أو قطعة غيار عامة'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* ================================================================ */}
          {/* BRANCH A: آلية (Machine Purchase / Import)                       */}
          {/* ================================================================ */}
          {needType === 'machine_purchase' && (
            <div className="space-y-4 pt-2 border-t border-steel-200">
              {/* Category */}
              <div>
                <label className="text-xs font-black text-ink block mb-2">
                  {lang === 'fr' ? 'Catégorie de l’engin :' : 'صنف الآلية :'}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MACHINERY_CATS.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setMachineCategory(cat.id)}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-black border cursor-pointer transition-colors min-h-[40px] ${
                        machineCategory === cat.id
                          ? 'bg-ink text-primary border-ink'
                          : 'bg-white text-steel-700 border-steel-200 hover:bg-steel-50'
                      }`}
                    >
                      {lang === 'fr' ? cat.name_fr : cat.name_ar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Machine Name & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'Nom de l’engin recherché * :' : 'اسم الآلية المطلوبة * :'}
                  </label>
                  <input
                    type="text"
                    required
                    value={machineName}
                    onChange={(e) => setMachineName(e.target.value)}
                    placeholder={
                      lang === 'fr'
                        ? 'Ex: Tractopelle JCB 3CX / Pelle CAT 320'
                        : 'مثال: تراكس JCB 3CX أو حفارة Caterpillar 320'
                    }
                    className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'Modèle / Année souhaitée :' : 'الموديل / سنة الصنع المطلوبة :'}
                  </label>
                  <input
                    type="text"
                    value={desiredModel}
                    onChange={(e) => setDesiredModel(e.target.value)}
                    placeholder={lang === 'fr' ? 'Ex: 2019 - 2023 / 3CX Eco' : 'مثال: موديل 2019 - 2023 أو 3CX Pro'}
                    className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
              </div>

              {/* Condition & Customs (الديوانة) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'État souhaité :' : 'حالة الآلية :'}
                  </label>
                  <select
                    value={desiredCondition}
                    onChange={(e) => {
                      const val = e.target.value as 'any' | 'new' | 'used' | 'import';
                      setDesiredCondition(val);
                      if (val === 'import') setImportAllowed(true);
                    }}
                    className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  >
                    <option value="any">{lang === 'fr' ? 'Indifférent (Neuf ou Occasion)' : 'الكل (جديدة أو مستعملة)'}</option>
                    <option value="new">{lang === 'fr' ? 'Neuf uniquement' : 'جديدة فقط'}</option>
                    <option value="used">{lang === 'fr' ? 'Occasion vérifiée' : 'مستعملة بحالة جيدة'}</option>
                    <option value="import">{lang === 'fr' ? 'Importation directe de l’étranger' : 'استيراد مباشر من الخارج'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-ink block mb-1.5">
                    {lang === 'fr' ? 'Dédouanement (Diwana) :' : 'وضعية الديوانة والتخليص الجمركي :'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomsClearance(true)}
                      className={`min-h-[44px] px-2.5 rounded-xl text-[11px] font-black border cursor-pointer flex items-center justify-center gap-1.5 ${
                        customsClearance
                          ? 'bg-ink text-primary border-ink'
                          : 'bg-white text-steel-700 border-steel-300'
                      }`}
                    >
                      <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'fr' ? 'Dédouané' : 'مع الديوانة'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomsClearance(false)}
                      className={`min-h-[44px] px-2.5 rounded-xl text-[11px] font-black border cursor-pointer flex items-center justify-center gap-1.5 ${
                        !customsClearance
                          ? 'bg-ink text-primary border-ink'
                          : 'bg-white text-steel-700 border-steel-300'
                      }`}
                    >
                      <Ship className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'fr' ? 'Hors douane' : 'بدون ديوانة / حر'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* International Import & Origin */}
              <div className="bg-steel-50 border border-steel-200 rounded-2xl p-3.5 space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div className="flex items-center gap-2 min-w-0">
                    <Ship className="w-4 h-4 text-primary-dark shrink-0" />
                    <span className="text-xs font-black text-ink">
                      {lang === 'fr'
                        ? 'Inclure les sociétés d’importation internationale'
                        : 'إشعار شركات الاستيراد من الخارج أيضاً (بجانب الموردين المحليين)'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={importAllowed}
                    onChange={(e) => setImportAllowed(e.target.checked)}
                    className="w-4 h-4 accent-ink cursor-pointer"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {importAllowed && (
                    <div>
                      <label className="text-[11px] font-black text-steel-700 block mb-1">
                        {lang === 'fr' ? 'Pays d’origine préféré :' : 'بلد الاستيراد المفضل (اختياري) :'}
                      </label>
                      <select
                        value={preferredOrigin}
                        onChange={(e) => setPreferredOrigin(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                      >
                        <option value="">
                          {lang === 'fr' ? 'Tous pays (Europe, Chine, Turquie...)' : 'أي بلد (أوروبا، الصين، تركيا، الخليج...)'}
                        </option>
                        {IMPORT_ORIGIN_COUNTRIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.flag} {lang === 'fr' ? c.nameFr : c.nameAr}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] font-black text-steel-700 block mb-1">
                      {lang === 'fr' ? 'Budget estimatif (MAD) :' : 'الميزانية التقديرية بالدرهم (اختياري) :'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      dir="ltr"
                      value={budgetMad}
                      onChange={(e) => setBudgetMad(e.target.value)}
                      placeholder="450000"
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* BRANCH B: قطعة غيار (Spare Part — Fleet Question + Custom Select) */}
          {/* ================================================================ */}
          {needType === 'spare_part' && (
            <div className="space-y-4 pt-2 border-t border-steel-200">
              {/* Sub-question: Is this spare part for a machine in your fleet? */}
              <div className="space-y-2">
                <label className="text-xs font-black text-ink block">
                  {lang === 'fr'
                    ? '2. Cette pièce est-elle destinée à un engin de votre flotte ?'
                    : '2. هل قطعة الغيار لآلية موجودة في أسطولك؟'}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setHasFleetMachine(true)}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-black border cursor-pointer transition-colors flex items-center justify-center gap-2 ${
                      hasFleetMachine === true
                        ? 'bg-ink text-primary border-ink'
                        : 'bg-white text-steel-700 border-steel-300 hover:bg-steel-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{lang === 'fr' ? 'Oui, de ma flotte' : 'نعم، لآلية في أسطولي'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasFleetMachine(false);
                      setSelectedFleetMachineId('');
                      setIsFleetDropdownOpen(false);
                    }}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-black border cursor-pointer transition-colors flex items-center justify-center gap-2 ${
                      hasFleetMachine === false
                        ? 'bg-ink text-primary border-ink'
                        : 'bg-white text-steel-700 border-steel-300 hover:bg-steel-50'
                    }`}
                  >
                    <Wrench className="w-4 h-4 shrink-0" />
                    <span>{lang === 'fr' ? 'Non, autre pièce' : 'لا، قطعة غيار أخرى'}</span>
                  </button>
                </div>
              </div>

              {/* Fleet Machine Custom Thumbnail Dropdown (when نعم is chosen) */}
              {hasFleetMachine === true && (
                <div className="space-y-2" ref={dropdownRef}>
                  <label className="text-xs font-black text-ink block">
                    {lang === 'fr'
                      ? 'Sélectionnez la machine concernée dans votre flotte :'
                      : 'اختر الآلية من أسطولك (مع الصورة المصغرة) :'}
                  </label>

                  {isLoadingFleet ? (
                    <div className="p-3 rounded-xl border border-steel-200 text-xs text-steel-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === 'fr' ? 'Chargement de votre flotte...' : 'جاري تحميل آليات أسطولك...'}</span>
                    </div>
                  ) : fleetMachines.length === 0 ? (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                      <p className="font-bold">
                        {lang === 'fr'
                          ? 'Aucun engin trouvé dans votre flotte actuellement.'
                          : 'لا توجد آليات مضافة في أسطولك حالياً. يمكنك اختيار «لا، قطعة غيار أخرى» وإدخال اسم الآلية يدوياً.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setHasFleetMachine(false)}
                        className="px-3 py-1.5 rounded-lg bg-ink text-white text-[11px] font-black cursor-pointer"
                      >
                        {lang === 'fr' ? 'Saisir manuellement' : 'إدخال معلومات القطعة يدوياً'}
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsFleetDropdownOpen((prev) => !prev)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-steel-300 bg-white hover:border-ink transition-colors flex items-center justify-between gap-3 text-start min-h-[54px] cursor-pointer"
                      >
                        {selectedFleetMachine ? (
                          <div className="flex items-center gap-3 min-w-0">
                            {getMachineThumb(selectedFleetMachine) ? (
                              <img
                                src={getMachineThumb(selectedFleetMachine)}
                                alt={selectedFleetMachine.title_ar || selectedFleetMachine.title_fr}
                                className="w-10 h-10 rounded-lg object-cover border border-steel-200 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-steel-100 text-steel-500 flex items-center justify-center shrink-0">
                                <Truck className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-black text-ink block truncate">
                                {selectedFleetMachine.title_ar ||
                                  selectedFleetMachine.title_fr ||
                                  `${selectedFleetMachine.brand} ${selectedFleetMachine.model}`}
                              </span>
                              <span className="text-[11px] text-steel-500 block truncate">
                                {[
                                  selectedFleetMachine.brand,
                                  selectedFleetMachine.model,
                                  selectedFleetMachine.year,
                                  selectedFleetMachine.city,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-steel-500">
                            {lang === 'fr'
                              ? '— Choisir un engin dans la liste —'
                              : '— افتح القائمة واختر الآلية من أسطولك —'}
                          </span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-steel-500 shrink-0 transition-transform ${
                            isFleetDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isFleetDropdownOpen && (
                        <div className="absolute z-30 mt-1.5 w-full bg-white border border-steel-300 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-steel-100">
                          {fleetMachines.map((m) => {
                            const thumb = getMachineThumb(m);
                            const mTitle =
                              m.title_ar ||
                              m.title_fr ||
                              `${m.brand || ''} ${m.model || ''}`.trim() ||
                              'آلية';
                            const isPicked = m.id === selectedFleetMachineId;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setSelectedFleetMachineId(m.id);
                                  setIsFleetDropdownOpen(false);
                                }}
                                className={`w-full px-3.5 py-2.5 flex items-center gap-3 text-start transition-colors cursor-pointer ${
                                  isPicked ? 'bg-amber-50' : 'hover:bg-steel-50'
                                }`}
                              >
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={mTitle}
                                    className="w-11 h-11 rounded-lg object-cover border border-steel-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-lg bg-steel-100 text-steel-500 flex items-center justify-center shrink-0">
                                    <Truck className="w-5 h-5" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-black text-ink block truncate">
                                    {mTitle}
                                  </span>
                                  <span className="text-[11px] text-steel-500 block truncate">
                                    {[m.brand, m.model, m.year, m.city].filter(Boolean).join(' · ')}
                                  </span>
                                </div>
                                {isPicked && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Part details (shown once user answers نعم or لا) */}
              {hasFleetMachine !== null && (
                <div className="space-y-3 pt-1">
                  {hasFleetMachine === false && (
                    <div>
                      <label className="text-xs font-black text-ink block mb-1.5">
                        {lang === 'fr'
                          ? 'Engin / Modèle compatible (optionnel) :'
                          : 'نوع أو موديل الآلية المراد لها القطعة (اختياري) :'}
                      </label>
                      <input
                        type="text"
                        value={manualMachineLabel}
                        onChange={(e) => setManualMachineLabel(e.target.value)}
                        placeholder={
                          lang === 'fr'
                            ? 'Ex: JCB 3CX 2018 / Caterpillar 320D'
                            : 'مثال: JCB 3CX 2018 أو حفارة CAT 320D'
                        }
                        className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-ink block mb-1.5">
                        {lang === 'fr' ? 'Nom de la pièce * :' : 'اسم قطعة الغيار المطلوبة * :'}
                      </label>
                      <input
                        type="text"
                        value={partName}
                        onChange={(e) => setPartName(e.target.value)}
                        placeholder={
                          lang === 'fr'
                            ? 'Ex: Pompe hydraulique / Filtre à huile'
                            : 'مثال: مضخة هيدروليك / فلتر زيت / سن كبش'
                        }
                        className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-ink block mb-1.5 flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5 text-primary-dark" />
                        <span>{lang === 'fr' ? 'Référence (Réf / OEM) :' : 'المرجع الخاص بالقطعة (Réf) :'}</span>
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={partReference}
                        onChange={(e) => setPartReference(e.target.value)}
                        placeholder="Ex: 320/04133"
                        className="w-full px-3.5 py-2.5 text-xs font-mono font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-ink block mb-1.5">
                        {lang === 'fr' ? 'Catégorie de pièce :' : 'صنف قطعة الغيار :'}
                      </label>
                      <select
                        value={partCategory}
                        onChange={(e) => setPartCategory(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
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
                      <select
                        value={partCondition}
                        onChange={(e) => setPartCondition(e.target.value as 'any' | 'new' | 'used')}
                        className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                      >
                        <option value="any">{lang === 'fr' ? 'Neuf ou Occasion' : 'جديدة أو مستعملة'}</option>
                        <option value="new">{lang === 'fr' ? 'Neuf (OEM / Origine)' : 'جديدة أصلية فقط'}</option>
                        <option value="used">{lang === 'fr' ? 'Occasion' : 'مستعملة (أوكازيون)'}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Common City, Radius & Notes (when branch is selected) */}
          {needType && (needType === 'machine_purchase' || hasFleetMachine !== null) && (
            <div className="space-y-4 pt-2 border-t border-steel-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-ink block mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary-dark" />
                    <span>{lang === 'fr' ? 'Ville de livraison :' : 'مدينة التوصيل / التسليم :'}</span>
                  </label>
                  <select
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl min-h-[44px]"
                  >
                    {MOROCCAN_CITIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {lang === 'fr' ? c.nameFr : c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-ink block mb-1.5 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-primary-dark" />
                    <span>{lang === 'fr' ? 'Portée des fournisseurs :' : 'نطاق إشعار الموردين :'}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsNationwide(true)}
                      className={`min-h-[44px] px-2.5 rounded-xl text-[11px] font-black border cursor-pointer ${
                        isNationwide
                          ? 'bg-ink text-primary border-ink'
                          : 'bg-white text-steel-700 border-steel-300'
                      }`}
                    >
                      {lang === 'fr' ? 'Tout le Maroc' : 'كل الموردين بالمغرب'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNationwide(false)}
                      className={`min-h-[44px] px-2.5 rounded-xl text-[11px] font-black border cursor-pointer ${
                        !isNationwide
                          ? 'bg-ink text-primary border-ink'
                          : 'bg-white text-steel-700 border-steel-300'
                      }`}
                    >
                      {lang === 'fr' ? `Rayon ${radiusKm} km` : `قريب (${radiusKm} كم)`}
                    </button>
                  </div>
                </div>
              </div>

              {!isNationwide && (
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_RADII.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRadiusKm(r)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer tabular-nums ${
                        radiusKm === r
                          ? 'bg-primary text-ink border-primary'
                          : 'bg-white text-steel-600 border-steel-200'
                      }`}
                    >
                      {r} {lang === 'fr' ? 'km' : 'كم'}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-black text-ink block mb-1.5">
                  {lang === 'fr' ? 'Précisions supplémentaires :' : 'ملاحظات أو تفاصيل إضافية للموردين :'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    needType === 'machine_purchase'
                      ? lang === 'fr'
                        ? 'Ex: Heures max, garantie, livraison sur site ou port...'
                        : 'مثال: عدد ساعات العمل، شروط الفحص أو التوصيل للمدينة...'
                      : lang === 'fr'
                      ? 'Ex: Besoin urgent, quantité souhaitée...'
                      : 'مثال: الكمية المطلوبة، استعجال التوصيل أو تفاصيل إضافية...'
                  }
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-steel-300 rounded-xl"
                />
              </div>

              {/* Live Match Summary Strip */}
              <div className="bg-steel-50 border border-steel-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white border border-steel-200 text-ink flex items-center justify-center shrink-0">
                    {isScanning ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary-dark" />
                    ) : (
                      <Building2 className="w-4 h-4 text-primary-dark" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-ink block">
                      {isScanning
                        ? lang === 'fr'
                          ? 'Recherche des fournisseurs correspondants...'
                          : 'جاري مسح الموردين وشركات الاستيراد...'
                        : lang === 'fr'
                        ? `${matchedTargets.length} fournisseur(s) prêt(s) à être notifié(s)`
                        : `${matchedTargets.length} مورد / شركة استيراد سيصلهم الإشعار فوراً`}
                    </span>
                    {matchedTargets.length > 0 && (
                      <span className="text-[11px] text-steel-500 block truncate">
                        {matchedTargets
                          .slice(0, 3)
                          .map(
                            (t) =>
                              `${t.matched_machine_title}${
                                t.distance_km ? ` (${formatDistanceKm(t.distance_km, lang)})` : ''
                              }`
                          )
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              </div>
            </div>
          )}

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-steel-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              className="min-h-[44px]"
            >
              {lang === 'fr' ? 'Annuler' : 'إلغاء'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={
                isLaunching ||
                !needType ||
                (needType === 'spare_part' && hasFleetMachine === null)
              }
              leftIcon={
                isLaunching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )
              }
              className="min-h-[44px] font-black"
            >
              {isLaunching
                ? lang === 'fr'
                  ? 'Diffusion en cours...'
                  : 'جاري إطلاق الحملة...'
                : lang === 'fr'
                ? 'Lancer la campagne'
                : 'إطلاق حملة البحث وإشعار الموردين'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierSearchCampaignModal;
