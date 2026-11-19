// ============================================================================
// JADIJCB: Public Moroccan Public Works Tenders Radar (/tenders)
// Accessible publicly alongside /marketplace.
// Automated server-side daily 00:00 (Africa/Casablanca) scan — displays
// awarded public works tenders once, sorted newest-first, with simple
// City & Work Type filters and full-width company contact cards.
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Radar,
  Search,
  Phone,
  Mail,
  Globe,
  ExternalLink,
  Copy,
  UserPlus,
  Check,
  Building2,
  MapPin,
  Calendar,
  AlertCircle,
  MessageSquare,
  Truck,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { serverApi } from '../lib/serverApi';
import { clientService } from '../lib/clientService';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import type { PublicTenderRecord, TenderSector } from '../types/database';

const SECTOR_OPTIONS: Array<{ value: string; labelAr: string; labelFr: string }> = [
  { value: 'all', labelAr: 'جميع أنواع الأشغال', labelFr: 'Tous les travaux' },
  { value: 'routes_vrd', labelAr: 'طرق وبنية تحتية', labelFr: 'Routes & VRD' },
  { value: 'terrassement', labelAr: 'حفر وردم وتهيئة', labelFr: 'Terrassement' },
  { value: 'hydraulique', labelAr: 'ماء وتطهير وسدود', labelFr: 'Hydraulique & AEP' },
  { value: 'batiment', labelAr: 'بناء وتجهيزات عمومية', labelFr: 'Bâtiment public' },
  { value: 'genie_civil', labelAr: 'منشآت فنية وهندسة مدنية', labelFr: 'Génie civil' },
];

function getSectorLabel(sector: TenderSector | string, lang: 'ar' | 'fr'): string {
  const found = SECTOR_OPTIONS.find((s) => s.value === sector);
  if (found) return lang === 'fr' ? found.labelFr : found.labelAr;
  return lang === 'fr' ? 'Travaux publics' : 'أشغال عمومية';
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
  const isOwner = Boolean(user && !['client', 'contractor', 'driver'].includes(effectiveRole));

  const [tenders, setTenders] = useState<PublicTenderRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isServerScanRunning, setIsServerScanRunning] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedClientKeys, setSavedClientKeys] = useState<Record<string, boolean>>({});

  const hasLoadedOnceRef = React.useRef(false);
  const pollAttemptsRef = React.useRef(0);
  const lastSignatureRef = React.useRef('');

  const loadTenders = useCallback(
    async (silent = false, forceRefresh = false) => {
      if (!silent && !forceRefresh) {
        setIsLoading(true);
        setApiError(null);
      }
      if (forceRefresh) {
        setIsRefreshing(true);
        setApiError(null);
      }
      try {
        const res = await serverApi.getPublicTenders(undefined, forceRefresh);
        if (!res.success && res.error) {
          if (!silent) {
            setApiError(
              (lang === 'fr' ? res.message_fr : res.message_ar) ||
                (lang === 'fr'
                  ? 'Impossible de charger les marchés publics.'
                  : 'تعذر تحميل بيانات رادار الصفقات العمومية.')
            );
          }
          setIsServerScanRunning(false);
          return false;
        }
        const nextTenders = res.tenders || [];
        const sig = nextTenders.map((t: PublicTenderRecord) => t.id).join(',');
        if (sig !== lastSignatureRef.current || !silent) {
          lastSignatureRef.current = sig;
          setTenders(nextTenders);
        }
        setApiError(null);
        setIsServerScanRunning(
          Boolean(res.isServerScanRunning || res.lastRun?.status === 'running')
        );
        return true;
      } finally {
        if (!silent && !forceRefresh) setIsLoading(false);
        if (forceRefresh) setIsRefreshing(false);
      }
    },
    [lang]
  );

  const handleRefreshFromServer = async () => {
    const ok = await loadTenders(false, true);
    if (ok) {
      toast.success(
        lang === 'fr'
          ? 'Liste actualisée depuis le serveur.'
          : 'تم تحديث قائمة الصفقات من الخادم.'
      );
    }
  };

  useEffect(() => {
    if (hasLoadedOnceRef.current) return;
    hasLoadedOnceRef.current = true;
    loadTenders(false);
  }, [loadTenders]);

  // Bounded check ONLY if server boot scan is actively running and results are not ready yet (max 4 checks)
  useEffect(() => {
    if (!isServerScanRunning || tenders.length > 0 || apiError) return;
    if (pollAttemptsRef.current >= 4) return;
    const timer = setTimeout(() => {
      pollAttemptsRef.current += 1;
      loadTenders(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [isServerScanRunning, tenders.length, apiError, loadTenders]);

  // Preload saved owner client names to mark already-added companies
  useEffect(() => {
    if (!isOwner || !user?.id) return;
    const localClients = clientService.getLocalClients(user.id);
    const map: Record<string, boolean> = {};
    for (const c of localClients) {
      if (c.name) map[c.name.trim().toLowerCase()] = true;
    }
    setSavedClientKeys(map);
  }, [isOwner, user?.id]);

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
    if (!isOwner || !user?.id) return;
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
        lang === 'fr'
          ? 'Erreur lors de l’ajout au répertoire.'
          : 'تعذر حفظ الشركة في سجل الزبائن.'
      );
    }
  };

  // Distinct city options extracted from actual tender results
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tenders) {
      const c = String(t.city || '').trim();
      if (c && c !== 'المغرب') set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [tenders]);

  // Filter and sort strictly newest-first (latest award_date at the top)
  const filteredTenders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tenders
      .filter((item) => {
        if (selectedSector !== 'all' && item.sector !== selectedSector) return false;
        if (selectedCity !== 'all') {
          const c = String(item.city || '').trim();
          if (c !== selectedCity && !c.includes(selectedCity)) return false;
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
      })
      .sort((a, b) => {
        const d = String(b.award_date || '').localeCompare(String(a.award_date || ''));
        if (d !== 0) return d;
        return String(b.scraped_at || '').localeCompare(String(a.scraped_at || ''));
      });
  }, [tenders, selectedSector, selectedCity, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedCity !== 'all' || selectedSector !== 'all';

  const ownerCompany = profile?.company_name || profile?.full_name || 'مقاولتنا';

  return (
    <div className="min-h-screen flex flex-col bg-surface text-start">
      <PublicHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        {/* Clean Public Section Title */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-steel-500 font-medium flex-wrap">
              <span>marchespublics.gov.ma</span>
              <span aria-hidden="true">·</span>
              <span>
                {lang === 'fr'
                  ? 'Mise à jour auto quotidienne à 00:00'
                  : 'تحديث تلقائي يومياً على الساعة 00:00'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-ink flex items-center gap-2.5 text-balance">
              <Radar className="w-6 h-6 text-primary-dark shrink-0" />
              <span>
                {lang === 'fr' ? 'Radar des Marchés Publics' : 'رادار الصفقات العمومية'}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-steel-600 max-w-3xl">
              {lang === 'fr'
                ? 'Marchés de travaux publics attribués au Maroc, sociétés gagnantes et coordonnées directes pour proposer vos engins.'
                : 'صفقات الأشغال العمومية التي تمت ترسيتها بالمغرب، الشركات الفائزة بها وإحداثيات التواصل المباشر معها.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs sm:text-sm font-bold text-steel-700 font-mono tabular-nums whitespace-nowrap shrink-0">
              {filteredTenders.length}{' '}
              {lang === 'fr' ? 'marché(s) affiché(s)' : 'صفقة معروضة'}
            </span>
            <button
              type="button"
              disabled={isRefreshing || isLoading}
              onClick={handleRefreshFromServer}
              className="px-3.5 py-2 rounded-xl border border-steel-200 bg-white hover:bg-steel-50 text-ink font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-primary-dark ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{lang === 'fr' ? 'Actualiser' : 'تحديث'}</span>
            </button>
          </div>
        </div>

        {/* Simple Filter Bar (Search + City + Work Type) */}
        <div className="bg-white border border-steel-200 rounded-2xl p-3.5 sm:p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-steel-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'fr'
                    ? 'Rechercher société gagnante, projet, N°...'
                    : 'ابحث باسم الشركة الفائزة، المشروع أو رقم الصفقة...'
                }
                className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-steel-200 bg-surface text-xs sm:text-sm text-ink focus:outline-none focus:border-primary"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                aria-label={lang === 'fr' ? 'Ville' : 'المدينة'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-steel-200 bg-surface text-xs sm:text-sm text-ink focus:outline-none focus:border-primary"
              >
                <option value="all">
                  {lang === 'fr' ? 'Toutes les villes' : 'كل المدن'}
                </option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div className={hasActiveFilters ? 'md:col-span-3' : 'md:col-span-4'}>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                aria-label={lang === 'fr' ? 'Type de travaux' : 'نوع الأشغال'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-steel-200 bg-surface text-xs sm:text-sm text-ink focus:outline-none focus:border-primary"
              >
                {SECTOR_OPTIONS.map((sec) => (
                  <option key={sec.value} value={sec.value}>
                    {lang === 'fr' ? sec.labelFr : sec.labelAr}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <div className="md:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCity('all');
                    setSelectedSector('all');
                  }}
                  title={lang === 'fr' ? 'Réinitialiser' : 'مسح الفلاتر'}
                  className="w-full md:w-auto px-3 py-2.5 rounded-xl border border-steel-200 hover:bg-steel-100 text-steel-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="md:hidden">{lang === 'fr' ? 'Réinitialiser' : 'مسح الفلاتر'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* API Error Alert */}
        {apiError && (
          <div className="p-4 rounded-2xl border border-rose-300 bg-rose-50 text-rose-900 flex items-start gap-3 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="font-bold">{apiError}</p>
          </div>
        )}

        {/* Full-Width Wide Cards List (Sorted Latest First, Shown Once) */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : filteredTenders.length === 0 ? (
          <Card className="w-full p-8 sm:p-12 bg-white border border-steel-200 rounded-2xl text-center space-y-3">
            <Radar className="w-11 h-11 text-steel-300 mx-auto" />
            <h2 className="text-base sm:text-lg font-black text-ink">
              {tenders.length === 0
                ? isServerScanRunning
                  ? lang === 'fr'
                    ? 'Mise à jour des marchés publics en cours...'
                    : 'جاري تحديث سجل الصفقات العمومية من الخادم...'
                  : lang === 'fr'
                  ? 'Aucun marché public enregistré pour le moment'
                  : 'لا توجد صفقات مسجلة حالياً'
                : lang === 'fr'
                ? 'Aucun marché ne correspond à vos filtres'
                : 'لا توجد صفقات تطابق خيارات التصفية'}
            </h2>
            <p className="text-xs sm:text-sm text-steel-500 max-w-md mx-auto">
              {tenders.length === 0
                ? lang === 'fr'
                  ? 'Le scan automatique du serveur s’exécute chaque nuit à 00:00.'
                  : 'يتم مسح منصة الصفقات العمومية تلقائياً من الخادم كل يوم على الساعة 00:00.'
                : lang === 'fr'
                ? 'Modifiez la ville ou le type de travaux pour afficher plus de résultats.'
                : 'جرّب تغيير المدينة أو نوع الأشغال لعرض نتائج أخرى.'}
            </p>
          </Card>
        ) : (
          <div className="w-full space-y-4">
            {filteredTenders.map((tender) => {
              const displayTitle =
                lang === 'fr'
                  ? tender.title_fr || tender.title_ar
                  : tender.title_ar || tender.title_fr;
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
                  {/* Tender Headline, Unboxed Metadata & Amount */}
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
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
                        {tender.city && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-steel-400" />
                              {tender.city}
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

                      {displaySummary && (
                        <p className="text-xs sm:text-sm text-steel-600 leading-relaxed">
                          {displaySummary}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 lg:text-end flex lg:flex-col items-baseline lg:items-end justify-between gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-steel-100">
                      <span className="text-[11px] font-semibold text-steel-500">
                        {lang === 'fr' ? 'Montant attribué' : 'قيمة الصفقة'}
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

                  {tender.machinery_needed.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-steel-600 flex-wrap">
                      <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="font-bold text-steel-700">
                        {lang === 'fr' ? 'Engins requis :' : 'الآليات المناسبة:'}
                      </span>
                      <span>{tender.machinery_needed.join(' · ')}</span>
                    </div>
                  )}

                  {/* Winning Company & Contact Coordinates */}
                  <div className="border-t border-b border-steel-100 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-steel-50/60 -mx-5 sm:-mx-6 px-5 sm:px-6">
                    <div className="lg:col-span-4 space-y-1 min-w-0">
                      <span className="text-[11px] font-bold text-steel-500 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-primary-dark shrink-0" />
                        {lang === 'fr' ? 'Société gagnante' : 'الشركة الفائزة بالصفقة'}
                      </span>
                      <p className="text-sm sm:text-base font-black text-ink truncate">
                        {tender.winning_company}
                      </p>
                      {tender.company_city && (
                        <p className="text-xs text-steel-500 truncate">
                          {lang === 'fr' ? 'Siège :' : 'المقر:'} {tender.company_city}
                        </p>
                      )}
                    </div>

                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                  {/* Direct Actions */}
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
                            `${
                              lang === 'fr'
                                ? 'Mise à disposition engins BTP'
                                : 'عرض كراء آليات أشغال عمومية'
                            } - ${tender.reference_code}`
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

                      {isOwner && (
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
                      )}
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
      </main>

      <Footer />
    </div>
  );
};

export default PublicTendersRadarPage;
