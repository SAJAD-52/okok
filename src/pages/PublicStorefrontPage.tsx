// ============================================================================
// JADIJCB: High-End Interactive Owner Storefront Page (/s/:slug)
// Featuring Map Search (البحث في الخريطة), Advanced Filters, and Instant Booking
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  Building2,
  MapPin,
  ShieldCheck,
  Phone,
  MessageCircle,
  Truck,
  RotateCcw,
  AlertCircle,
  Search,
  SlidersHorizontal,
  Map as MapIcon,
  Grid,
  CheckCircle2,
  CalendarCheck,
  MessageSquare,
  Sparkles,
  Share2,
  Check,
  Star,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  X,
  Clock,
  Layers,
  Fuel,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { MachineCard } from '../components/marketplace/MachineCard';
import { CreateBookingModal } from '../components/bookings/CreateBookingModal';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { Machine, Booking } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatPriceMAD } from '../data/rentalTerms';
import { toast } from '../components/ui/Toast';
import { loadStorefrontBySlug } from '../lib/storefrontService';
import { machineStore } from '../lib/machineStore';

export const PublicStorefrontPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // View Mode: Grid (شبكة) or Map (خريطة تفاعلية)
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'rent' | 'sale'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [withOperatorOnly, setWithOperatorOnly] = useState(false);
  const [fuelIncludedOnly, setFuelIncludedOnly] = useState(false);

  // Storefront & Data State
  const [storefrontData, setStorefrontData] = useState<any>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  // Booking Modal State
  const [selectedMachineForBooking, setSelectedMachineForBooking] = useState<Machine | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Active map machine selection
  const [selectedMapMachine, setSelectedMapMachine] = useState<Machine | null>(null);

  // Fetch Storefront and Published Machines
  const loadStorefront = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);

    try {
      let sfData: any = null;

      if (slug) {
        try {
          const sf = await loadStorefrontBySlug(slug);
          if (sf) {
            sfData = sf;
          }
        } catch (e) {
          console.warn('Storefront load notice:', e);
        }
      }

      if (!sfData) {
        // Fallback for demo storefront
        sfData = {
          slug: slug || 'atlas-terrassement',
          owner_id: 'usr_owner_casa_01',
          banner_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=1600&q=80',
          about_ar: 'شركة أطلس للأشغال العمومية والترابية، رائدة في كراء وتأجير آليات الحفر والتسوية الثقيلة مع سائقين معتمدين في جهة الدار البيضاء-سطات وجميع الأوراش الكبرى بالمغرب منذ 2012. نلتزم بأعلى معايير السلامة المهنية مع توفير شاحنات النقل (Porte-char) والدعم الفني في الموقع.',
          about_fr: 'Atlas Terrassement & Travaux Publics S.A.R.L. : Partenaire privilégié des grands chantiers BTP au Maroc. Location d\'engins lourds récents avec conducteurs qualifiés, conformité sécurité et service de transport porte-char.',
          whatsapp: '+212661234567',
          theme_color: '#FFB400',
          profiles: {
            id: 'usr_owner_casa_01',
            company_name: 'Atlas Terrassement & Travaux S.A.R.L.',
            full_name: 'كريم بنجلون',
            city: 'الدار البيضاء (Casablanca)',
            phone: '+212661234567',
            ice_number: '001928471000032',
            rc_number: '349102',
            role: 'owner',
          },
        };
      }

      setStorefrontData(sfData);

      // Fetch live machines from Supabase
      let liveMachines: Machine[] = [];
      if (isSupabaseConfigured && sfData.owner_id) {
        const { data: mData } = await supabase
          .from('machines')
          .select('*')
          .eq('owner_id', sfData.owner_id)
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (mData && mData.length > 0) {
          liveMachines = mData.map((m: any) => ({
            id: m.id,
            owner_id: m.owner_id,
            title_ar: m.title_ar,
            title_fr: m.title_fr,
            description_ar: m.description_ar,
            description_fr: m.description_fr,
            category: m.category,
            category_id: m.category,
            brand: m.brand,
            model: m.model,
            year: m.year,
            listing_mode: m.listing_mode,
            condition: m.condition || 'good',
            city: m.city,
            city_id: m.city,
            lat: m.lat || 33.5731,
            lng: m.lng || -7.5898,
            location_lat: m.lat || 33.5731,
            location_lng: m.lng || -7.5898,
            rate_hourly: Number(m.hourly_rate ?? m.rate_hourly) || 0,
            rate_daily: Number(m.daily_rate ?? m.rate_daily) || 0,
            rate_weekly: Number(m.weekly_rate ?? m.rate_weekly) || 0,
            sale_price: Number(m.sale_price) || 0,
            currency: 'MAD',
            with_operator: Boolean(m.with_operator),
            fuel_included: Boolean(m.fuel_included),
            delivery_available: Boolean(m.delivery_available),
            status: 'available',
            images: m.images?.length
              ? m.images
              : ['https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80'],
            specs: m.specs || {},
            views_count: m.views_count || 12,
            rating_avg: m.rating_avg || 4.9,
            reviews_count: m.reviews_count || 5,
            created_at: m.created_at,
            updated_at: m.created_at,
          }));
        }
      }

      // Merge live machines from DB with real owner machines in machineStore
      liveMachines = machineStore.mergeMachines(liveMachines, sfData.owner_id);

      setMachines(liveMachines);
      setSelectedMapMachine(liveMachines[0] || null);
    } catch (err) {
      console.warn('Storefront load notice:', err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadStorefront();

    const handleMachineUpdate = () => {
      loadStorefront();
    };
    window.addEventListener('jadijcb_machines_updated', handleMachineUpdate);
    return () => {
      window.removeEventListener('jadijcb_machines_updated', handleMachineUpdate);
    };
  }, [loadStorefront]);

  // Filtered Machines based on Search and Filter controls
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      // 1. Mode Filter (كراء / بيع)
      if (filterMode === 'rent' && m.listing_mode === 'sale') return false;
      if (filterMode === 'sale' && m.listing_mode === 'rent') return false;

      // 2. Category Filter
      if (categoryFilter !== 'all' && m.category !== categoryFilter && m.category_id !== categoryFilter) {
        return false;
      }

      // 3. Operator Filter
      if (withOperatorOnly && !m.with_operator) return false;

      // 4. Fuel Filter
      if (fuelIncludedOnly && !m.fuel_included) return false;

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleAr = m.title_ar?.toLowerCase() || '';
        const titleFr = m.title_fr?.toLowerCase() || '';
        const brand = m.brand?.toLowerCase() || '';
        const model = m.model?.toLowerCase() || '';
        const city = m.city?.toLowerCase() || '';
        return (
          titleAr.includes(q) ||
          titleFr.includes(q) ||
          brand.includes(q) ||
          model.includes(q) ||
          city.includes(q)
        );
      }

      return true;
    });
  }, [machines, filterMode, categoryFilter, withOperatorOnly, fuelIncludedOnly, searchQuery]);

  // Company Identity Data
  const company = {
    name: storefrontData?.profiles?.company_name || (lang === 'fr' ? 'Entreprise BTP Partenaire' : 'مقاولة الأشغال والآليات المعتمدة'),
    ownerName: storefrontData?.profiles?.full_name || (lang === 'fr' ? 'Partenaire JADIJCB' : 'شريك معتمد'),
    ownerId: storefrontData?.profiles?.id || storefrontData?.owner_id || '',
    city: storefrontData?.profiles?.city || (lang === 'fr' ? 'Casablanca' : 'الدار البيضاء'),
    ice: storefrontData?.profiles?.ice_number || '',
    rc: storefrontData?.profiles?.rc_number || '',
    phone: storefrontData?.whatsapp || storefrontData?.profiles?.phone || '+212600000000',
    whatsapp: storefrontData?.whatsapp || storefrontData?.profiles?.phone || '+212600000000',
    banner:
      storefrontData?.banner_url ||
      'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=1600&q=80',
    about_ar:
      storefrontData?.about_ar ||
      'شركة متخصصة في كراء وتأجير آليات ومعدات الأشغال العمومية والبناء مع سائقين معتمدين وصيانة دورية لضمان استمرارية الأوراش بأعلى جودة.',
    about_fr:
      storefrontData?.about_fr ||
      'Entreprise spécialisée dans la location d\'engins lourds et matériels de BTP avec opérateurs qualifiés et maintenance sur site.',
    theme_color: storefrontData?.theme_color || '#FFB400',
    avatar: storefrontData?.avatar_url || storefrontData?.profiles?.avatar_url || null,
  };

  const fullStoreUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullStoreUrl);
    setIsLinkCopied(true);
    toast.success(lang === 'fr' ? 'Lien de la vitrine copié !' : 'تم نسخ رابط متجر المالك بنجاح!');
    setTimeout(() => setIsLinkCopied(false), 2500);
  };

  // WhatsApp click handler with pre-populated message
  const getWhatsAppLink = (customMachine?: Machine) => {
    const rawNumber = company.whatsapp.replace(/\D/g, '');
    let text = `السلام عليكم ورحمة الله، نحن مقاولة بناء ونود الاستفسار عن كراء آلياتكم المعروضة في متجركم على منصة JADIJCB.`;
    if (customMachine) {
      text = `السلام عليكم، نود الاستفسار وحجز الآلية (${customMachine.brand} ${customMachine.model} - ${customMachine.title_ar}) المعروضة في متجركم على JADIJCB.`;
    }
    return `https://wa.me/${rawNumber}?text=${encodeURIComponent(text)}`;
  };

  // Direct internal chat handler
  const handleStartInternalChat = (machine?: Machine) => {
    const isContractor = profile?.role === 'client' || profile?.role === 'contractor';
    const basePath = isContractor ? '/entreprise/messages' : '/owner/messages';
    const machineParam = machine?.id ? `&machine_id=${machine.id}` : '';
    navigate(`${basePath}?target_user=${company.ownerId}${machineParam}`);
  };

  // Handle direct booking
  const handleOpenBooking = (m: Machine) => {
    setSelectedMachineForBooking(m);
    setIsBookingModalOpen(true);
  };

  // Custom Price Marker Generator for Leaflet
  const createMapMarkerIcon = (m: Machine, isSelected: boolean) => {
    const isRent = m.listing_mode !== 'sale';
    const priceText = isRent
      ? `${(m.rate_daily || 0).toLocaleString('fr-FR')} ${lang === 'fr' ? 'DH' : 'د.م'}`
      : `${Math.round((m.sale_price || 0) / 1000)}k ${lang === 'fr' ? 'DH' : 'د.م'}`;

    return L.divIcon({
      className: 'custom-store-pin',
      html: `
        <div style="
          background-color: ${isSelected ? '#0B1220' : '#FFB400'};
          color: ${isSelected ? '#FFB400' : '#0B1220'};
          padding: 5px 9px;
          border-radius: 9999px;
          font-weight: 900;
          font-size: 11px;
          font-family: system-ui, -apple-system, sans-serif;
          white-space: nowrap;
          box-shadow: ${isSelected ? '0 8px 20px rgba(0,0,0,0.45)' : '0 4px 12px rgba(0,0,0,0.25)'};
          border: 2px solid ${isSelected ? '#FFB400' : '#FFFFFF'};
          display: flex;
          align-items: center;
          gap: 4px;
          transform: translate(-50%, -100%) scale(${isSelected ? '1.15' : '1'});
          transition: all 0.2s ease;
          cursor: pointer;
        ">
          <span>🚜</span>
          <span>${priceText}</span>
        </div>
      `,
      iconSize: [80, 28],
      iconAnchor: [40, 28],
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
        <PublicHeader />
        <main className="flex-1 pb-16">
          <Skeleton className="h-64 w-full" />
          <div className="max-w-7xl mx-auto px-4 -mt-16 space-y-6">
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-80 w-full rounded-3xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
        <PublicHeader />
        <main className="flex-1 max-w-md mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-16 h-16 text-danger mx-auto mb-3" />
          <h2 className="text-xl font-black text-ink mb-2">
            {lang === 'fr' ? 'Vitrine introuvable' : 'تعذر تحميل المتجر'}
          </h2>
          <p className="text-xs text-steel-500 mb-6">
            {lang === 'fr' ? 'Impossible d\'accéder à la vitrine demandée.' : 'يرجى التحقق من الرابط أو إعادة المحاولة.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={loadStorefront}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
      <PublicHeader />

      <main className="flex-1 pb-16">
        {/* 1. Full-width Branded Banner */}
        <div className="relative h-52 sm:h-72 lg:h-88 w-full overflow-hidden bg-ink">
          <img
            src={company.banner}
            alt={company.name}
            className="w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />

          {/* Floating Share Link Button on Banner */}
          <div className="absolute top-4 end-4 z-20">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-ink text-xs font-bold border border-steel-200 shadow-md hover:bg-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isLinkCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-steel-700" />}
              <span>{isLinkCopied ? (lang === 'fr' ? 'Copié !' : 'تم النسخ!') : (lang === 'fr' ? 'Partager le magasin' : 'مشاركة رابط المتجر')}</span>
            </button>
          </div>
        </div>

        {/* 2. Company Identity Card & Quick Actions Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 sm:-mt-24 relative z-10 text-start">
          <Card className="p-6 sm:p-8 bg-white border border-steel-200 shadow-xl rounded-3xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Identity & Verified Badges */}
              <div className="flex items-start sm:items-center gap-4 sm:gap-5">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white flex items-center justify-center font-black text-ink text-2xl shadow-xl shrink-0 overflow-hidden bg-white"
                  style={{ backgroundColor: company.theme_color }}
                >
                  {company.avatar ? (
                    <img
                      src={company.avatar}
                      alt={company.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    company.name.slice(0, 2).toUpperCase()
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-ink">
                      {company.name}
                    </h1>
                    <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t('storefront.ice_verified')}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel-600">
                    <span className="flex items-center gap-1 font-semibold text-steel-700">
                      <MapPin className="w-3.5 h-3.5 text-primary-dark" />
                      {company.city}
                    </span>
                    <span className="text-steel-300">·</span>
                    <span className="font-mono text-steel-500 font-semibold">ICE: {company.ice}</span>
                    <span className="text-steel-300">·</span>
                    <span className="flex items-center gap-1 text-amber-600 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      4.9 (18 {lang === 'fr' ? 'chantiers' : 'ورش ناجح'})
                    </span>
                  </div>

                  {/* Trust Highlights */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold text-steel-600">
                    <span className="px-2 py-0.5 rounded-md bg-steel-100 text-steel-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {lang === 'fr' ? 'Chauffeurs certifiés' : 'سائقون معتمدون'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-steel-100 text-steel-800 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-primary-dark" />
                      {lang === 'fr' ? 'Transport porte-char' : 'نقل بالسطحة متاح'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-steel-100 text-steel-800 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-steel-600" />
                      {lang === 'fr' ? 'Disponibilité immédiate' : 'جاهزية فورية'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct Actions Strip for Contractors (WhatsApp + Call + Chat) */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-steel-100">
                {/* 1. WhatsApp Action */}
                <a
                  href={getWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[44px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{lang === 'fr' ? 'WhatsApp Direct' : 'واتساب فوري'}</span>
                </a>

                {/* 2. Direct Call Action */}
                <a
                  href={`tel:${company.phone}`}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-ink hover:bg-steel-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[44px]"
                >
                  <Phone className="w-4 h-4 text-primary" />
                  <span>{t('machine_detail.call_phone')}</span>
                </a>

                {/* 3. Internal Platform Chat */}
                <button
                  type="button"
                  onClick={() => handleStartInternalChat()}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-ink border border-amber-300 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-xs transition-all cursor-pointer min-h-[44px]"
                >
                  <MessageSquare className="w-4 h-4 text-primary-dark" />
                  <span>{lang === 'fr' ? 'Chat JADIJCB' : 'محادثة المنصة'}</span>
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* 3. Company About Card */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <Card className="p-5 sm:p-6 bg-white border border-steel-200 shadow-soft rounded-2xl">
            <h2 className="text-xs font-black text-ink uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-primary-dark" />
              <span>{t('storefront.about_company')}</span>
            </h2>
            <p className="text-xs sm:text-sm text-steel-600 leading-relaxed font-medium">
              {lang === 'fr' ? company.about_fr : company.about_ar}
            </p>
          </Card>
        </div>

        {/* 4. Practical Contractor Search, Filter & View Control Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-white border border-steel-200 rounded-3xl p-4 sm:p-5 shadow-soft space-y-4">
            {/* Top Bar: Search Input + View Mode Switcher (Grid vs Map) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Field */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-steel-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    lang === 'fr'
                      ? 'Rechercher par engin, modèle (JCB 3CX, CAT 320, Benne)...'
                      : 'ابحث عن آلية، موديل (JCB, CAT, Volvo) أو نوع الأشغال...'
                  }
                  className="w-full ps-10 pe-4 py-2.5 text-xs font-semibold bg-surface border border-steel-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px] text-start"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-steel-400 hover:text-ink cursor-pointer p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View Switcher: Grid View vs Interactive Map Search */}
              <div className="flex items-center gap-1 bg-surface p-1 rounded-2xl border border-steel-200 shrink-0 self-center sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer min-h-[38px] ${
                    viewMode === 'grid'
                      ? 'bg-ink text-primary shadow-sm'
                      : 'text-steel-600 hover:text-ink'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                  <span>{lang === 'fr' ? 'Grille' : 'عرض البطاقات'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer min-h-[38px] ${
                    viewMode === 'map'
                      ? 'bg-ink text-primary shadow-sm'
                      : 'text-steel-600 hover:text-ink'
                  }`}
                >
                  <MapIcon className="w-4 h-4 text-primary" />
                  <span>{lang === 'fr' ? 'Recherche sur Carte' : 'البحث في الخريطة 📍'}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-primary/20 text-ink text-[10px] font-mono">
                    {filteredMachines.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Bottom Filters: Listing Mode + Category Chips + Features */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-steel-100">
              {/* Category & Mode Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Rent / Sale Tabs */}
                <div className="flex items-center gap-1 bg-steel-100/80 p-0.5 rounded-xl me-2">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterMode === 'all' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
                    }`}
                  >
                    {t('machines.filter_all')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('rent')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterMode === 'rent' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
                    }`}
                  >
                    {t('machines.filter_rent')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('sale')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterMode === 'sale' ? 'bg-white text-ink shadow-xs' : 'text-steel-600'
                    }`}
                  >
                    {t('machines.filter_sale')}
                  </button>
                </div>

                {/* Category Chips */}
                {[
                  { id: 'all', label: lang === 'fr' ? 'Tous les types' : 'جميع الأنواع' },
                  { id: 'loader', label: lang === 'fr' ? 'Tractopelles JCB' : 'جرافات JCB' },
                  { id: 'excavator', label: lang === 'fr' ? 'Pelles Hydrauliques' : 'حفارات' },
                  { id: 'truck', label: lang === 'fr' ? 'Camions Bennes' : 'شاحنات نقل' },
                  { id: 'compactor', label: lang === 'fr' ? 'Compacteurs' : 'مداحل' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      categoryFilter === cat.id
                        ? 'bg-ink text-primary border-ink'
                        : 'bg-white text-steel-700 border-steel-200 hover:border-steel-400'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Checkbox Quick Toggles (with Driver / Fuel) */}
              <div className="flex items-center gap-3 text-xs font-bold text-steel-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withOperatorOnly}
                    onChange={(e) => setWithOperatorOnly(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <span>{lang === 'fr' ? 'Avec chauffeur' : 'مع سائق معتمد'}</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fuelIncludedOnly}
                    onChange={(e) => setFuelIncludedOnly(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <span>{lang === 'fr' ? 'Carburant inclus' : 'شامل الكازوال'}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Main Content Area: Grid View OR Interactive Map View */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          {filteredMachines.length === 0 ? (
            <Card className="p-12 text-center bg-white border border-steel-200 rounded-3xl">
              <Truck className="w-12 h-12 text-steel-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-ink mb-1">
                {lang === 'fr' ? 'Aucun engin correspondant' : 'لا توجد آليات مطابقة لخيارات البحث'}
              </h3>
              <p className="text-xs text-steel-500 mb-4 max-w-sm mx-auto">
                {lang === 'fr'
                  ? 'Essayez de réinitialiser vos filtres ou de modifier votre terme de recherche.'
                  : 'يرجى تجربة تعديل عبارة البحث أو إلغاء بعض عوامل التصفية لعرض جميع آليات الأسطول.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                  setCategoryFilter('all');
                  setWithOperatorOnly(false);
                  setFuelIncludedOnly(false);
                }}
              >
                {lang === 'fr' ? 'Réinitialiser les filtres' : 'إعادة ضبط عوامل البحث'}
              </Button>
            </Card>
          ) : viewMode === 'grid' ? (
            /* ========================================================== */
            /* VIEW A: Standard Card Grid with Direct Action Buttons      */
            /* ========================================================== */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-steel-500">
                <span>
                  {lang === 'fr'
                    ? `Affichage de ${filteredMachines.length} engin(s) disponible(s)`
                    : `عرض ${filteredMachines.length} آلية متاحة للعمل الفوري`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredMachines.map((machine) => (
                  <div key={machine.id} className="relative group">
                    <MachineCard machine={machine} />

                    {/* Quick Storefront Actions Overlay Bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenBooking(machine)}
                        className="flex-1 font-black text-xs py-2 shadow-xs"
                        leftIcon={<CalendarCheck className="w-3.5 h-3.5" />}
                      >
                        {lang === 'fr' ? 'Demande de location' : 'طلب كراء'}
                      </Button>

                      <button
                        type="button"
                        onClick={() => handleStartInternalChat(machine)}
                        title={lang === 'fr' ? 'Discuter avec le loueur' : 'محادثة المالك'}
                        className="p-2 rounded-xl bg-white border border-steel-300 text-steel-700 hover:text-ink hover:bg-steel-50 shadow-xs transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-primary-dark" />
                      </button>

                      <a
                        href={getWhatsAppLink(machine)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp"
                        className="p-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100 shadow-xs transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* VIEW B: Interactive Map Search View (البحث في الخريطة)     */
            /* ========================================================== */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-steel-600 bg-white p-3 rounded-2xl border border-steel-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {lang === 'fr'
                      ? `Carte des engins de ${company.name} (${filteredMachines.length} localisés)`
                      : `خريطة مواقع آليات ورش ${company.name} (${filteredMachines.length} موقع محدد)`}
                  </span>
                </div>
                <span className="text-steel-400 font-mono text-[11px]">
                  {lang === 'fr' ? 'Cliquez sur un marqueur pour réserver' : 'انقر على أي آلية على الخريطة للحجز الفوري'}
                </span>
              </div>

              {/* Map & Interactive Side Panel Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left/Main Map Container (8 cols) */}
                <div className="lg:col-span-8 relative w-full h-[540px] lg:h-[640px] rounded-3xl overflow-hidden border-2 border-steel-200 shadow-lg">
                  <MapContainer
                    center={[
                      selectedMapMachine?.lat || 33.5333,
                      selectedMapMachine?.lng || -7.6333,
                    ]}
                    zoom={11}
                    scrollWheelZoom={true}
                    className="w-full h-full z-10"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {filteredMachines.map((m) => {
                      const lat = m.lat || m.location_lat || 33.5731;
                      const lng = m.lng || m.location_lng || -7.5898;
                      const isSelected = selectedMapMachine?.id === m.id;

                      return (
                        <Marker
                          key={m.id}
                          position={[lat, lng]}
                          icon={createMapMarkerIcon(m, isSelected)}
                          eventHandlers={{
                            click: () => {
                              setSelectedMapMachine(m);
                            },
                          }}
                        >
                          <Popup className="custom-leaflet-popup" closeButton={false}>
                            <div className="p-3 max-w-[260px] text-start space-y-2" dir={isRTL ? 'rtl' : 'ltr'}>
                              {/* Thumbnail */}
                              <div className="relative h-28 rounded-xl overflow-hidden bg-steel-100">
                                <img
                                  src={m.images[0]}
                                  alt={m.title_ar}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute top-2 start-2 px-2 py-0.5 rounded-full bg-ink/90 text-primary text-[10px] font-black">
                                  {m.brand} {m.model}
                                </span>
                              </div>

                              <div>
                                <h4 className="text-xs font-black text-ink line-clamp-1">
                                  {lang === 'fr' ? m.title_fr : m.title_ar}
                                </h4>
                                <p className="text-[11px] text-steel-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 text-primary-dark shrink-0" />
                                  <span className="truncate">{m.city}</span>
                                </p>
                              </div>

                              {/* Price */}
                              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                                <span className="text-[10px] text-steel-600 font-bold">
                                  {m.listing_mode === 'sale' ? (lang === 'fr' ? 'Prix de vente' : 'سعر البيع') : (lang === 'fr' ? 'Tarif journalier' : 'السعر اليومي')}
                                </span>
                                <span className="text-xs font-black text-ink font-mono">
                                  {formatPriceMAD(m.rate_daily || 0, lang)} / {lang === 'fr' ? 'jour' : 'يوم'}
                                </span>
                              </div>

                              {/* Popup Action Buttons */}
                              <div className="flex items-center gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenBooking(m)}
                                  className="flex-1 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-ink text-[11px] font-black shadow-xs transition-colors cursor-pointer text-center"
                                >
                                  {lang === 'fr' ? 'Réserver' : 'حجز الآن'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartInternalChat(m)}
                                  className="p-1.5 rounded-lg bg-white border border-steel-200 text-steel-700 hover:text-ink cursor-pointer"
                                  title="Chat"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-primary-dark" />
                                </button>
                                <a
                                  href={`/marketplace/${m.id}`}
                                  className="p-1.5 rounded-lg bg-white border border-steel-200 text-steel-700 hover:text-ink cursor-pointer"
                                  title="Details"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>

                {/* Right Machine Details Inspector Card (4 cols) */}
                <div className="lg:col-span-4 space-y-4">
                  {selectedMapMachine ? (
                    <Card className="p-5 bg-white border-2 border-primary/40 rounded-3xl shadow-md text-start space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full bg-primary/20 text-ink text-xs font-black">
                          {lang === 'fr' ? 'Engin sélectionné sur carte' : 'الآلية المحددة على الخريطة'}
                        </span>
                        <span className="text-xs font-mono font-bold text-steel-500">
                          {selectedMapMachine.year}
                        </span>
                      </div>

                      {/* Image Preview */}
                      <div className="relative h-44 rounded-2xl overflow-hidden bg-steel-100 border border-steel-200">
                        <img
                          src={selectedMapMachine.images[0]}
                          alt={selectedMapMachine.title_ar}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 start-2 end-2 p-2 rounded-xl bg-ink/80 backdrop-blur-md text-white flex items-center justify-between text-xs">
                          <span className="font-bold truncate">{selectedMapMachine.city}</span>
                          <span className="font-black text-primary font-mono shrink-0">
                            {formatPriceMAD(selectedMapMachine.rate_daily || 0, lang)} / {lang === 'fr' ? 'jour' : 'يوم'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-black text-ink">
                          {lang === 'fr' ? selectedMapMachine.title_fr : selectedMapMachine.title_ar}
                        </h3>
                        <p className="text-xs text-steel-500 mt-1 line-clamp-2">
                          {lang === 'fr' ? selectedMapMachine.description_fr : selectedMapMachine.description_ar}
                        </p>
                      </div>

                      {/* Quick Specs Chips */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                        <div className="p-2 rounded-xl bg-surface border border-steel-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{selectedMapMachine.with_operator ? (lang === 'fr' ? 'Avec chauffeur' : 'مع سائق معتمد') : (lang === 'fr' ? 'Sans chauffeur' : 'بدون سائق')}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-surface border border-steel-200 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-primary-dark" />
                          <span>{selectedMapMachine.delivery_available ? (lang === 'fr' ? 'Porte-char dispo' : 'سطحة نقل متوفرة') : (lang === 'fr' ? 'Sur site' : 'استلام بالموقع')}</span>
                        </div>
                      </div>

                      {/* CTAs */}
                      <div className="space-y-2 pt-2 border-t border-steel-100">
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          onClick={() => handleOpenBooking(selectedMapMachine)}
                          className="w-full justify-center font-black shadow-md text-sm"
                          leftIcon={<CalendarCheck className="w-4 h-4" />}
                        >
                          {lang === 'fr' ? 'Réserver cet engin maintenant' : 'طلب كراء هذه الآلية الآن'}
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartInternalChat(selectedMapMachine)}
                            className="flex-1 justify-center text-xs font-bold"
                            leftIcon={<MessageSquare className="w-3.5 h-3.5 text-primary-dark" />}
                          >
                            {lang === 'fr' ? 'Chatter' : 'محادثة المالك'}
                          </Button>

                          <a
                            href={getWhatsAppLink(selectedMapMachine)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold shadow-xs transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    </Card>
                  ) : null}

                  {/* Quick Carousel List of Other Machines on Map */}
                  <div className="bg-white p-4 rounded-3xl border border-steel-200 shadow-soft space-y-2.5">
                    <h4 className="text-xs font-black text-ink">
                      {lang === 'fr' ? 'Tous les engins localisés :' : 'جميع الآليات المعروضة على الخريطة :'}
                    </h4>

                    <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                      {filteredMachines.map((m) => {
                        const isCurrent = selectedMapMachine?.id === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => setSelectedMapMachine(m)}
                            className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isCurrent
                                ? 'bg-amber-50/80 border-primary shadow-xs'
                                : 'bg-surface border-steel-200 hover:border-steel-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={m.images[0]}
                                alt={m.title_ar}
                                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-steel-200"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-black text-ink truncate">
                                  {m.brand} {m.model}
                                </p>
                                <p className="text-[10px] text-steel-500 truncate">{m.city}</p>
                              </div>
                            </div>

                            <span className="text-xs font-black text-ink font-mono shrink-0">
                              {formatPriceMAD(m.rate_daily || 0, lang)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Direct Booking Modal for Contractors */}
      {selectedMachineForBooking && (
        <CreateBookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedMachineForBooking(null);
          }}
          machines={[selectedMachineForBooking]}
          existingBookings={[]}
          onBookingCreated={() => {
            setIsBookingModalOpen(false);
            setSelectedMachineForBooking(null);
            toast.success(
              lang === 'fr'
                ? 'Votre demande de location a été transmise au propriétaire avec succès !'
                : 'تم إرسال طلب الكراء لمالك الآلية بنجاح، وستتلقى إشعاراً عند التأكيد!'
            );
          }}
        />
      )}

      <Footer />
    </div>
  );
};

export default PublicStorefrontPage;
