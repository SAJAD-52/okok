// ============================================================================
// JADIJCB: Owner-Only Moroccan Public Works Tenders Radar (/owner/tenders)
// Scans marchespublics.gov.ma & Moroccan web daily at 00:00 (Africa/Casablanca)
// Extracts awarded public works tenders, winning BTP companies, and public
// contact coordinates (phone, email, website) in full-width wide cards.
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Radar,
  Search,
  RefreshCw,
  Phone,
  Mail,
  Globe,
  ExternalLink,
  Copy,
  UserPlus,
  Check,
  Clock,
  Building2,
  MapPin,
  Calendar,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Truck,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { serverApi } from '../lib/serverApi';
import { clientService } from '../lib/clientService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import type { PublicTenderRecord, TenderScrapeRunRecord, TenderSector } from '../types/database';

const SECTOR_OPTIONS: Array<{ value: string; labelAr: string; labelFr: string }> = [
  { value: 'all', labelAr: 'جميع القطاعات', labelFr: 'Tous les secteurs' },
  { value: 'routes_vrd', labelAr: 'طرق وبنية تحتية', labelFr: 'Routes & VRD' },
  { value: 'terrassement', labelAr: 'حفر وردم وتهيئة', labelFr: 'Terrassement' },
  { value: 'hydraulique', labelAr: 'ماء وتطهير وسدود', labelFr: 'Hydraulique & AEP' },
  { value: 'batiment', labelAr: 'بناء وتجهيزات عمومية', labelFr: 'Bâtiment public' },
  { value: 'genie_civil', labelAr: 'منشآت فنية وهندسة مدنية', labelFr: 'Génie civil' },
];

const REGION_OPTIONS: Array<{ value: string; labelAr: string; labelFr: string }> = [
  { value: 'all', labelAr: 'كل جهات المغرب', labelFr: 'Toutes les régions' },
  { value: 'الدار البيضاء - سطات', labelAr: 'الدار البيضاء - سطات', labelFr: 'Casablanca-Settat' },
  { value: 'الرباط - سلا - القنيطرة', labelAr: 'الرباط - سلا - القنيطرة', labelFr: 'Rabat-Salé-Kénitra' },
  { value: 'مراكش - آسفي', labelAr: 'مراكش - آسفي', labelFr: 'Marrakech-Safi' },
  { value: 'طنجة - تطوان - الحسيمة', labelAr: 'طنجة - تطوان - الحسيمة', labelFr: 'Tanger-Tétouan-Al Hoceïma' },
  { value: 'فاس - مكناس', labelAr: 'فاس - مكناس', labelFr: 'Fès-Meknès' },
  { value: 'سوس - ماسة', labelAr: 'سوس - ماسة', labelFr: 'Souss-Massa' },
  { value: 'الشرق', labelAr: 'جهة الشرق', labelFr: 'Oriental' },
  { value: 'بني ملال - خنيفرة', labelAr: 'بني ملال - خنيفرة', labelFr: 'Béni Mellal-Khénifra' },
  { value: 'درعة - تافيلالت', labelAr: 'درعة - تافيلالت', labelFr: 'Drâa-Tafilalet' },
];

function getSectorLabel(sector: TenderSector | string, lang: 'ar' | 'fr'): string {
  const found = SECTOR_OPTIONS.find((s) => s.value === sector);
  if (found) return lang === 'fr' ? found.labelFr : found.labelAr;
  return lang === 'fr' ? 'Travaux publics' : 'أشغال عمومية';
}

function formatCountdown(targetIso?: string): string {
  if (!targetIso) return '--:--:--';
  const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function buildWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 10) {
    return `212${digits.slice(1)}`;
  }
  return digits;
}

export const PublicTendersRadarPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { lang } = useLanguage();

  const effectiveRole = String(profile?.role || user?.user_metadata?.role || '').toLowerCase();
  const isOwnerOrAdmin = !['client', 'contractor', 'driver'].includes(effectiveRole);

  const [tenders, setTenders] = useState<PublicTenderRecord[]>([]);
  const [runs, setRuns] = useState<TenderScrapeRunRecord[]>([]);
  const [lastRun, setLastRun] = useState<TenderScrapeRunRecord | null>(null);
  const [nextMidnightAt, setNextMidnightAt] = useState<string>('');
  const [countdownText, setCountdownText] = useState<string>('--:--:--');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [onlyWithContact, setOnlyWithContact] = useState<boolean>(false);
  const [showRunHistory, setShowRunHistory] = useState<boolean>(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedClientKeys, setSavedClientKeys] = useState<Record<string, boolean>>({});

  const loadTenders = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await serverApi.getPublicTenders();
      if (!res.success && res.error) {
        setApiError(
          (lang === 'fr' ? res.message_fr : res.message_ar) ||
            (lang === 'fr'
              ? 'Impossible de charger les marchés publics.'
              : 'تعذر تحميل بيانات رادار الصفقات العمومية.')
        );
      }
      setTenders(res.tenders || []);
      setRuns(res.runs || []);
      setLastRun(res.lastRun || null);
      if (res.nextMidnightAt) {
        setNextMidnightAt(res.nextMidnightAt);
      }
    } finally {
      setIsLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    if (isOwnerOrAdmin) {
      loadTenders();
    }
  }, [isOwnerOrAdmin, loadTenders]);

  // Preload saved owner client names to mark already-added companies
  useEffect(() => {
    if (!user?.id) return;
    const localClients = clientService.getLocalClients(user.id);
    const map: Record<string, boolean> = {};
    for (const c of localClients) {
      if (c.name) map[c.name.trim().toLowerCase()] = true;
    }
    setSavedClientKeys(map);
  }, [user?.id]);

  // Live countdown to next 00:00 Africa/Casablanca automated scan
  useEffect(() => {
    if (!nextMidnightAt) return;
    setCountdownText(formatCountdown(nextMidnightAt));
    const timer = setInterval(() => {
      setCountdownText(formatCountdown(nextMidnightAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [nextMidnightAt]);

  const handleRunScanNow = async () => {
    setIsScanning(true);
    setApiError(null);
    try {
      const res = await serverApi.triggerPublicTendersScan({
        sector: selectedSector,
        region: selectedRegion,
      });

      if (!res.success) {
        const msg =
          (lang === 'fr' ? res.message_fr : res.message_ar) ||
          (lang === 'fr'
            ? 'Échec du scan du portail marocain.'
            : 'تعذر إتمام مسح الويب المغربي حالياً.');
        setApiError(msg);
        toast.error(msg);
        return;
      }

      setTenders(res.tenders || []);
      if (res.run) {
        setLastRun(res.run);
        setRuns((prev) => [res.run, ...prev.filter((r) => r.id !== res.run.id)].slice(0, 8));
      }
      if (res.nextMidnightAt) {
        setNextMidnightAt(res.nextMidnightAt);
      }

      toast.success(
        lang === 'fr'
          ? `Scan terminé : ${res.newCount ?? 0} nouveau(x) marché(s) extrait(s).`
          : `اكتمل مسح الويب المغربي: تم استخراج ${res.newCount ?? 0} صفقة جديدة وتحديث ${res.updatedCount ?? 0} صفقة.`
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopyCoordinates = async (tender: PublicTenderRecord) => {
    const lines = [
      tender.winning_company,
      tender.contact_phone ? `Tel: ${tender.contact_phone}` : '',
      tender.contact_email ? `Email: ${tender.contact_email}` : '',
      tender.company_website ? `Web: ${tender.company_website}` : '',
      `${tender.reference_code} - ${lang === 'fr' ? tender.title_fr : tender.title_ar}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      setCopiedId(tender.id);
      toast.success(
        lang === 'fr'
          ? 'Coordonnées copiées dans le presse-papiers.'
          : 'تم نسخ إحداثيات التواصل بنجاح.'
      );
      setTimeout(() => {
        setCopiedId((prev) => (prev === tender.id ? null : prev));
      }, 2000);
    } catch {
      toast.error(lang === 'fr' ? 'Copie impossible.' : 'تعذر النسخ.');
    }
  };

  const handleSaveAsClient = async (tender: PublicTenderRecord) => {
    if (!user?.id) return;
    const key = tender.winning_company.trim().toLowerCase();
    if (savedClientKeys[key]) return;

    const noteParts = [
      `صفقة عمومية: ${tender.reference_code}`,
      lang === 'fr' ? tender.title_fr : tender.title_ar,
      tender.contact_email ? `Email: ${tender.contact_email}` : '',
      tender.company_website ? `Web: ${tender.company_website}` : '',
    ].filter(Boolean);

    try {
      await clientService.createClient(user.id, {
        name: tender.winning_company,
        phone: tender.contact_phone || '-',
        city: tender.company_city || tender.city || 'الدار البيضاء',
        notes: noteParts.join(' · '),
      });
      setSavedClientKeys((prev) => ({ ...prev, [key]: true }));
      toast.success(
        lang === 'fr'
          ? `${tender.winning_company} ajouté à votre répertoire clients.`
          : `تمت إضافة «${tender.winning_company}» إلى سجل زبائنك بنجاح.`
      );
    } catch {
      toast.error(
        lang === 'fr' ? 'Erreur lors de l’ajout au répertoire.' : 'تعذر حفظ الشركة في سجل الزبائن.'
      );
    }
  };

  const filteredTenders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tenders.filter((item) => {
      if (selectedSector !== 'all' && item.sector !== selectedSector) return false;
      if (selectedRegion !== 'all') {
        const regHay = `${item.region} ${item.city} ${item.company_city}`.toLowerCase();
        const selectedWord = selectedRegion.split('-')[0].trim().toLowerCase();
        if (!regHay.includes(selectedWord) && !regHay.includes(selectedRegion.toLowerCase())) {
          return false;
        }
      }
      if (onlyWithContact && !item.contact_phone && !item.contact_email) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        item.reference_code,
        item.title_ar,
        item.title_fr,
        item.contracting_authority,
        item.winning_company,
        item.city,
        item.region,
        item.contact_phone,
        item.contact_email,
        item.company_website,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tenders, selectedSector, selectedRegion, onlyWithContact, searchQuery]);

  const metrics = useMemo(() => {
    const withPhone = tenders.filter((t) => Boolean(t.contact_phone)).length;
    const withEmailOrWeb = tenders.filter(
      (t) => Boolean(t.contact_email || t.company_website)
    ).length;
    const totalMad = tenders.reduce((sum, t) => sum + (Number(t.amount_mad) || 0), 0);
    return {
      total: tenders.length,
      withPhone,
      withEmailOrWeb,
      totalMad,
    };
  }, [tenders]);

  // Strictly block non-owner accounts on frontend
  if (!isOwnerOrAdmin) {
    return (
      <Navigate
        to={effectiveRole === 'driver' ? '/driver' : '/entreprise'}
        replace
      />
    );
  }

  const ownerCompany = profile?.company_name || profile?.full_name || 'مقاولتنا';

  return (
    <div className="w-full space-y-6 text-start">
      {/* Header & Daily 00:00 Morocco Scan Control */}
      <div className="bg-white border border-steel-200 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2 max-w-3xl">
          <div className="flex items-center gap-2 text-xs text-steel-500 font-medium flex-wrap">
            <span>{lang === 'fr' ? 'Espace Propriétaire' : 'بوابة المالك الحصرية'}</span>
            <span aria-hidden="true">·</span>
            <span>marchespublics.gov.ma</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-steel-700">
              {lang === 'fr'
                ? 'Scan quotidien auto 00:00 (Maroc)'
                : 'مسح يومي تلقائي 00:00 بتوقيت المغرب'}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2.5 text-balance">
            <Radar className="w-6 h-6 text-primary-dark shrink-0" />
            <span>
              {lang === 'fr' ? 'Radar des Marchés Publics' : 'رادار الصفقات العمومية المغربية'}
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-steel-600 leading-relaxed">
            {lang === 'fr'
              ? 'Analyse automatisée chaque nuit à 00h00 du portail des marchés publics et du web BTP marocain pour extraire les marchés de travaux attribués, les sociétés gagnantes et leurs coordonnées directes (téléphone, e-mail, site web).'
              : 'يقوم الرادار يومياً عند الساعة 00:00 بمسح منصة الصفقات العمومية المغربية والويب المغربي لاستخراج صفقات الأشغال العمومية التي مرت، الشركات الفائزة بها، وإحداثيات التواصل المباشر معها (الهاتف، البريد الإلكتروني، والموقع) لتقديم عروض كراء آلياتك.'}
          </p>

          <div className="flex items-center gap-4 pt-1 text-xs text-steel-500 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {lang === 'fr' ? 'Prochain scan 00:00 dans :' : 'المسح التلقائي القادم بعد:'}{' '}
                <strong className="text-ink">{countdownText}</strong>
              </span>
            </span>
            {lastRun?.started_at && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {lang === 'fr' ? 'Dernier scan :' : 'آخر مسح:'}{' '}
                  {new Date(lastRun.started_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'ar-MA')}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isScanning}
            onClick={handleRunScanNow}
            leftIcon={
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            }
            className="whitespace-nowrap shrink-0 font-black"
          >
            {isScanning
              ? lang === 'fr'
                ? 'Analyse du web marocain...'
                : 'جاري مسح الصفقات بالويب المغربي...'
              : lang === 'fr'
              ? 'Lancer un scan maintenant'
              : 'تشغيل مسح فوري الآن'}
          </Button>
        </div>
      </div>

      {/* 4 KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-white border border-steel-200 rounded-2xl">
          <span className="text-xs text-steel-500 font-semibold block">
            {lang === 'fr' ? 'Marchés attribués extraits' : 'الصفقات المستخرجة'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-ink font-mono tabular-nums mt-1 block">
            {metrics.total}
          </span>
        </Card>

        <Card className="p-4 bg-white border border-steel-200 rounded-2xl">
          <span className="text-xs text-steel-500 font-semibold block">
            {lang === 'fr' ? 'Avec téléphone vérifié' : 'شركات برقم هاتف مباشر'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1 block">
            {metrics.withPhone}
          </span>
        </Card>

        <Card className="p-4 bg-white border border-steel-200 rounded-2xl">
          <span className="text-xs text-steel-500 font-semibold block">
            {lang === 'fr' ? 'E-mail ou site web' : 'بإيميل أو موقع إلكتروني'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-ink font-mono tabular-nums mt-1 block">
            {metrics.withEmailOrWeb}
          </span>
        </Card>

        <Card className="p-4 bg-white border border-steel-200 rounded-2xl">
          <span className="text-xs text-steel-500 font-semibold block">
            {lang === 'fr' ? 'Volume global déclaré' : 'القيمة الإجمالية المصرح بها'}
          </span>
          <span className="text-base sm:text-xl font-black text-primary-dark font-mono tabular-nums mt-1 block truncate">
            {metrics.totalMad > 0 ? `${metrics.totalMad.toLocaleString('fr-FR')} MAD` : '—'}
          </span>
        </Card>
      </div>

      {/* API Error Alert if server/key error occurred */}
      {apiError && (
        <div className="p-4 rounded-2xl border border-rose-300 bg-rose-50 text-rose-900 flex items-start gap-3 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="font-black">{apiError}</p>
            <p className="text-xs text-rose-700">
              {lang === 'fr'
                ? 'Vérifiez la configuration serveur ou réessayez le scan dans quelques instants.'
                : 'يرجى التحقق من إعدادات الخدمة على الخادم أو إعادة المحاولة بعد قليل.'}
            </p>
          </div>
        </div>
      )}

      {/* Search, Sector Tabs & Region Filter Bar */}
      <div className="bg-white border border-steel-200 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-steel-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'fr'
                  ? 'Rechercher par société gagnante, N° AO, ville, téléphone...'
                  : 'ابحث باسم الشركة الفائزة، رقم الصفقة، المشروع، المدينة أو الهاتف...'
              }
              className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-steel-200 bg-surface text-xs sm:text-sm text-ink focus:outline-none focus:border-primary"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-steel-200 bg-surface text-xs sm:text-sm text-ink focus:outline-none focus:border-primary"
            >
              {REGION_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {lang === 'fr' ? r.labelFr : r.labelAr}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center">
            <button
              type="button"
              onClick={() => setOnlyWithContact((v) => !v)}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                onlyWithContact
                  ? 'bg-ink text-primary border-ink'
                  : 'bg-surface text-steel-700 border-steel-200 hover:bg-steel-100'
              }`}
            >
              {lang === 'fr'
                ? 'Avec téléphone / e-mail uniquement'
                : 'شركات بإحداثيات تواصل فقط'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {SECTOR_OPTIONS.map((sec) => (
            <button
              key={sec.value}
              type="button"
              onClick={() => setSelectedSector(sec.value)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedSector === sec.value
                  ? 'bg-ink text-primary'
                  : 'bg-surface text-steel-600 hover:text-ink hover:bg-steel-100'
              }`}
            >
              {lang === 'fr' ? sec.labelFr : sec.labelAr}
            </button>
          ))}
        </div>
      </div>

      {/* Full-Width Wide Cards List */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      ) : filteredTenders.length === 0 ? (
        <Card className="w-full p-8 sm:p-12 bg-white border border-steel-200 rounded-2xl text-center space-y-4">
          <Radar className="w-12 h-12 text-steel-300 mx-auto" />
          <div className="max-w-lg mx-auto space-y-1.5">
            <h2 className="text-base sm:text-lg font-black text-ink">
              {tenders.length === 0
                ? lang === 'fr'
                  ? 'Aucun marché public extrait pour le moment'
                  : 'لا توجد صفقات مستخرجة بعد في سجل الرادار'
                : lang === 'fr'
                ? 'Aucun marché ne correspond à vos filtres'
                : 'لا توجد صفقات تطابق بحثك الحالي'}
            </h2>
            <p className="text-xs sm:text-sm text-steel-500 leading-relaxed">
              {tenders.length === 0
                ? lang === 'fr'
                  ? 'Le scan automatique s’exécute chaque nuit à 00:00 (heure du Maroc). Vous pouvez lancer votre premier scan en direct dès maintenant.'
                  : 'يقوم الرادار بمسح الويب المغربي ومنصة الصفقات العمومية يومياً عند الساعة 00:00 ليلاً، ويمكنك تشغيل أول مسح مباشر الآن.'
                : lang === 'fr'
                ? 'Essayez de modifier vos critères de recherche ou de secteur.'
                : 'جرّب تغيير كلمات البحث أو اختيار جميع القطاعات والجهات.'}
            </p>
          </div>
          {tenders.length === 0 && (
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={isScanning}
              onClick={handleRunScanNow}
              leftIcon={<RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />}
              className="mx-auto font-black"
            >
              {isScanning
                ? lang === 'fr'
                  ? 'Scan en cours...'
                  : 'جاري مسح الويب المغربي...'
                : lang === 'fr'
                ? 'Lancer le premier scan maintenant'
                : 'تشغيل أول مسح للويب المغربي الآن'}
            </Button>
          )}
        </Card>
      ) : (
        <div className="w-full space-y-4">
          {filteredTenders.map((tender) => {
            const displayTitle =
              lang === 'fr'
                ? tender.title_fr || tender.title_ar
                : tender.title_ar || tender.title_fr;
            const secondaryTitle =
              lang === 'fr'
                ? tender.title_ar && tender.title_ar !== tender.title_fr
                  ? tender.title_ar
                  : ''
                : tender.title_fr && tender.title_fr !== tender.title_ar
                ? tender.title_fr
                : '';
            const displaySummary =
              lang === 'fr'
                ? tender.summary_fr || tender.summary_ar
                : tender.summary_ar || tender.summary_fr;
            const waDigits = buildWhatsAppDigits(tender.contact_phone);
            const isSaved = Boolean(
              savedClientKeys[tender.winning_company.trim().toLowerCase()]
            );

            const pitchMessage =
              lang === 'fr'
                ? `Bonjour ${tender.winning_company}, suite à l'attribution du marché "${tender.reference_code} - ${displayTitle}", notre société ${ownerCompany} met à votre disposition des engins BTP prêts à intervenir sur votre chantier (${tender.city || 'Maroc'}).`
                : `السلام عليكم شركة ${tender.winning_company}، نبارك لكم فوزكم بصفقة «${displayTitle}» (${tender.reference_code}). تتوفر مقاولتنا (${ownerCompany}) على آليات أشغال عمومية جاهزة للعمل في ورشكم بمدينة ${tender.city || 'المغرب'} بأثمنة مناسبة.`;

            return (
              <article
                key={tender.id}
                className="w-full bg-white border border-steel-200 rounded-2xl p-5 sm:p-6 space-y-4 transition-colors hover:border-steel-300"
              >
                {/* Section 1: Tender Title, Unboxed Metadata & Contract Amount */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Quiet unboxed metadata line */}
                    <div className="flex items-center gap-2 text-xs text-steel-500 flex-wrap">
                      <span className="font-mono font-bold text-ink">
                        {tender.reference_code || 'AO'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{getSectorLabel(tender.sector, lang)}</span>
                      {tender.contracting_authority && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-steel-700 font-medium">
                            {tender.contracting_authority}
                          </span>
                        </>
                      )}
                      {(tender.city || tender.region) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-steel-400" />
                            {[tender.city, tender.region].filter(Boolean).join(' / ')}
                          </span>
                        </>
                      )}
                      {tender.award_date && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Calendar className="w-3 h-3 text-steel-400" />
                            {tender.award_date}
                          </span>
                        </>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-black text-ink leading-snug">
                      {displayTitle}
                    </h2>

                    {secondaryTitle && (
                      <p className="text-xs text-steel-500 leading-snug">
                        {secondaryTitle}
                      </p>
                    )}

                    {displaySummary && (
                      <p className="text-xs sm:text-sm text-steel-600 leading-relaxed pt-0.5">
                        {displaySummary}
                      </p>
                    )}
                  </div>

                  {/* Contract Amount Box (tabular-nums) */}
                  <div className="shrink-0 lg:text-end flex lg:flex-col items-baseline lg:items-end justify-between gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-steel-100">
                    <span className="text-[11px] font-semibold text-steel-500">
                      {lang === 'fr' ? 'Montant du marché attribué' : 'قيمة الصفقة المرصودة'}
                    </span>
                    <span className="text-lg sm:text-xl font-black text-primary-dark font-mono tabular-nums">
                      {tender.amount_mad > 0
                        ? `${tender.amount_mad.toLocaleString('fr-FR')} MAD`
                        : lang === 'fr'
                        ? 'Non publié'
                        : 'غير مصرح'}
                    </span>
                  </div>
                </div>

                {/* Machinery needed line (unboxed) */}
                {tender.machinery_needed.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-steel-600 flex-wrap">
                    <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="font-bold text-steel-700">
                      {lang === 'fr' ? 'Engins requis :' : 'الآليات المناسبة لهذا الورش:'}
                    </span>
                    <span>{tender.machinery_needed.join(' · ')}</span>
                  </div>
                )}

                {/* Section 2: Winning Company & Contact Coordinates ONLY (Phone, Email, Website) */}
                <div className="border-t border-b border-steel-100 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-steel-50/60 -mx-5 sm:-mx-6 px-5 sm:px-6">
                  {/* Winning Company */}
                  <div className="lg:col-span-4 space-y-1 min-w-0">
                    <span className="text-[11px] font-bold text-steel-500 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-primary-dark shrink-0" />
                      {lang === 'fr' ? 'Société attributaire (Gagnante)' : 'الشركة الفائزة بالصفقة'}
                    </span>
                    <p className="text-sm sm:text-base font-black text-ink truncate">
                      {tender.winning_company}
                    </p>
                    {tender.company_city && (
                      <p className="text-xs text-steel-500 truncate">
                        {lang === 'fr' ? 'Siège / Ville :' : 'المقر / المدينة:'} {tender.company_city}
                      </p>
                    )}
                  </div>

                  {/* Contact Coordinates Grid: Phone, Email, Website ONLY */}
                  <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Phone */}
                    <div className="space-y-1 min-w-0">
                      <span className="text-[11px] font-semibold text-steel-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-700" />
                        {lang === 'fr' ? 'Téléphone' : 'رقم الهاتف'}
                      </span>
                      {tender.contact_phone ? (
                        <a
                          href={`tel:${tender.contact_phone}`}
                          dir="ltr"
                          className="text-xs sm:text-sm font-black text-ink hover:text-primary-dark font-mono tabular-nums block truncate"
                        >
                          {tender.contact_phone}
                        </a>
                      ) : (
                        <span className="text-xs text-steel-400 block">
                          {lang === 'fr' ? 'Non disponible' : 'غير متوفر علناً'}
                        </span>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1 min-w-0">
                      <span className="text-[11px] font-semibold text-steel-500 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-blue-700" />
                        {lang === 'fr' ? 'E-mail' : 'البريد الإلكتروني'}
                      </span>
                      {tender.contact_email ? (
                        <a
                          href={`mailto:${tender.contact_email}`}
                          dir="ltr"
                          className="text-xs sm:text-sm font-bold text-ink hover:text-primary-dark font-mono block truncate"
                        >
                          {tender.contact_email}
                        </a>
                      ) : (
                        <span className="text-xs text-steel-400 block">
                          {lang === 'fr' ? 'Non disponible' : 'غير متوفر علناً'}
                        </span>
                      )}
                    </div>

                    {/* Website */}
                    <div className="space-y-1 min-w-0">
                      <span className="text-[11px] font-semibold text-steel-500 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-amber-700" />
                        {lang === 'fr' ? 'Site web' : 'الموقع الإلكتروني'}
                      </span>
                      {tender.company_website ? (
                        <a
                          href={tender.company_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          dir="ltr"
                          className="text-xs sm:text-sm font-bold text-primary-dark hover:underline font-mono inline-flex items-center gap-1 max-w-full truncate"
                        >
                          <span className="truncate">
                            {tender.company_website.replace(/^https?:\/\/(www\.)?/i, '')}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-xs text-steel-400 block">
                          {lang === 'fr' ? 'Non disponible' : 'غير متوفر علناً'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Direct Commercial Outreach & CRM Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {waDigits && (
                      <a
                        href={`https://wa.me/${waDigits}?text=${encodeURIComponent(pitchMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'fr' ? 'Proposer mes engins (WhatsApp)' : 'عرض آلياتك عبر واتساب'}
                        </span>
                      </a>
                    )}

                    {tender.contact_phone && (
                      <a
                        href={`tel:${tender.contact_phone}`}
                        className="px-4 py-2 rounded-xl bg-ink hover:bg-steel-800 text-white font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-primary" />
                        <span>{lang === 'fr' ? 'Appeler' : 'اتصال مباشر'}</span>
                      </a>
                    )}

                    {tender.contact_email && (
                      <a
                        href={`mailto:${tender.contact_email}?subject=${encodeURIComponent(
                          `${lang === 'fr' ? 'Mise à disposition engins BTP' : 'عرض كراء آليات أشغال عمومية'} - ${tender.reference_code}`
                        )}&body=${encodeURIComponent(pitchMessage)}`}
                        className="px-4 py-2 rounded-xl border border-steel-200 hover:border-steel-300 bg-white text-ink font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5 text-steel-600" />
                        <span>{lang === 'fr' ? 'Envoyer un e-mail' : 'مراسلة بالإيميل'}</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyCoordinates(tender)}
                      className="px-3.5 py-2 rounded-xl border border-steel-200 hover:bg-steel-50 text-steel-700 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      {copiedId === tender.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedId === tender.id
                          ? lang === 'fr'
                            ? 'Copié'
                            : 'تم النسخ'
                          : lang === 'fr'
                          ? 'Copier'
                          : 'نسخ الإحداثيات'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaved}
                      onClick={() => handleSaveAsClient(tender)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                        isSaved
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 cursor-default'
                          : 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 cursor-pointer'
                      }`}
                    >
                      {isSaved ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5 text-amber-700" />
                      )}
                      <span>
                        {isSaved
                          ? lang === 'fr'
                            ? 'Ajouté aux clients'
                            : 'مضاف لزبائنك'
                          : lang === 'fr'
                          ? 'Ajouter à mes clients'
                          : 'إضافة لزبائني'}
                      </span>
                    </button>
                  </div>

                  {tender.source_url && (
                    <a
                      href={tender.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-steel-500 hover:text-ink inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <span>
                        {lang === 'fr' ? 'Source :' : 'المصدر:'}{' '}
                        {tender.source_domain || 'marchespublics.gov.ma'}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Collapsible Scan History & Grounded Sources Audit */}
      {runs.length > 0 && (
        <div className="bg-white border border-steel-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <button
            type="button"
            onClick={() => setShowRunHistory((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-start cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-ink">
              <Clock className="w-4 h-4 text-steel-500" />
              <span>
                {lang === 'fr'
                  ? `Historique des scans (${runs.length})`
                  : `سجل عمليات المسح الأخيرة (${runs.length})`}
              </span>
            </div>
            {showRunHistory ? (
              <ChevronUp className="w-4 h-4 text-steel-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-steel-500" />
            )}
          </button>

          {showRunHistory && (
            <div className="border-t border-steel-100 pt-3 space-y-3">
              {runs.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs py-2 border-b border-steel-100 last:border-b-0"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink">
                      {r.trigger_type === 'scheduled_midnight'
                        ? lang === 'fr'
                          ? 'Scan automatique 00:00'
                          : 'مسح تلقائي 00:00'
                        : lang === 'fr'
                        ? 'Scan manuel'
                        : 'مسح فوري يدوي'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-steel-500">
                      {new Date(r.started_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'ar-MA')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        r.status === 'completed'
                          ? 'text-emerald-700 font-bold'
                          : r.status === 'error'
                          ? 'text-rose-700 font-bold'
                          : 'text-amber-700 font-bold'
                      }
                    >
                      {r.status === 'completed'
                        ? lang === 'fr'
                          ? `${r.found_count} trouvés (${r.new_count} nouveaux)`
                          : `${r.found_count} صفقة (${r.new_count} جديدة)`
                        : r.error_message || r.status}
                    </span>
                  </div>

                  {r.sources && r.sources.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.sources.slice(0, 3).map((src, idx) => (
                        <a
                          key={`${r.id}_${idx}`}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary-dark hover:underline inline-flex items-center gap-1"
                        >
                          <span className="truncate max-w-[160px]">{src.title || src.uri}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PublicTendersRadarPage;
