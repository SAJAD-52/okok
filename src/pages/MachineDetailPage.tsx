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
  Edit2,
  Building2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  RotateCcw,
  CalendarCheck,
  Store,
  TrendingDown,
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
import { useAuth } from '../hooks/useAuth';
import { formatPriceMAD, resolveEffectiveTermRate, formatTermQuantityUnit } from '../data/rentalTerms';
import { MachineCard } from '../components/marketplace/MachineCard';
import { CreateBookingModal } from '../components/bookings/CreateBookingModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { machineStore, resolveMachineRates, resolveVolumeDiscounts, normalizeMachineRates } from '../lib/machineStore';
import { loadStorefrontByOwner } from '../lib/storefrontService';
import { serverApi } from '../lib/serverApi';
import { bookingStore } from '../lib/bookingStore';
import { Machine, Booking, RentalTermType } from '../types/database';

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang, isRTL } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user, profile, isSuperAdmin } = useAuth();

  const [machine, setMachine] = useState<Machine | null>(null);
  const [similarMachines, setSimilarMachines] = useState<Machine[]>([]);
  const [ownerMachines, setOwnerMachines] = useState<Machine[]>([]);
  const [ownerStorefrontSlug, setOwnerStorefrontSlug] = useState<string>('');
  const [activeBooking, setActiveBooking] = useState<{
    status: string;
    start_at?: string;
    end_at?: string;
    start_date?: string;
    end_date?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [modalMachine, setModalMachine] = useState<Machine | null>(null);

  // Lightbox State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Rental Booking Simulation State
  const [selectedTerm, setSelectedTerm] = useState<RentalTermType>('daily');
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [startDate, setStartDate] = useState('2026-03-10');

  useEffect(() => {
    setSelectedTerm('daily');
    setSelectedDuration(1);
  }, [id]);

  // Load machine from Supabase with machineStore cache fallback
  const loadMachineData = async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    try {
      let data: any = null;
      if (isSupabaseConfigured) {
        let { data: mData, error: mError } = await supabase
          .from('machines')
          .select('*, profiles:owner_id(full_name, company_name, phone, city)')
          .eq('id', id)
          .maybeSingle();

        if (mError || !mData?.profiles) {
          const { data: baseData } = await supabase
            .from('machines')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (baseData) {
            mData = baseData;
            if (baseData.owner_id) {
              const { data: prof } = await supabase
                .from('profiles')
                .select('full_name, company_name, phone, city')
                .eq('id', baseData.owner_id)
                .maybeSingle();
              if (prof) {
                mData.profiles = prof;
              }
            }
          }
        }
        data = mData;
      }

      if (!data) {
        // Fallback to locally saved/cached machines
        const localCached = machineStore.getCachedMachines().find((m) => m.id === id);
        if (localCached) {
          setMachine(normalizeMachineRates(localCached));
          const others = machineStore
            .getCachedMachines()
            .filter((m) => m.id !== id && m.category === localCached.category)
            .slice(0, 3)
            .map((m) => normalizeMachineRates(m));
          setSimilarMachines(others);
          setIsLoading(false);
          return;
        }

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
        ...(() => {
          const rates = resolveMachineRates(data);
          const volumeDiscounts = resolveVolumeDiscounts(data);
          return {
            rate_hourly: rates.rateHourly,
            rate_daily: rates.rateDaily,
            rate_weekly: rates.rateWeekly,
            rate_monthly: rates.rateMonthly,
            rate_yearly: rates.rateYearly,
            hourly_rate: rates.rateHourly,
            daily_rate: rates.rateDaily,
            weekly_rate: rates.rateWeekly,
            monthly_rate: rates.rateMonthly,
            yearly_rate: rates.rateYearly,
            sale_price: rates.salePrice,
            volume_discounts: volumeDiscounts,
          };
        })(),
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
          full_name: data.profiles?.full_name || (lang === 'fr' ? 'Propriétaire certifié' : 'مالك معتمد'),
          company_name: data.profiles?.company_name || data.profiles?.full_name || '',
          phone: data.profiles?.phone || '',
          city: data.profiles?.city || data.city,
          whatsapp_verified: Boolean(data.profiles?.phone),
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
              ...(() => {
                const rates = resolveMachineRates(m);
                const volumeDiscounts = resolveVolumeDiscounts(m);
                return {
                  rate_hourly: rates.rateHourly,
                  rate_daily: rates.rateDaily,
                  rate_weekly: rates.rateWeekly,
                  rate_monthly: rates.rateMonthly,
                  rate_yearly: rates.rateYearly,
                  hourly_rate: rates.rateHourly,
                  daily_rate: rates.rateDaily,
                  weekly_rate: rates.rateWeekly,
                  monthly_rate: rates.rateMonthly,
                  yearly_rate: rates.rateYearly,
                  sale_price: rates.salePrice,
                  volume_discounts: volumeDiscounts,
                };
              })(),
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

      // 3. Fetch Owner Storefront & Slug
      let sfSlug = '';
      if (data.owner_id) {
        try {
          const sf = await loadStorefrontByOwner(data.owner_id);
          if (sf?.slug) sfSlug = sf.slug;
        } catch {
          // ignore
        }
        if (!sfSlug) {
          const localSlug = localStorage.getItem('jadijcb_owner_storefront_slug');
          sfSlug = localSlug || data.owner_id || 'store';
        }
      }
      setOwnerStorefrontSlug(sfSlug);

      // 4. Fetch Other Machines from this Owner's Storefront
      if (data.owner_id) {
        let oList: Machine[] = [];
        if (isSupabaseConfigured) {
          try {
            const { data: oData } = await supabase
              .from('machines')
              .select('*')
              .eq('owner_id', data.owner_id)
              .neq('id', data.id)
              .limit(6);
            if (oData && oData.length > 0) {
              oList = oData.map((m: any) => ({
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
                ...(() => {
                  const rates = resolveMachineRates(m);
                  const volumeDiscounts = resolveVolumeDiscounts(m);
                  return {
                    rate_hourly: rates.rateHourly,
                    rate_daily: rates.rateDaily,
                    rate_weekly: rates.rateWeekly,
                    rate_monthly: rates.rateMonthly,
                    rate_yearly: rates.rateYearly,
                    hourly_rate: rates.rateHourly,
                    daily_rate: rates.rateDaily,
                    weekly_rate: rates.rateWeekly,
                    monthly_rate: rates.rateMonthly,
                    yearly_rate: rates.rateYearly,
                    sale_price: rates.salePrice,
                    volume_discounts: volumeDiscounts,
                  };
                })(),
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
              }));
            }
          } catch (oErr) {
            console.warn('Owner machines fetch error:', oErr);
          }
        }
        if (oList.length === 0) {
          oList = machineStore
            .getCachedMachines()
            .filter((m) => m.id !== id && (m.owner_id === data.owner_id || !m.owner_id))
            .slice(0, 3);
        }
        setOwnerMachines(oList);
      }

      // 5. Check Active Booking & Real-World Machine Availability
      let currentBooking: any = null;
      const todayIso = new Date().toISOString().split('T')[0];

      // 5a. Check Supabase active bookings
      if (isSupabaseConfigured) {
        try {
          const { data: bData } = await supabase
            .from('bookings')
            .select('*')
            .eq('machine_id', id)
            .in('status', ['active', 'pending'])
            .order('end_at', { ascending: false });

          if (bData && bData.length > 0) {
            const found = bData.find((b: any) => {
              const end = b.end_at || b.end_date;
              return end && end.split('T')[0] >= todayIso;
            });
            if (found) currentBooking = found;
          }
        } catch (bErr) {
          console.warn('Booking availability check notice:', bErr);
        }
      }

      // 5b. Check SQLite serverApi bookings
      if (!currentBooking) {
        try {
          const sBookings = await serverApi.getBookings({ machine_id: id });
          const found = sBookings.find((b) => {
            const end = b.end_at || b.end_date;
            const isLive = b.status === 'active' || b.status === 'pending';
            return isLive && end && end.split('T')[0] >= todayIso;
          });
          if (found) currentBooking = found;
        } catch {
          // ignore
        }
      }

      // 5c. Check local cached bookings
      if (!currentBooking) {
        const cachedList = bookingStore.getCachedBookings().filter((b) => b.machine_id === id);
        const found = cachedList.find((b) => {
          const end = b.end_at || b.end_date;
          return (b.status === 'active' || b.status === 'pending') && end && end.split('T')[0] >= todayIso;
        });
        if (found) currentBooking = found;
      }

      // 5d. Also check if machine is flagged as rented or query flag ?booked=true
      const urlParams = new URLSearchParams(window.location.search);
      const forceBooked = urlParams.get('booked') === 'true' || urlParams.get('rented') === 'true';
      if (!currentBooking && (data.status === 'rented' || (data as any).is_rented || forceBooked)) {
        const futureDate = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0];
        currentBooking = {
          status: 'active',
          start_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
          end_at: futureDate,
        };
      }

      setActiveBooking(currentBooking);
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

  // Check if current user owns this machine (cannot book own machines)
  const currentUserId = user?.id || profile?.id;
  const isOwnMachine = Boolean(
    !isSuperAdmin &&
    currentUserId &&
    machine?.owner_id &&
    (machine.owner_id === currentUserId || (profile && machine.owner_id === profile.id))
  );

  // Auto-open booking modal if arriving with ?book=true (and not own machine)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('book') === 'true' && machine && !isOwnMachine) {
      setModalMachine(machine);
      setIsBookingModalOpen(true);
    }
  }, [machine, isOwnMachine]);

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

    const resolvedRates = resolveMachineRates(machine);
    const priceValue = isRent ? resolvedRates.rateDaily : resolvedRates.salePrice;

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

  const machineRates = resolveMachineRates(machine);
  const machineVolumeTiers = resolveVolumeDiscounts(machine);
  const activeBaseUnitRate = !isRent
    ? machineRates.salePrice
    : selectedTerm === 'hourly'
    ? machineRates.rateHourly
    : selectedTerm === 'weekly'
    ? machineRates.rateWeekly
    : selectedTerm === 'monthly'
    ? machineRates.rateMonthly
    : selectedTerm === 'yearly'
    ? machineRates.rateYearly
    : machineRates.rateDaily;

  const rateEval = isRent
    ? resolveEffectiveTermRate(activeBaseUnitRate, selectedTerm, selectedDuration, machineVolumeTiers)
    : {
        baseUnitRate: machineRates.salePrice,
        effectiveUnitRate: machineRates.salePrice,
        appliedTier: null,
        savingsPerUnit: 0,
        totalSavings: 0,
        discountPercent: 0,
        nextTier: null,
        sortedTiersForTerm: [],
      };

  const calculateEstimate = () => {
    if (!isRent) return machineRates.salePrice;
    return rateEval.effectiveUnitRate * selectedDuration;
  };

  // Prefilled WhatsApp message
  const ownerPhone = machine.owner?.phone ? machine.owner.phone.replace(/\D/g, '') : '';
  const selectedUnitLabel = formatTermQuantityUnit(selectedTerm, selectedDuration, lang);
  const durationWaDetail = isRent
    ? (lang === 'fr'
        ? ` pour ${selectedDuration} ${selectedUnitLabel}${
            rateEval.appliedTier
              ? ` (tarif dégressif ${formatPriceMAD(rateEval.effectiveUnitRate, 'fr')})`
              : ''
          }`
        : ` لمدة ${selectedDuration} ${selectedUnitLabel}${
            rateEval.appliedTier
              ? ` (بسعر مخفّض ${formatPriceMAD(rateEval.effectiveUnitRate, 'ar')})`
              : ''
          }`)
    : '';
  const whatsappMessage =
    lang === 'fr'
      ? `Bonjour, je vous contacte depuis JADIJCB au sujet de votre engin "${machine.title_fr}" (${machine.brand} ${machine.model}) à ${machine.city}${durationWaDetail}. Est-il disponible ?`
      : `السلام عليكم، أتواصل معكم عبر منصة JADIJCB بخصوص آلية "${machine.title_ar}" (${machine.brand} ${machine.model}) بمدينة ${machine.city}${durationWaDetail}. هل هي متاحة للكراء؟`;

  const whatsappUrl = ownerPhone
    ? `https://wa.me/${ownerPhone}?text=${encodeURIComponent(whatsappMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  const isBooked = Boolean(
    isRent && (
      activeBooking ||
      (machine && (machine.status === 'rented' || (machine as any).is_rented))
    )
  );

  const availableDateRaw = activeBooking?.end_at || activeBooking?.end_date || (
    isBooked ? new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0] : null
  );

  const availableDateObj = availableDateRaw ? new Date(availableDateRaw) : null;

  const formattedAvailableDate = availableDateObj
    ? availableDateObj.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const shortAvailableDate = availableDateObj
    ? availableDateObj.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA', {
        day: 'numeric',
        month: 'short',
      })
    : '';

  const daysRemaining = availableDateObj
    ? Math.max(0, Math.ceil((new Date(availableDateObj).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)))
    : 0;

  const initialPreselectedStartDate = availableDateObj
    ? new Date(availableDateObj.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 16)
    : undefined;

  const ownerSlug = ownerStorefrontSlug || machine.owner_id || 'store';

  const handleStartChat = async () => {
    if (!user) {
      toast.info(lang === 'fr' ? 'Veuillez vous connecter pour discuter avec le propriétaire' : 'يرجى تسجيل الدخول أولاً للتواصل المباشر مع المالك');
      navigate('/auth?redirect=/marketplace/' + machine?.id);
      return;
    }
    const isClient = profile?.role === 'client' || profile?.role === 'contractor';
    const basePath = isClient ? '/entreprise/messages' : '/owner/messages';
    navigate(`${basePath}?machine_id=${machine?.id}&target_user=${machine?.owner_id}`);
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
                <div className="absolute top-4 start-4 flex items-center gap-2 flex-wrap max-w-[85%]">
                  <Badge variant={isRent ? 'warning' : 'neutral'} size="md">
                    {isRent ? t('machines.mode_rent_option') : t('machines.mode_sale_option')}
                  </Badge>
                  <span className="bg-ink/80 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20">
                    {machine.brand} {machine.model}
                  </span>
                  {isBooked && (
                    <span className="bg-amber-500 text-ink text-xs font-black px-3 py-1 rounded-full border border-amber-600 shadow-md flex items-center gap-1.5 animate-pulse">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{lang === 'fr' ? `Louée jusqu'au ${shortAvailableDate}` : `محجوزة حتى ${shortAvailableDate}`}</span>
                    </span>
                  )}
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

            {/* Elegant Graphic: Booked Status & Availability Date */}
            {isBooked && (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100/70 border-2 border-amber-400 p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 text-start">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-ink font-black text-xs shadow-xs">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Engin actuellement en location' : 'الآلية محجوزة بالورش حالياً'}</span>
                      </span>
                      {daysRemaining > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-white text-amber-900 border border-amber-300 text-[11px] font-extrabold shadow-2xs">
                          {lang === 'fr' ? `Libération dans ${daysRemaining} jours` : `متبقي ${daysRemaining} أيام على الإتاحة`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-steel-600">
                      {lang === 'fr'
                        ? 'Cette machine est actuellement mobilisée sur un chantier BTP partenaire.'
                        : 'هذه الآلية تعمل حالياً ضمن مشروع لعميل شريك، وتم تحديد موعد انتهاء الكراء بدقة.'}
                    </p>
                  </div>

                  {/* Date Target Highlight Card */}
                  <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-amber-300 shadow-xs flex items-center gap-3 shrink-0">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 shadow-inner">
                      <CalendarCheck className="w-6 h-6 text-amber-700" />
                    </div>
                    <div className="text-start">
                      <span className="text-[10px] text-steel-500 font-bold block uppercase tracking-wider">
                        {lang === 'fr' ? 'Disponible pour votre chantier dès :' : 'متاحة لورشك ابتداءً من:'}
                      </span>
                      <span className="text-sm sm:text-base font-black text-ink block font-mono">
                        {formattedAvailableDate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Graphic Visual Progress & Timeline */}
                <div className="pt-3.5 border-t border-amber-200/80">
                  <div className="flex items-center justify-between text-[11px] font-bold text-steel-600 mb-2">
                    <span className="flex items-center gap-1.5 text-amber-900 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>{lang === 'fr' ? 'Période occupée en cours' : 'فترة الكراء الحالية بالورش'}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>{lang === 'fr' ? 'Créneau libre pour réservation' : 'جاهزة للحجز المسبق'}</span>
                    </span>
                  </div>

                  {/* Graphic Progress Bar */}
                  <div className="h-4 w-full rounded-full bg-steel-200/80 p-0.5 overflow-hidden flex shadow-inner">
                    <div
                      className="h-full rounded-s-full bg-amber-400 bg-[linear-gradient(45deg,rgba(0,0,0,0.08)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.08)_50%,rgba(0,0,0,0.08)_75%,transparent_75%,transparent)] bg-[length:14px_14px]"
                      style={{ width: '65%' }}
                    />
                    <div
                      className="h-full rounded-e-full bg-emerald-500 flex-1 flex items-center justify-center text-[9px] font-black text-white"
                    >
                      {lang === 'fr' ? 'DISPONIBLE' : 'متاح'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-steel-500 font-mono mt-2">
                    <span>{lang === 'fr' ? 'Activité chantier en cours' : 'العمل جاري بالموقع'}</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'fr' ? `Libre dès le ${shortAvailableDate}` : `متاحة ابتداءً من ${shortAvailableDate}`}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

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
                        : 'فترات العمل المتاحة للحجز الفوري والمسبق'}
                    </p>
                  </div>

                  {isBooked ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>{lang === 'fr' ? `Libre le ${shortAvailableDate}` : `متاحة في ${shortAvailableDate}`}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{lang === 'fr' ? 'Disponible maintenant' : 'متاحة فوراً'}</span>
                    </span>
                  )}
                </div>

                {isBooked ? (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4.5 h-4.5 text-amber-700 shrink-0" />
                        <span className="font-extrabold text-xs">
                          {lang === 'fr'
                            ? `Actuellement mobilisée sur chantier. Libération programmée le ${formattedAvailableDate}.`
                            : `الآلية قيد العمل حالياً بالورش. موعد الإتاحة المؤكد هو ${formattedAvailableDate}.`}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] bg-amber-200 text-amber-900 font-black px-2.5 py-0.5 rounded-lg shrink-0">
                        {lang === 'fr' ? `J-${daysRemaining}` : `بعد ${daysRemaining} يوم`}
                      </span>
                    </div>

                    <p className="text-[11px] text-steel-600 leading-relaxed">
                      {lang === 'fr'
                        ? 'Vous pouvez soumettre une demande de pré-réservation pour garantir la mise à disposition de cette machine à cette date précise.'
                        : 'لتثبيت أولوية حجز الآلية لورشك فور الانتهاء من العمل الحالي، يمكنك تقديم طلب حجز مسبق الآن.'}
                    </p>
                  </div>
                ) : (
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
                )}
              </Card>
            )}
          </div>

          {/* Right Column: Sticky Pricing & Action Card (4 cols on desktop) */}
          <div className="lg:col-span-4 sticky top-24 space-y-5">
            {/* Price Box */}
            <Card className="p-6 bg-white border border-steel-200 shadow-elevated rounded-3xl space-y-5">
              {/* Header Price */}
              {(() => {
                const rates = machineRates;

                const headerRateLabel = !isRent
                  ? t('machines.sale_price_label')
                  : selectedTerm === 'hourly'
                  ? t('machine_detail.rate_hourly')
                  : selectedTerm === 'weekly'
                  ? t('machine_detail.rate_weekly')
                  : selectedTerm === 'monthly'
                  ? t('machine_detail.rate_monthly')
                  : selectedTerm === 'yearly'
                  ? t('machine_detail.rate_yearly')
                  : t('machine_detail.rate_daily');

                const headerUnitSuffix =
                  selectedTerm === 'hourly'
                    ? t('marketplace.per_hour')
                    : selectedTerm === 'weekly'
                    ? (lang === 'fr' ? 'semaine' : 'أسبوعياً')
                    : selectedTerm === 'monthly'
                    ? (lang === 'fr' ? 'mois' : 'شهرياً')
                    : selectedTerm === 'yearly'
                    ? (lang === 'fr' ? 'an' : 'سنوياً')
                    : t('marketplace.per_day');

                const shortUnitWord =
                  selectedTerm === 'hourly'
                    ? (lang === 'fr' ? 'h' : 'ساعة')
                    : selectedTerm === 'weekly'
                    ? (lang === 'fr' ? 'sem' : 'أسبوع')
                    : selectedTerm === 'monthly'
                    ? (lang === 'fr' ? 'mois' : 'شهر')
                    : selectedTerm === 'yearly'
                    ? (lang === 'fr' ? 'an' : 'سنة')
                    : (lang === 'fr' ? 'jour' : 'يوم');

                const durationUnitLabel = formatTermQuantityUnit(selectedTerm, selectedDuration, lang);

                const termButtons: { key: RentalTermType; shortLabel: string; price: number }[] = [
                  { key: 'hourly', shortLabel: t('marketplace.per_hour'), price: rates.rateHourly },
                  { key: 'daily', shortLabel: t('marketplace.per_day'), price: rates.rateDaily },
                  { key: 'weekly', shortLabel: lang === 'fr' ? 'Hebdo' : 'أسبوعي', price: rates.rateWeekly },
                  { key: 'monthly', shortLabel: lang === 'fr' ? 'Mensuel' : 'شهري', price: rates.rateMonthly },
                  { key: 'yearly', shortLabel: lang === 'fr' ? 'Annuel' : 'سنوي', price: rates.rateYearly },
                ];

                const totalEstimate = calculateEstimate();
                const originalEstimate = rateEval.baseUnitRate * selectedDuration;

                return (
                  <>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-steel-500 block">
                          {headerRateLabel}
                        </span>
                        {isRent && rateEval.appliedTier && rateEval.discountPercent > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black latin-nums">
                            <TrendingDown className="w-3 h-3" />
                            <span>
                              {lang === 'fr'
                                ? `Tarif réduit -${rateEval.discountPercent}%`
                                : `تخفيض المدة -${rateEval.discountPercent}%`}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                        <span className="text-2xl sm:text-3xl font-black text-ink font-mono latin-nums">
                          {formatPriceMAD(rateEval.effectiveUnitRate, lang)}
                        </span>
                        {isRent && (
                          <span className="text-xs font-bold text-steel-500">
                            /{headerUnitSuffix}
                          </span>
                        )}
                        {isRent && rateEval.appliedTier && rateEval.savingsPerUnit > 0 && (
                          <span className="text-xs font-mono font-bold text-steel-400 line-through latin-nums">
                            {formatPriceMAD(rateEval.baseUnitRate, lang)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rental Simulation Controls */}
                    {isRent && (
                      <div className="space-y-3 pt-3 border-t border-steel-200">
                        <div className="space-y-1.5">
                          <span className="text-xs font-bold text-steel-700 block">
                            {t('bookings.dates')}
                          </span>
                          <div className="grid grid-cols-5 gap-1 bg-steel-100 p-1 rounded-xl">
                            {termButtons.map((tb) => (
                              <button
                                key={tb.key}
                                type="button"
                                onClick={() => {
                                  setSelectedTerm(tb.key);
                                  setSelectedDuration(1);
                                }}
                                className={`py-1.5 px-1 text-[10px] font-bold rounded-lg cursor-pointer transition-all text-center truncate ${
                                  selectedTerm === tb.key
                                    ? 'bg-primary text-ink shadow-xs'
                                    : 'text-steel-600 hover:text-ink'
                                }`}
                              >
                                {tb.shortLabel}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Interactive Duration Stepper */}
                        <div className="flex items-center justify-between text-xs font-bold text-steel-700">
                          <span>{lang === 'fr' ? 'Durée estimée' : 'المدة المطلوبة'}</span>
                          <div className="flex items-center gap-2 bg-surface border border-steel-200 rounded-lg px-1.5 py-1">
                            <button
                              type="button"
                              onClick={() => setSelectedDuration((d) => Math.max(1, d - 1))}
                              className="w-6 h-6 rounded bg-white border border-steel-200 hover:bg-steel-100 text-ink font-black flex items-center justify-center cursor-pointer"
                              aria-label="Decrease duration"
                            >
                              -
                            </button>
                            <span className="font-mono text-xs font-black text-ink min-w-[60px] text-center latin-nums">
                              {selectedDuration} {durationUnitLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedDuration((d) => Math.min(90, d + 1))}
                              className="w-6 h-6 rounded bg-white border border-steel-200 hover:bg-steel-100 text-ink font-black flex items-center justify-center cursor-pointer"
                              aria-label="Increase duration"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Clickable Tiered Volume Discounts for the Selected Period Only */}
                        {rateEval.sortedTiersForTerm.length > 0 && (
                          <div className="pt-2 border-t border-steel-200 space-y-2">
                            <span className="text-[11px] font-black text-ink flex items-center gap-1.5">
                              <TrendingDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>
                                {lang === 'fr'
                                  ? `Tarifs dégressifs (${termButtons.find((tb) => tb.key === selectedTerm)?.shortLabel || ''}) :`
                                  : `تخفيضات المدة (${termButtons.find((tb) => tb.key === selectedTerm)?.shortLabel || ''}):`}
                              </span>
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {rateEval.sortedTiersForTerm.map((tier) => {
                                const isActiveTier = rateEval.appliedTier?.id === tier.id;
                                const tierDiscountPct =
                                  rateEval.baseUnitRate > 0
                                    ? Math.round(
                                        ((rateEval.baseUnitRate - tier.discounted_unit_price) /
                                          rateEval.baseUnitRate) *
                                          100
                                      )
                                    : 0;
                                return (
                                  <button
                                    key={tier.id}
                                    type="button"
                                    onClick={() => setSelectedDuration(tier.min_quantity)}
                                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer latin-nums flex items-center gap-1.5 ${
                                      isActiveTier
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-400 shadow-2xs'
                                        : 'border-steel-200 bg-surface hover:border-primary hover:bg-amber-50/40 text-ink'
                                    }`}
                                  >
                                    <span>
                                      {lang === 'fr'
                                        ? `Dès ${tier.min_quantity} ${formatTermQuantityUnit(selectedTerm, tier.min_quantity, 'fr')}:`
                                        : `${tier.min_quantity}+ ${formatTermQuantityUnit(selectedTerm, tier.min_quantity, 'ar')}:`}
                                    </span>
                                    <strong className="font-mono text-primary-dark">
                                      {formatPriceMAD(tier.discounted_unit_price, lang)}/{shortUnitWord}
                                    </strong>
                                    {tierDiscountPct > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black">
                                        -{tierDiscountPct}%
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Smart Upsell Nudge for Next Tier */}
                        {rateEval.nextTier && (
                          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2 text-[11px]">
                            <div className="text-emerald-950 font-bold leading-snug">
                              {lang === 'fr' ? (
                                <>
                                  Réservez <strong>{rateEval.nextTier.min_quantity}+ {formatTermQuantityUnit(selectedTerm, rateEval.nextTier.min_quantity, 'fr')}</strong> pour passer à{' '}
                                  <strong className="font-mono">{formatPriceMAD(rateEval.nextTier.discounted_unit_price, 'fr')}/{shortUnitWord}</strong> !
                                </>
                              ) : (
                                <>
                                  احجز <strong>{rateEval.nextTier.min_quantity}+ {formatTermQuantityUnit(selectedTerm, rateEval.nextTier.min_quantity, 'ar')}</strong> لتحصل على سعر{' '}
                                  <strong className="font-mono">{formatPriceMAD(rateEval.nextTier.discounted_unit_price, 'ar')}/{shortUnitWord}</strong> بدلاً من{' '}
                                  <span className="line-through opacity-75">{formatPriceMAD(rateEval.baseUnitRate, 'ar')}</span>
                                </>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedDuration(rateEval.nextTier!.min_quantity)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-black shrink-0 cursor-pointer latin-nums"
                            >
                              {lang === 'fr' ? `Appliquer (${rateEval.nextTier.min_quantity}+)` : `تطبيق (${rateEval.nextTier.min_quantity}+)`}
                            </button>
                          </div>
                        )}

                        {/* Estimation summary */}
                        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1 text-xs font-bold text-amber-900">
                          <div className="flex items-center justify-between">
                            <span>
                              {lang === 'fr'
                                ? `Estimation (${selectedDuration} ${durationUnitLabel}) :`
                                : `التقدير المبدئي (${selectedDuration} ${durationUnitLabel}):`}
                            </span>
                            <div className="flex items-baseline gap-2">
                              {rateEval.totalSavings > 0 && (
                                <span className="font-mono text-xs text-steel-400 line-through latin-nums">
                                  {formatPriceMAD(originalEstimate, lang)}
                                </span>
                              )}
                              <span className="font-mono text-sm font-black latin-nums">
                                {formatPriceMAD(totalEstimate, lang)}
                              </span>
                            </div>
                          </div>
                          {rateEval.totalSavings > 0 && (
                            <div className="flex items-center justify-between text-[11px] text-emerald-700 pt-1 border-t border-amber-200/70">
                              <span>
                                {lang === 'fr'
                                  ? `Tarif appliqué : ${formatPriceMAD(rateEval.effectiveUnitRate, 'fr')}/${shortUnitWord}`
                                  : `السعر المخفّض للوحدة: ${formatPriceMAD(rateEval.effectiveUnitRate, 'ar')}/${shortUnitWord}`}
                              </span>
                              <span className="font-black latin-nums">
                                {lang === 'fr'
                                  ? `Économie : ${formatPriceMAD(rateEval.totalSavings, 'fr')}`
                                  : `وفّرت ${formatPriceMAD(rateEval.totalSavings, 'ar')}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

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

              {/* CTAs: Booking, WhatsApp + Real-time Chat */}
              <div className="space-y-2.5 pt-3">
                {/* Booked notice chip in sticky column */}
                {isBooked && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-xs text-amber-950 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-amber-900 text-xs">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{lang === 'fr' ? 'Actuellement sur chantier' : 'الآلية محجوزة بالورش حالياً'}</span>
                      </div>
                      <span className="font-mono text-[10px] bg-amber-200 text-amber-900 font-black px-2 py-0.5 rounded-md">
                        {lang === 'fr' ? `J-${daysRemaining}` : `خلال ${daysRemaining} يوم`}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-snug">
                      {lang === 'fr'
                        ? `Disponible à partir du ${formattedAvailableDate}. Vous pouvez soumettre une pré-réservation pour bloquer cette date.`
                        : `تصبح شاغرة ابتداءً من ${formattedAvailableDate}. يمكنك تقديم طلب حجز مسبق لتأكيد أولوية ورشك.`}
                    </p>
                  </div>
                )}

                {isOwnMachine ? (
                  <div className="space-y-2">
                    <div className="w-full py-3 px-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-2xs">
                      <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        {lang === 'fr'
                          ? 'Aperçu en direct (Vous êtes le propriétaire de cette machine)'
                          : 'معاينة حية للمنتج (أنت المالك المسجل لهذه الآلية)'}
                      </span>
                    </div>
                    <Link
                      to={`/owner/machines?edit=${machine.id}`}
                      className="w-full flex items-center justify-center gap-2 bg-steel-900 hover:bg-steel-800 text-primary font-black py-3 px-4 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[46px]"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>{lang === 'fr' ? 'Modifier cette machine dans mon parc' : 'تعديل بيانات هذه الآلية في أسطولي'}</span>
                    </Link>
                  </div>
                ) : isRent ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => {
                      setModalMachine(machine);
                      setIsBookingModalOpen(true);
                    }}
                    leftIcon={<CalendarCheck className="w-4 h-4" />}
                    className="w-full justify-center font-black text-xs sm:text-sm min-h-[48px] shadow-md"
                  >
                    {isBooked
                      ? (lang === 'fr'
                          ? `Pré-réserver (Libre dès le ${shortAvailableDate})`
                          : `طلب حجز مسبق (متاحة في ${shortAvailableDate})`)
                      : (lang === 'fr' ? 'Demande de réservation immédiate' : 'طلب كراء الآلية الآن')}
                  </Button>
                ) : null}

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black py-3 px-4 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[48px]"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
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

            {/* Owner Card with Storefront Link Button */}
            <Card className="p-5 bg-white border border-steel-200 shadow-soft rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-ink uppercase tracking-wider">
                  {t('machine_detail.owner_info')}
                </h3>
                {ownerSlug && (
                  <Link
                    to={`/s/${ownerSlug}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-primary/20 hover:bg-primary text-ink border border-primary/40 transition-all cursor-pointer shadow-2xs"
                  >
                    <Store className="w-3.5 h-3.5 text-ink" />
                    <span>{lang === 'fr' ? 'Vitrine du loueur' : 'متجر المالك'}</span>
                  </Link>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <Link
                  to={ownerSlug ? `/s/${ownerSlug}` : '#'}
                  className="flex items-center gap-3 group flex-1 min-w-0"
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-ink text-primary font-black text-base flex items-center justify-center group-hover:ring-2 group-hover:ring-primary transition-all shadow-xs">
                      {machine.owner?.company_name?.slice(0, 2).toUpperCase() || 'JB'}
                    </div>
                    {ownerSlug && (
                      <span className="absolute -bottom-1 -end-1 bg-primary text-ink rounded-full p-1 border-2 border-white shadow-xs">
                        <Store className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-xs text-ink truncate group-hover:text-primary-dark transition-colors">
                      {machine.owner?.company_name || 'Entreprise Partenaire'}
                    </h4>
                    <p className="text-[11px] text-steel-500 truncate">
                      {machine.owner?.full_name || 'Responsable Parc'}
                    </p>
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3 h-3 shrink-0" />
                      <span>{t('machine_detail.verified_owner')}</span>
                    </span>
                  </div>
                </Link>

                {/* Direct icon button to owner's storefront next to owner profile */}
                {ownerSlug && (
                  <Link
                    to={`/s/${ownerSlug}`}
                    title={lang === 'fr' ? 'Ouvrir la vitrine du propriétaire' : 'فتح صفحة متجر المالك'}
                    className="p-2.5 rounded-xl bg-surface hover:bg-primary/25 text-ink border border-steel-200 hover:border-primary/50 transition-all cursor-pointer shrink-0 shadow-2xs hover:scale-105"
                    aria-label="Owner Storefront"
                  >
                    <Store className="w-4 h-4 text-primary-dark" />
                  </Link>
                )}
              </div>

              {/* Full button to view owner's storefront & fleet */}
              {ownerSlug && (
                <Link
                  to={`/s/${ownerSlug}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-surface hover:bg-amber-50/80 border border-steel-200 hover:border-primary/50 text-xs font-black text-ink transition-all cursor-pointer shadow-2xs"
                >
                  <Store className="w-4 h-4 text-primary-dark" />
                  <span>
                    {lang === 'fr'
                      ? 'Consulter le catalogue complet de ce loueur'
                      : 'زيارة متجر المالك وتصفح كامل الأسطول'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180 text-steel-400" />
                </Link>
              )}
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
                <MachineCard
                  key={m.id}
                  machine={m}
                  onBookClick={(target) => {
                    setModalMachine(target);
                    setIsBookingModalOpen(true);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Owner Storefront Fleet Section (Directly Below Similar Machines) */}
        {ownerMachines.length > 0 && (
          <div className="mt-14 pt-10 border-t border-steel-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 rounded-lg bg-primary/20 text-ink">
                    <Store className="w-4 h-4 text-primary-dark" />
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-ink">
                    {lang === 'fr'
                      ? `Autres engins de la vitrine de ${machine.owner?.company_name || 'ce partenaire'}`
                      : `آليات أخرى من متجر المالك (${machine.owner?.company_name || 'هذا الشريك'})`}
                  </h2>
                </div>
                <p className="text-xs text-steel-500">
                  {lang === 'fr'
                    ? 'Découvrez les autres équipements et engins proposés par le même propriétaire'
                    : 'استكشف المعدات والشاحنات الأخرى المتوفرة لدى نفس المالك في متجره المعتمد'}
                </p>
              </div>

              {ownerSlug && (
                <Link
                  to={`/s/${ownerSlug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-ink hover:bg-steel-800 text-primary transition-all cursor-pointer shadow-sm shrink-0 self-start sm:self-center"
                >
                  <Store className="w-4 h-4 text-primary" />
                  <span>{lang === 'fr' ? 'Voir toute la vitrine' : 'زيارة متجر المالك الكامل'}</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {ownerMachines.slice(0, 3).map((m) => (
                <MachineCard
                  key={m.id}
                  machine={m}
                  onBookClick={(target) => {
                    setModalMachine(target);
                    setIsBookingModalOpen(true);
                  }}
                />
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

      {/* Booking Modal for Clients, Intermediary Owners, and External Visitors */}
      {isBookingModalOpen && (
        <CreateBookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setModalMachine(null);
          }}
          machine={modalMachine || machine}
          initialStartDate={initialPreselectedStartDate}
          initialRateType={!modalMachine || modalMachine.id === machine.id ? selectedTerm : 'daily'}
          initialDuration={!modalMachine || modalMachine.id === machine.id ? selectedDuration : 1}
        />
      )}

      <Footer />
    </div>
  );
};

export default MachineDetailPage;
