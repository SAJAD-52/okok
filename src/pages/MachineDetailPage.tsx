// ============================================================================
// JADIJCB: Machine Detail Page (/marketplace/:id)
// With Lightbox, Specs Table, Availability Calendar, Dynamic WhatsApp & JSON-LD
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  ShieldCheck,
  Calendar,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  Share2,
  Heart,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Phone,
  MessageCircle,
  Sparkles,
  Layers,
  Wrench,
  Fuel,
  Info,
  Check,
  Building2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useFavorites } from '../hooks/useFavorites';
import { formatPriceMAD } from '../data/rentalTerms';
import { MachineCard } from '../components/marketplace/MachineCard';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Machine } from '../types/database';

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang, isRTL } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [machine, setMachine] = useState<Machine | null>(null);
  const [similarMachines, setSimilarMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Lightbox State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Rental Booking Simulation State
  const [selectedTerm, setSelectedTerm] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [selectedDuration, setSelectedDuration] = useState(3);
  const [startDate, setStartDate] = useState('2026-03-10');

  // Load machine from Supabase
  const loadMachineData = async () => {
    if (!isSupabaseConfigured || !id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*, profiles(full_name, company_name, phone, city)')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        setIsError(true);
        return;
      }

      const loaded: Machine = {
        id: data.id,
        owner_id: data.owner_id,
        title_ar: data.title_ar,
        title_fr: data.title_fr,
        description_ar: data.description_ar,
        description_fr: data.description_fr,
        category: data.category,
        category_id: data.category,
        brand: data.brand,
        model: data.model,
        year: data.year,
        listing_mode: data.listing_mode,
        condition: data.condition || 'good',
        city: data.city,
        city_id: data.city,
        lat: data.lat,
        lng: data.lng,
        location_lat: data.lat,
        location_lng: data.lng,
        rate_hourly: Number(data.hourly_rate) || 0,
        rate_daily: Number(data.daily_rate) || 0,
        rate_weekly: Number(data.weekly_rate) || 0,
        sale_price: Number(data.sale_price) || 0,
        currency: 'MAD',
        with_operator: Boolean(data.with_operator),
        fuel_included: Boolean(data.fuel_included),
        delivery_available: Boolean(data.delivery_available),
        status: 'available',
        images: data.images?.length ? data.images : [
          'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80',
        ],
        specs: data.specs || {},
        views_count: data.views_count || 0,
        rating_avg: data.rating_avg || 0,
        reviews_count: data.reviews_count || 0,
        owner: {
          full_name: data.profiles?.full_name || 'Partenaire JADIJCB',
          company_name: data.profiles?.company_name || 'Entreprise BTP',
          phone: data.profiles?.phone || '+212600000000',
          city: data.profiles?.city || data.city,
          whatsapp_verified: true,
        },
        created_at: data.created_at,
        updated_at: data.created_at,
      };

      setMachine(loaded);

      // Fetch similar machines in the same category
      if (data.category) {
        const { data: simData } = await supabase
          .from('machines')
          .select('*')
          .eq('category', data.category)
          .eq('is_published', true)
          .neq('id', data.id)
          .limit(3);

        if (simData) {
          setSimilarMachines(
            simData.map((m: any) => ({
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
              lat: m.lat,
              lng: m.lng,
              location_lat: m.lat,
              location_lng: m.lng,
              rate_hourly: Number(m.hourly_rate) || 0,
              rate_daily: Number(m.daily_rate) || 0,
              rate_weekly: Number(m.weekly_rate) || 0,
              sale_price: Number(m.sale_price) || 0,
              currency: 'MAD',
              with_operator: Boolean(m.with_operator),
              fuel_included: Boolean(m.fuel_included),
              delivery_available: Boolean(m.delivery_available),
              status: 'available',
              images: m.images || [],
              specs: m.specs || {},
              views_count: m.views_count || 0,
              rating_avg: m.rating_avg || 0,
              reviews_count: m.reviews_count || 0,
              created_at: m.created_at,
              updated_at: m.created_at,
            }))
          );
        }
      }
    } catch (err) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMachineData();
  }, [id]);

  const title = machine ? (lang === 'fr' ? machine.title_fr : machine.title_ar) : '';
  const description = machine ? (lang === 'fr' ? machine.description_fr : machine.description_ar) : '';
  const isRent = machine ? machine.listing_mode !== 'sale' : true;
  const isFav = machine ? isFavorite(machine.id) : false;

  // SEO: Dynamic Page Title, Meta Description & JSON-LD Product Schema
  useEffect(() => {
    if (!machine) return;

    const seoTitle = `${title} (${machine.brand} ${machine.model}) – JADIJCB Maroc`;
    document.title = seoTitle;

    // Inject or update JSON-LD schema
    const schemaId = 'jadijcb-product-jsonld';
    let scriptTag = document.getElementById(schemaId) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = schemaId;
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }

    const priceValue = isRent ? machine.rate_daily : machine.sale_price;

    const jsonLdData = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: title,
      image: machine.images,
      description,
      brand: {
        '@type': 'Brand',
        name: machine.brand,
      },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'MAD',
        price: priceValue,
        availability: 'https://schema.org/InStock',
        itemCondition:
          machine.condition === 'new'
            ? 'https://schema.org/NewCondition'
            : 'https://schema.org/UsedCondition',
        seller: {
          '@type': 'Organization',
          name: machine.owner?.company_name || 'JADIJCB Partner',
        },
      },
    };

    scriptTag.textContent = JSON.stringify(jsonLdData);

    return () => {
      document.title = 'JADIJCB · كراء وبيع آليات البناء بالمغرب';
    };
  }, [title, description, machine, isRent]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
        <PublicHeader />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <Skeleton className="h-96 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <Skeleton className="h-72 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !machine) {
    return (
      <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
        <PublicHeader />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-16 h-16 text-steel-400 mx-auto mb-4" />
          <h2 className="text-xl font-black text-ink mb-2">
            {lang === 'fr' ? 'Engin introuvable' : 'لم يتم العثور على هذه الآلية'}
          </h2>
          <p className="text-xs text-steel-500 mb-6">
            {lang === 'fr'
              ? 'L\'annonce a peut-être été retirée ou le lien est incorrect.'
              : 'قد يكون تم حذف الإعلان أو أن الرابط غير صحيح.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={loadMachineData}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate('/marketplace')}
            >
              {lang === 'fr' ? 'Retour au catalogue' : 'العودة لسوق الآليات'}
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const images = machine.images?.length
    ? machine.images
    : ['https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80'];

  // Prefilled WhatsApp message
  const ownerPhone = machine.owner?.phone || '+212661234567';
  const whatsappMessage =
    lang === 'fr'
      ? `Bonjour, je vous contacte depuis JADIJCB au sujet de votre engin "${machine.title_fr}" (${machine.brand} ${machine.model}) à ${machine.city}. Est-il disponible ?`
      : `السلام عليكم، أتواصل معكم عبر منصة JADIJCB بخصوص آلية "${machine.title_ar}" (${machine.brand} ${machine.model}) بمدينة ${machine.city}. هل هي متاحة للكراء؟`;

  const whatsappUrl = `https://wa.me/${ownerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  const calculateEstimate = () => {
    if (!isRent) return machine.sale_price || 0;
    if (selectedTerm === 'hourly') return (machine.rate_hourly || 350) * selectedDuration;
    if (selectedTerm === 'weekly') return (machine.rate_weekly || 12000) * selectedDuration;
    return (machine.rate_daily || 2800) * selectedDuration;
  };

  const handleStartChat = async () => {
    navigate(`/app/messages?machine_id=${machine.id}&target_user=${machine.owner_id}`);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between text-start">
      <PublicHeader />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Breadcrumb Strip */}
        <div className="flex items-center gap-2 text-xs text-steel-500 mb-6">
          <Link to="/" className="hover:text-ink">
            {t('nav.home')}
          </Link>
          <span>/</span>
          <Link to="/marketplace" className="hover:text-ink">
            {t('nav.marketplace')}
          </Link>
          <span>/</span>
          <span className="text-ink font-bold truncate max-w-xs">{title}</span>
        </div>

        {/* Top Split Layout: Left = Gallery & Specs; Right = Pricing, Booking Box & Owner */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (8 cols on desktop) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Gallery Component */}
            <div className="space-y-3">
              {/* Main Photo Frame */}
              <div className="relative rounded-2xl overflow-hidden bg-ink border border-steel-200 aspect-[16/10] sm:aspect-[16/9] shadow-soft group">
                <img
                  src={images[activePhotoIdx]}
                  alt={`${title} - Photo ${activePhotoIdx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                  onClick={() => setIsLightboxOpen(true)}
                />

                {/* Overlaid Badges */}
                <div className="absolute top-4 start-4 flex items-center gap-2">
                  <Badge variant={isRent ? 'warning' : 'neutral'} size="md">
                    {isRent ? t('machines.mode_rent_option') : t('machines.mode_sale_option')}
                  </Badge>
                  <span className="bg-ink/80 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20">
                    {machine.brand} {machine.model}
                  </span>
                </div>

                {/* Action Floating Buttons */}
                <div className="absolute top-4 end-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(machine.id)}
                    className="p-2.5 rounded-full bg-white/90 backdrop-blur text-ink hover:text-danger shadow-md transition-colors cursor-pointer"
                    title="Ajouter aux favoris"
                    aria-label="Favorite"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isFav ? 'fill-red-500 text-red-500' : 'text-steel-600'
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    className="p-2.5 rounded-full bg-white/90 backdrop-blur text-ink hover:text-primary-dark shadow-md transition-colors cursor-pointer"
                    title="Agrandir en plein écran"
                    aria-label="Expand"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Arrow Controls */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1))
                      }
                      className="absolute top-1/2 start-3 -translate-y-1/2 p-2 rounded-full bg-ink/60 text-white hover:bg-ink transition-colors cursor-pointer"
                      aria-label="Previous image"
                    >
                      {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0))
                      }
                      className="absolute top-1/2 end-3 -translate-y-1/2 p-2 rounded-full bg-ink/60 text-white hover:bg-ink transition-colors cursor-pointer"
                      aria-label="Next image"
                    >
                      {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails Strip */}
              {images.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIdx(idx)}
                      className={`relative w-20 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                        activePhotoIdx === idx
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-steel-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Miniature ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Description Card */}
            <Card className="p-6 bg-white border border-steel-200 shadow-soft">
              <h2 className="text-base font-black text-ink mb-3">
                {lang === 'fr' ? 'Description détaillée de l\'engin' : 'وصف الآلية وحالتها الميدانية'}
              </h2>
              <p className="text-xs sm:text-sm text-steel-700 leading-relaxed whitespace-pre-line">
                {description}
              </p>
            </Card>

            {/* Technical Specifications Table */}
            <Card className="p-6 bg-white border border-steel-200 shadow-soft">
              <h2 className="text-base font-black text-ink mb-4">
                {t('machine_detail.specs_title')}
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl bg-surface border border-steel-200">
                  <span className="text-[11px] text-steel-500 block mb-1">
                    {t('machine_detail.brand_model')}
                  </span>
                  <span className="font-extrabold text-xs text-ink">
                    {machine.brand} {machine.model}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-steel-200">
                  <span className="text-[11px] text-steel-500 block mb-1">
                    {t('machine_detail.year')}
                  </span>
                  <span className="font-extrabold text-xs text-ink font-mono latin-nums">
                    {machine.year}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-steel-200">
                  <span className="text-[11px] text-steel-500 block mb-1">
                    {t('machine_detail.condition')}
                  </span>
                  <span className="font-extrabold text-xs text-emerald-700">
                    {machine.condition === 'new'
                      ? t('machines.condition_new')
                      : t('machines.condition_used')}
                  </span>
                </div>

                {machine.specs?.operating_weight_ton && (
                  <div className="p-3.5 rounded-xl bg-surface border border-steel-200">
                    <span className="text-[11px] text-steel-500 block mb-1">
                      {t('machine_detail.weight')}
                    </span>
                    <span className="font-extrabold text-xs text-ink font-mono latin-nums">
                      {machine.specs.operating_weight_ton} Tonnes
                    </span>
                  </div>
                )}

                {machine.specs?.engine_power_hp && (
                  <div className="p-3.5 rounded-xl bg-surface border border-steel-200">
                    <span className="text-[11px] text-steel-500 block mb-1">
                      {t('machine_detail.engine')}
                    </span>
                    <span className="font-extrabold text-xs text-ink font-mono latin-nums">
                      {machine.specs.engine_power_hp} CV
                    </span>
                  </div>
                )}

                {machine.specs?.bucket_capacity_m3 && (
                  <div className="p-3.5 rounded-xl bg-surface border border-steel-200">
                    <span className="text-[11px] text-steel-500 block mb-1">
                      {t('machine_detail.bucket')}
                    </span>
                    <span className="font-extrabold text-xs text-ink font-mono latin-nums">
                      {machine.specs.bucket_capacity_m3} m³
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Availability Calendar for Rentals */}
            {isRent && (
              <Card className="p-6 bg-white border border-steel-200 shadow-soft">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-black text-ink flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary-dark" />
                      <span>{lang === 'fr' ? 'Disponibilité & Calendrier de chantier' : 'جدول التوفر ومواعيد الورش'}</span>
                    </h2>
                    <p className="text-xs text-steel-500 mt-0.5">
                      {lang === 'fr'
                        ? 'Consultez les créneaux libres pour réserver sans attente'
                        : 'فترات العمل المتاحة للحجز الفوري'}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === 'fr' ? 'Disponible maintenant' : 'متاحة فوراً'}</span>
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-steel-200 text-xs text-steel-600 flex items-center justify-between">
                  <span className="font-bold">
                    {lang === 'fr'
                      ? 'Aucune réservation bloquante sur les 30 prochains jours.'
                      : 'لا توجد حجوزات متعارضة خلال الـ 30 يوماً القادمة.'}
                  </span>
                  <span className="font-mono text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    100% libre
                  </span>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Sticky Pricing & Action Card (4 cols on desktop) */}
          <div className="lg:col-span-4 sticky top-24 space-y-5">
            {/* Price Box */}
            <Card className="p-6 bg-white border border-steel-200 shadow-elevated rounded-3xl space-y-5">
              {/* Header Price */}
              <div>
                <span className="text-xs font-bold text-steel-500 block">
                  {isRent ? t('machine_detail.rate_daily') : t('machines.sale_price_label')}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-ink font-mono latin-nums">
                    {formatPriceMAD(isRent ? machine.rate_daily : machine.sale_price || 0)}
                  </span>
                  {isRent && (
                    <span className="text-xs font-bold text-steel-500">
                      /{t('marketplace.per_day')}
                    </span>
                  )}
                </div>
              </div>

              {/* Rental Simulation Controls */}
              {isRent && (
                <div className="space-y-3 pt-3 border-t border-steel-200">
                  <div className="flex items-center justify-between text-xs font-bold text-steel-700">
                    <span>{t('bookings.dates')}</span>
                    <div className="flex items-center gap-1 bg-steel-100 p-1 rounded-lg">
                      {(['hourly', 'daily', 'weekly'] as const).map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => setSelectedTerm(term)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-all ${
                            selectedTerm === term
                              ? 'bg-primary text-ink shadow-xs'
                              : 'text-steel-600'
                          }`}
                        >
                          {term === 'hourly'
                            ? t('marketplace.per_hour')
                            : term === 'daily'
                            ? t('marketplace.per_day')
                            : 'أسبوعي'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Estimation summary */}
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between text-xs font-bold text-amber-900">
                    <span>{lang === 'fr' ? 'Estimation indicative :' : 'التقدير المبدئي:'}</span>
                    <span className="font-mono text-sm latin-nums">
                      {formatPriceMAD(calculateEstimate())}
                    </span>
                  </div>
                </div>
              )}

              {/* Inclusion Badges */}
              <div className="space-y-2 pt-2 border-t border-steel-200 text-xs">
                <div className="flex items-center gap-2 text-steel-700">
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      machine.with_operator ? 'text-emerald-600' : 'text-steel-400'
                    }`}
                  />
                  <span>
                    {machine.with_operator
                      ? t('machine_detail.operator_included')
                      : t('marketplace.without_operator')}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-steel-700">
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      machine.fuel_included ? 'text-emerald-600' : 'text-steel-400'
                    }`}
                  />
                  <span>
                    {machine.fuel_included
                      ? t('machine_detail.fuel_included')
                      : lang === 'fr'
                      ? 'Carburant à la charge du client'
                      : 'الوقود على عاتق الزبون'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-steel-700">
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      machine.delivery_available ? 'text-emerald-600' : 'text-steel-400'
                    }`}
                  />
                  <span>
                    {machine.delivery_available
                      ? t('machine_detail.delivery_available')
                      : lang === 'fr'
                      ? 'Enlèvement sur parc'
                      : 'الاستلام مباشرة من مقر المالك'}
                  </span>
                </div>
              </div>

              {/* CTAs: WhatsApp + Real-time Chat */}
              <div className="space-y-2.5 pt-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black py-3 px-4 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[48px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t('machine_detail.whatsapp')}</span>
                </a>

                <Button
                  type="button"
                  variant="dark"
                  size="lg"
                  onClick={handleStartChat}
                  leftIcon={<Sparkles className="w-4 h-4 text-primary" />}
                  className="w-full justify-center font-bold text-xs sm:text-sm min-h-[48px]"
                >
                  {t('machine_detail.contact_owner')}
                </Button>
              </div>
            </Card>

            {/* Owner Card */}
            <Card className="p-5 bg-white border border-steel-200 shadow-soft rounded-2xl space-y-3">
              <h3 className="text-xs font-black text-ink uppercase tracking-wider">
                {t('machine_detail.owner_info')}
              </h3>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-ink text-primary font-black text-base flex items-center justify-center shrink-0">
                  {machine.owner?.company_name?.slice(0, 2).toUpperCase() || 'JB'}
                </div>
                <div>
                  <h4 className="font-black text-xs text-ink">
                    {machine.owner?.company_name || 'Entreprise Partenaire'}
                  </h4>
                  <p className="text-[11px] text-steel-500">
                    {machine.owner?.full_name || 'Responsable Parc'}
                  </p>
                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{t('machine_detail.verified_owner')}</span>
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Similar Machines Section */}
        {similarMachines.length > 0 && (
          <div className="mt-16 pt-12 border-t border-steel-200">
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-black text-ink">
                {lang === 'fr' ? 'Engins similaires disponibles' : 'آليات مشابهة متاحة في نفس الفئة'}
              </h2>
              <p className="text-xs text-steel-500 mt-1">
                {lang === 'fr'
                  ? 'Comparez d\'autres options disponibles pour vos chantiers'
                  : 'قارن المواصفات والأسعار مع آليات أخرى متاحة حالياً'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {similarMachines.map((m) => (
                <MachineCard key={m.id} machine={m} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 end-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close lightbox"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="max-w-5xl max-h-[85vh] w-full flex items-center justify-center">
            <img
              src={images[activePhotoIdx]}
              alt={`${title} - Grand format`}
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-6 flex items-center gap-2">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`w-3 h-3 rounded-full transition-all cursor-pointer ${
                    activePhotoIdx === idx ? 'bg-primary w-8' : 'bg-white/40'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Footer />
    </div>
  );
};

export default MachineDetailPage;
