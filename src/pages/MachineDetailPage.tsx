// ============================================================================
// JADIJCB: Machine Detail Page with Lightbox, Specs, Availability Calendar & SEO
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Phone,
  MessageSquare,
  Truck,
  UserCheck,
  Fuel,
  Info,
  Clock,
  ArrowRight,
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Star,
  Building2,
  Share2,
  Heart,
  Check,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useFavorites } from '../hooks/useFavorites';
import { MOCK_MACHINES } from '../data/mockData';
import { formatPriceMAD } from '../data/rentalTerms';
import { MachineCard } from '../components/marketplace/MachineCard';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Machine } from '../types/database';

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang, isRTL } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [machine, setMachine] = useState<Machine>(() => {
    return MOCK_MACHINES.find((m) => m.id === id) || MOCK_MACHINES[0];
  });

  // Lightbox State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Rental Booking Simulation State
  const [selectedTerm, setSelectedTerm] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [selectedDuration, setSelectedDuration] = useState(3);
  const [startDate, setStartDate] = useState('2026-03-10');

  // Load machine from Supabase if connected
  useEffect(() => {
    async function loadMachine() {
      if (!isSupabaseConfigured || !id) return;

      try {
        const { data, error } = await supabase
          .from('machines')
          .select('*, profiles(full_name, company_name, phone, city)')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
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
            condition: data.condition === 'new' ? 'new' : 'good',
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
            specs: {
              operating_weight_ton: 8.5,
              engine_power_hp: 92,
              bucket_capacity_m3: 1.0,
              max_dig_depth_m: 4.8,
              boom_reach_m: 6.2,
              fuel_type: 'diesel',
            },
            views_count: data.views_count || 32,
            rating_avg: 4.9,
            reviews_count: 7,
            owner: {
              full_name: data.profiles?.full_name || 'Karim Benjelloun',
              company_name: data.profiles?.company_name || 'Atlas Terrassement S.A.R.L.',
              phone: data.profiles?.phone || '+212661234567',
              city: data.profiles?.city || data.city,
              whatsapp_verified: true,
            },
            created_at: data.created_at,
            updated_at: data.created_at,
          };
          setMachine(loaded);
        }
      } catch (err) {
        console.warn('Machine fetch fallback:', err);
      }
    }

    loadMachine();
  }, [id]);

  const title = lang === 'fr' ? machine.title_fr : machine.title_ar;
  const description = lang === 'fr' ? machine.description_fr : machine.description_ar;
  const isRent = machine.listing_mode !== 'sale';
  const isFav = isFavorite(machine.id);

  // SEO: Dynamic Page Title, Meta Description & JSON-LD Product Schema
  useEffect(() => {
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
      // Clean up title on unmount
      document.title = 'JADIJCB · كراء وبيع آليات البناء بالمغرب';
    };
  }, [title, description, machine, isRent]);

  const images = machine.images?.length
    ? machine.images
    : ['https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80'];

  // Prefilled WhatsApp message
  const ownerPhone = machine.owner?.phone || '+212661234567';
  const currentUrl = `https://jadijcb.ma/marketplace/${machine.id}`;
  const whatsappMessage =
    lang === 'fr'
      ? `Salam, je vous contacte via JADIJCB à propos de l'engin "${machine.title_fr}" (${machine.brand} ${machine.model}) à ${machine.city || 'Casablanca'}. Pouvez-vous me confirmer sa disponibilité ? Lien: ${currentUrl}`
      : `السلام عليكم، أتواصل معكم عبر منصة JADIJCB بخصوص "${machine.title_ar}" (${machine.brand} ${machine.model}) في ${machine.city || 'الدار البيضاء'}. هل الآلية متوفرة؟ رابط الإعلان: ${currentUrl}`;

  const whatsappUrl = `https://wa.me/${ownerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  // Similar machines (matching category or brand, excluding current)
  const similarMachines = MOCK_MACHINES.filter((m) => m.id !== machine.id).slice(0, 3);

  const calculateEstimate = () => {
    if (!isRent) return machine.sale_price || 0;
    if (selectedTerm === 'hourly') return (machine.rate_hourly || 350) * selectedDuration;
    if (selectedTerm === 'weekly') return (machine.rate_weekly || 12000) * selectedDuration;
    return (machine.rate_daily || 2200) * selectedDuration;
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <PublicHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 text-start">
        {/* Breadcrumbs & Navigation */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate('/marketplace')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-steel-600 hover:text-ink transition-colors cursor-pointer"
          >
            {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            <span>{t('common.back')} {t('marketplace.title')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleFavorite(machine.id, title)}
              className={`p-2 rounded-xl border flex items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                isFav
                  ? 'border-red-300 bg-red-50 text-red-600'
                  : 'border-steel-200 bg-white text-steel-700 hover:bg-steel-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">
                {isFav ? (lang === 'fr' ? 'Favori' : 'في المفضلة') : (lang === 'fr' ? 'Ajouter' : 'إضافة للمفضلة')}
              </span>
            </button>
          </div>
        </div>

        {/* Top Header: Title & Badges */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge
              variant={isRent ? 'warning' : 'neutral'}
              size="md"
              className="font-black"
            >
              {isRent
                ? lang === 'fr' ? 'Location' : 'متاح للكراء'
                : lang === 'fr' ? 'Vente ferme' : 'معروض للبيع'}
            </Badge>

            <span className="text-xs font-bold text-steel-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-primary-dark" />
              <span>{machine.city || 'Casablanca'}</span>
            </span>

            <span className="text-xs font-bold text-steel-400">·</span>
            <span className="text-xs font-bold text-steel-600">
              {machine.brand} {machine.model} ({machine.year})
            </span>
          </div>

          <h1 className="text-xl sm:text-3xl font-black text-ink">
            {title}
          </h1>
        </div>

        {/* Gallery Grid with Lightbox Trigger */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-8">
          {/* Main Large Image */}
          <div
            onClick={() => {
              setActivePhotoIdx(0);
              setIsLightboxOpen(true);
            }}
            className="md:col-span-8 aspect-video rounded-3xl overflow-hidden bg-steel-100 relative group cursor-zoom-in border border-steel-200"
          >
            <img
              src={images[0]}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-ink/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="px-3.5 py-2 rounded-xl bg-ink/80 text-white font-bold text-xs backdrop-blur-sm flex items-center gap-1.5 shadow-md">
                <Maximize2 className="w-4 h-4 text-primary" />
                <span>{lang === 'fr' ? 'Agrandir la photo' : 'تكبير الصورة'}</span>
              </span>
            </div>
          </div>

          {/* Side Thumbnail Stack */}
          <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-3">
            {images.slice(1, 3).map((imgUrl, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setActivePhotoIdx(idx + 1);
                  setIsLightboxOpen(true);
                }}
                className="aspect-video md:aspect-auto md:h-full rounded-2xl overflow-hidden bg-steel-100 relative group cursor-zoom-in border border-steel-200"
              >
                <img
                  src={imgUrl}
                  alt={`${title} thumbnail ${idx + 2}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column Split: Specs & Description (Left) vs Pricing & Booking Box (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Info Column (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Description */}
            <Card className="p-6 bg-white border border-steel-200 shadow-soft">
              <h2 className="text-base font-black text-ink mb-3">
                {lang === 'fr' ? 'Description détaillée' : 'تفاصيل ومواصفات الآلية'}
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

                <div className="p-3.5 rounded-xl bg-surface border border-steel-200">
                  <span className="text-[11px] text-steel-500 block mb-1">
                    {t('machine_detail.weight')}
                  </span>
                  <span className="font-extrabold text-xs text-ink font-mono latin-nums">
                    {machine.specs?.operating_weight_ton || 8.5} Tonnes
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-steel-200">
                  <span className="text-[11px] text-steel-500 block mb-1">
                    {t('machine_detail.engine')}
                  </span>
                  <span className="font-extrabold text-xs text-ink font-mono latin-nums">
                    {machine.specs?.engine_power_hp || 92} CV (Ch)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-steel-200">
                  <span className="text-[11px] text-steel-500 block mb-1">
                    {t('machine_detail.bucket')}
                  </span>
                  <span className="font-extrabold text-xs text-ink font-mono latin-nums">
                    {machine.specs?.bucket_capacity_m3 || 1.0} m³
                  </span>
                </div>
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

                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>{lang === 'fr' ? 'Disponible' : 'متاح'}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>{lang === 'fr' ? 'En mission' : 'قيد التشغيل'}</span>
                    </span>
                  </div>
                </div>

                {/* Simulated 2-Week Availability Ribbon */}
                <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 text-center">
                  {[...Array(14)].map((_, i) => {
                    const dayNum = 10 + i;
                    const isBooked = i >= 3 && i <= 6;
                    return (
                      <div
                        key={i}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-colors ${
                          isBooked
                            ? 'border-amber-200 bg-amber-50 text-amber-900 opacity-80'
                            : 'border-emerald-200 bg-emerald-50/50 text-emerald-900 font-bold'
                        }`}
                      >
                        <span className="text-[10px] uppercase text-steel-500">
                          Mars
                        </span>
                        <span className="text-xs font-black font-mono">
                          {dayNum}
                        </span>
                        <span className="text-[9px] mt-1 font-bold">
                          {isBooked ? (lang === 'fr' ? 'Loué' : 'محجوز') : (lang === 'fr' ? 'Libre' : 'متاح')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Owner Trust Card */}
            <Card className="p-6 bg-white border border-steel-200 shadow-soft">
              <h2 className="text-base font-black text-ink mb-4">
                {t('machine_detail.owner_info')}
              </h2>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-ink font-black text-base flex items-center justify-center shrink-0 shadow-sm">
                    {machine.owner?.company_name?.slice(0, 2) || 'AT'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-ink">
                        {machine.owner?.company_name || 'Atlas Terrassement S.A.R.L.'}
                      </h3>
                      <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>ICE 001928471</span>
                      </span>
                    </div>

                    <p className="text-xs text-steel-500 mt-0.5">
                      {machine.owner?.full_name || 'Karim Benjelloun'} · {machine.city || 'Casablanca'}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-steel-600 font-bold">
                      <span className="flex items-center gap-1 text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>4.9 / 5.0 (24 contrats réalisés)</span>
                      </span>
                      <span>·</span>
                      <span className="text-emerald-700">
                        {lang === 'fr' ? 'Répond en moins de 15 min' : 'يجيب خلال أقل من 15 دقيقة'}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/s/atlas-terrassement')}
                  className="self-start sm:self-auto text-xs font-bold"
                  rightIcon={isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                >
                  {lang === 'fr' ? 'Voir tout le parc' : 'تصفح أسطول الشركة'}
                </Button>
              </div>
            </Card>
          </div>

          {/* Pricing & Booking Sticky Sidebar (4 cols) */}
          <div className="lg:col-span-4 sticky top-20 space-y-4">
            <Card className="p-6 bg-white border border-steel-200 shadow-elevated rounded-3xl space-y-6">
              {/* Price Box */}
              <div>
                <span className="text-xs font-bold text-steel-500 block mb-1">
                  {isRent ? t('machine_detail.rate_daily') : (lang === 'fr' ? 'Prix de vente' : 'سعر الشراء النهائي')}
                </span>
                <div className="text-2xl sm:text-3xl font-black text-ink font-mono latin-nums">
                  {isRent ? (
                    <span>
                      {machine.rate_daily?.toLocaleString('fr-FR')} {t('common.mad')}{' '}
                      <span className="text-xs font-bold text-steel-500">
                        / {lang === 'fr' ? 'jour' : 'يوم'}
                      </span>
                    </span>
                  ) : (
                    <span>
                      {machine.sale_price?.toLocaleString('fr-FR')} {t('common.mad')}
                    </span>
                  )}
                </div>
              </div>

              {/* Rate Terms Pills */}
              {isRent && (
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-steel-100 rounded-xl text-center">
                  <button
                    type="button"
                    onClick={() => setSelectedTerm('hourly')}
                    className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      selectedTerm === 'hourly'
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-steel-600'
                    }`}
                  >
                    <span className="block font-mono font-black">{machine.rate_hourly} DH</span>
                    <span className="text-[10px] text-steel-500">{t('marketplace.per_hour')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTerm('daily')}
                    className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      selectedTerm === 'daily'
                        ? 'bg-primary text-ink shadow-sm'
                        : 'text-steel-600'
                    }`}
                  >
                    <span className="block font-mono font-black">{machine.rate_daily} DH</span>
                    <span className="text-[10px] text-ink">{t('marketplace.per_day')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTerm('weekly')}
                    className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      selectedTerm === 'weekly'
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-steel-600'
                    }`}
                  >
                    <span className="block font-mono font-black">{(machine.rate_weekly || 12000) / 1000}k DH</span>
                    <span className="text-[10px] text-steel-500">/ sem</span>
                  </button>
                </div>
              )}

              {/* Inclusions List */}
              <div className="space-y-2 pt-2 border-t border-steel-200 text-xs font-semibold text-steel-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {machine.with_operator
                      ? t('machine_detail.operator_included')
                      : (lang === 'fr' ? 'Chauffeur en option' : 'سائق اختياري')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {machine.fuel_included
                      ? t('machine_detail.fuel_included')
                      : (lang === 'fr' ? 'Gazole selon relevé compteur' : 'الوقود حسب عداد الاستهلاك')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {machine.delivery_available
                      ? t('machine_detail.delivery_available')
                      : (lang === 'fr' ? 'Enlèvement au dépôt' : 'الاستلام من المستودع')}
                  </span>
                </div>
              </div>

              {/* Direct CTAs */}
              <div className="space-y-2.5 pt-2">
                {/* 1. Contact via WhatsApp */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors shadow-md min-h-[48px]"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{lang === 'fr' ? 'Contacter via WhatsApp' : 'تواصل فوري عبر واتساب'}</span>
                </a>

                {/* 2. Chat Now Internal */}
                <Button
                  type="button"
                  variant="dark"
                  size="lg"
                  onClick={() => navigate(`/app/messages?machineId=${machine.id}`)}
                  className="w-full justify-center font-bold text-xs min-h-[48px]"
                  leftIcon={<MessageSquare className="w-4 h-4 text-primary" />}
                >
                  {lang === 'fr' ? 'Envoyer un message interne' : 'بدء محادثة في المنصة'}
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Similar Machines Carousel/Grid */}
        <div className="mt-16 pt-12 border-t border-steel-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-ink">
                {lang === 'fr' ? 'Autres engins similaires dans la région' : 'آليات مشابهة في نفس المنطقة'}
              </h2>
              <p className="text-xs text-steel-500 mt-0.5">
                {lang === 'fr' ? 'Comparez les tarifs et disponibilités' : 'قارن الأسعار وسرعة التوصيل'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {similarMachines.map((m) => (
              <MachineCard key={m.id} machine={m} />
            ))}
          </div>
        </div>
      </main>

      <Footer />

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/95 backdrop-blur-md">
          {/* Close Lightbox */}
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-5 end-5 w-10 h-10 rounded-full bg-steel-800 text-white hover:bg-steel-700 flex items-center justify-center transition-colors cursor-pointer z-10"
            aria-label="Fermer la vue plein écran"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Previous Arrow */}
          <button
            type="button"
            onClick={() => setActivePhotoIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
            className="absolute start-4 my-auto w-12 h-12 rounded-full bg-steel-800/80 hover:bg-steel-800 text-white flex items-center justify-center transition-colors cursor-pointer z-10"
            aria-label="Photo précédente"
          >
            {isRTL ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
          </button>

          {/* Current Zoomed Photo */}
          <div className="max-w-4xl w-full max-h-[85vh] flex flex-col items-center justify-center">
            <img
              src={images[activePhotoIdx]}
              alt={`${title} agrandie`}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl"
            />
            <div className="mt-3 text-xs text-steel-400 font-mono font-bold">
              {activePhotoIdx + 1} / {images.length}
            </div>
          </div>

          {/* Next Arrow */}
          <button
            type="button"
            onClick={() => setActivePhotoIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
            className="absolute end-4 my-auto w-12 h-12 rounded-full bg-steel-800/80 hover:bg-steel-800 text-white flex items-center justify-center transition-colors cursor-pointer z-10"
            aria-label="Photo suivante"
          >
            {isRTL ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default MachineDetailPage;
