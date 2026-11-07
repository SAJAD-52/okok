// ============================================================================
// JADIJCB: InDrive-Style Construction Site Radar Map (البحث الميداني للورش بالخريطة)
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Navigation,
  Crosshair,
  Filter,
  Truck,
  Phone,
  MessageSquare,
  ShieldCheck,
  Clock,
  Compass,
  ArrowRight,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  HardHat,
  Search,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Machine, ContractorSite, MoroccanCity } from '../types/database';
import { EQUIPMENT_CATEGORIES } from '../data/categories';
import { MOROCCAN_CITIES } from '../data/cities';
import { calculateDistanceKm, estimateDeliveryMinutes, formatDistanceKm, formatEta } from '../lib/geoUtils';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { CreateBookingModal } from '../components/bookings/CreateBookingModal';
import { toast } from '../components/ui/Toast';

// Fix leaflet default icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Map Click Listener to reposition the Site Pin
function SiteMapClickListener({ onSiteSelected }: { onSiteSelected: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSiteSelected(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Center view controller
function MapCenterController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

export const SiteRadarMapPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Selected Job Site Coordinates (Default to Casablanca or from query params)
  const initialLat = Number(searchParams.get('lat')) || 33.5731;
  const initialLng = Number(searchParams.get('lng')) || -7.5898;
  const initialCat = searchParams.get('category') || 'all';

  const [siteLocation, setSiteLocation] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });
  const [siteName, setSiteName] = useState<string>(searchParams.get('site') || 'ورش العمل الرئيسي');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(35);
  const [withOperatorOnly, setWithOperatorOnly] = useState<boolean>(false);
  const [fuelIncludedOnly, setFuelIncludedOnly] = useState<boolean>(false);

  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [savedSites, setSavedSites] = useState<ContractorSite[]>([]);
  const [activeSiteDropdown, setActiveSiteDropdown] = useState<boolean>(false);

  // Load saved contractor sites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('jadijcb_contractor_sites');
      if (stored) {
        setSavedSites(JSON.parse(stored));
      } else {
        const defaultSites: ContractorSite[] = [
          {
            id: 'site_1',
            contractor_id: user?.id || 'demo',
            name: 'ورش مشروع عين السبع - الدار البيضاء',
            city: 'الدار البيضاء',
            lat: 33.6042,
            lng: -7.5318,
            manager_name: 'هشام برادة',
            manager_phone: '+212661234567',
            created_at: new Date().toISOString(),
          },
          {
            id: 'site_2',
            contractor_id: user?.id || 'demo',
            name: 'ورش تهيئة المنطقة الصناعية - طنجة المتوسط',
            city: 'طنجة',
            lat: 35.7595,
            lng: -5.834,
            manager_name: 'عمر التازي',
            manager_phone: '+212662987654',
            created_at: new Date().toISOString(),
          },
        ];
        setSavedSites(defaultSites);
        localStorage.setItem('jadijcb_contractor_sites', JSON.stringify(defaultSites));
      }
    } catch {
      // Ignore localStorage error
    }
  }, [user]);

  // Load all published machines from Supabase
  useEffect(() => {
    async function loadMachines() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('machines')
          .select('*, profiles(full_name, company_name, phone, city, whatsapp_verified)')
          .eq('is_published', true);

        if (error) {
          console.warn('Machines load error:', error.message);
          return;
        }

        const mapped: Machine[] = (data || []).map((m: any) => ({
          id: m.id,
          owner_id: m.owner_id,
          title_ar: m.title_ar || m.brand + ' ' + m.model,
          title_fr: m.title_fr || m.brand + ' ' + m.model,
          description_ar: m.description_ar || '',
          description_fr: m.description_fr || '',
          category: m.category,
          category_id: m.category,
          brand: m.brand,
          model: m.model,
          year: m.year,
          listing_mode: m.listing_mode || 'rent',
          condition: m.condition || 'used',
          city: m.city,
          city_id: m.city,
          lat: m.lat || 33.5731,
          lng: m.lng || -7.5898,
          location_lat: m.lat || 33.5731,
          location_lng: m.lng || -7.5898,
          rate_hourly: Number(m.hourly_rate || m.rate_hourly) || 350,
          rate_daily: Number(m.daily_rate || m.rate_daily) || 2200,
          daily_rate: Number(m.daily_rate || m.rate_daily) || 2200,
          rate_weekly: Number(m.weekly_rate || m.rate_weekly) || 12000,
          sale_price: Number(m.sale_price) || 0,
          currency: 'MAD',
          with_operator: Boolean(m.with_operator),
          fuel_included: Boolean(m.fuel_included),
          delivery_available: Boolean(m.delivery_available),
          status: 'available',
          is_published: true,
          images: m.images?.length
            ? m.images
            : ['https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80'],
          specs: m.specs || {},
          views_count: m.views_count || 14,
          rating_avg: m.rating_avg || 4.9,
          reviews_count: m.reviews_count || 4,
          owner: {
            full_name: m.profiles?.full_name || 'مالك آليات معتمد',
            company_name: m.profiles?.company_name || 'شركة تأجير معتمدة',
            phone: m.profiles?.phone || '+212600000000',
            whatsapp_verified: true,
          },
          created_at: m.created_at,
          updated_at: m.updated_at || m.created_at,
        }));

        setMachines(mapped);
      } catch (err) {
        console.warn('Failed loading machines:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMachines();
  }, []);

  // Compute distance and sort machines from nearest to furthest relative to site location
  const machinesWithDistance = useMemo(() => {
    return machines
      .map((m) => {
        const distKm = calculateDistanceKm(
          siteLocation.lat,
          siteLocation.lng,
          m.location_lat || m.lat || 33.5731,
          m.location_lng || m.lng || -7.5898
        );
        const etaMinutes = estimateDeliveryMinutes(distKm);
        return {
          ...m,
          distanceKm: distKm,
          etaMinutes,
        };
      })
      .filter((m) => {
        // Category filter
        if (selectedCategory !== 'all' && m.category !== selectedCategory) {
          return false;
        }
        // Radius filter
        if (searchRadiusKm !== 999 && m.distanceKm > searchRadiusKm) {
          return false;
        }
        // Operator filter
        if (withOperatorOnly && !m.with_operator) {
          return false;
        }
        // Fuel filter
        if (fuelIncludedOnly && !m.fuel_included) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [machines, siteLocation, selectedCategory, searchRadiusKm, withOperatorOnly, fuelIncludedOnly]);

  // Create custom InDrive-style Marker for the Construction Job Site
  const siteMarkerIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-site-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(255, 180, 0, 0.35);
            animation: pulse-radar 2s infinite ease-out;
            top: -6px;
            left: -6px;
          "></div>
          <div style="
            background: #0B1220;
            color: #FFB400;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(0,0,0,0.4);
            border: 3px solid #FFFFFF;
            font-size: 16px;
            z-index: 2;
          ">
            🏗️
          </div>
          <div style="
            background: #0B1220;
            color: #FFFFFF;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 800;
            white-space: nowrap;
            margin-top: 4px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,180,0,0.5);
          ">
            📍 ${siteName.length > 20 ? siteName.slice(0, 18) + '...' : siteName}
          </div>
        </div>
      `,
      iconSize: [32, 60],
      iconAnchor: [16, 20],
    });
  }, [siteName]);

  // Create custom Machine marker icon on map
  const createMachineMarkerIcon = (m: Machine & { distanceKm: number }) => {
    const isSelected = selectedMachine?.id === m.id;
    return L.divIcon({
      className: 'custom-machine-radar-marker',
      html: `
        <div style="
          background: ${isSelected ? '#FFB400' : '#FFFFFF'};
          color: ${isSelected ? '#0B1220' : '#0B1220'};
          border: 2px solid ${isSelected ? '#0B1220' : '#FFB400'};
          padding: 4px 8px;
          border-radius: 20px;
          font-weight: 800;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          transform: translate(-50%, -100%);
          cursor: pointer;
          transition: transform 0.2s ease;
        ">
          <span>🚜</span>
          <span>${m.rate_daily?.toLocaleString('fr-FR')} DH</span>
          <span style="
            background: ${isSelected ? '#0B1220' : '#F1F5F9'};
            color: ${isSelected ? '#FFB400' : '#475569'};
            padding: 1px 5px;
            border-radius: 10px;
            font-size: 9px;
            font-weight: 700;
          ">
            ${m.distanceKm} km
          </span>
        </div>
      `,
      iconSize: [70, 26],
      iconAnchor: [35, 26],
    });
  };

  // User GPS action
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error(lang === 'fr' ? 'Géolocalisation non supportée' : 'تحديد الموقع غير مدعوم في متصفحك');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSiteLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSiteName(lang === 'fr' ? 'Ma position GPS actuelle' : 'موقعي الجغرافي الحالي (GPS)');
        toast.success(lang === 'fr' ? 'Position GPS mise à jour' : 'تم تحديد موقعك بنجاح');
      },
      () => {
        toast.error(lang === 'fr' ? 'Impossible de récupérer la position' : 'تعذر الحصول على إحداثيات الموقع');
      }
    );
  };

  const handleSelectSavedSite = (s: ContractorSite) => {
    setSiteLocation({ lat: s.lat, lng: s.lng });
    setSiteName(s.name);
    setActiveSiteDropdown(false);
    toast.success(lang === 'fr' ? `Chantier sélectionné : ${s.name}` : `تم اختيار ورش: ${s.name}`);
  };

  const handleCitySelect = (cityName: string) => {
    const city = MOROCCAN_CITIES.find((c: MoroccanCity) => c.name_ar === cityName || c.name_fr === cityName);
    if (city) {
      setSiteLocation({ lat: city.lat, lng: city.lng });
      setSiteName(`ورش ${city.name_ar}`);
    }
  };

  const handleStartChatWithOwner = async (m: Machine) => {
    if (!user?.id) {
      navigate('/auth');
      return;
    }
    navigate(`/app/messages?target=${m.owner_id}&machine=${m.id}`);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col relative">
      {/* Top Floating Control Bar */}
      <header className="sticky top-0 z-30 bg-ink text-white shadow-xl border-b border-steel-800">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Title & Back to Contractor Dashboard */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/entreprise')}
              className="text-white border-steel-700 hover:bg-steel-800"
              leftIcon={isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Tableau de bord' : 'لوحة المقاولة'}
            </Button>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                <HardHat className="w-4 h-4 text-primary" />
                <span>{lang === 'fr' ? 'Radar InDrive des Chantiers' : 'رادار الآليات الميداني لأوراش البناء'}</span>
              </h1>
            </div>
          </div>

          {/* Current Job Site Indicator & Switcher */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-x-auto">
            {/* Quick Saved Sites Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveSiteDropdown(!activeSiteDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-steel-900 border border-steel-700 hover:border-primary text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="max-w-[160px] truncate">{siteName}</span>
              </button>

              {activeSiteDropdown && (
                <div className="absolute end-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-steel-200 p-2 z-50 text-ink">
                  <span className="text-[10px] font-black text-steel-500 uppercase px-2 py-1 block">
                    {lang === 'fr' ? 'Chantiers enregistrés' : 'أوراشك المحفوظة:'}
                  </span>
                  {savedSites.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSavedSite(s)}
                      className="w-full text-start p-2 rounded-xl hover:bg-amber-50/60 text-xs font-bold flex items-center justify-between transition-colors"
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="text-[10px] text-steel-500">{s.city}</span>
                    </button>
                  ))}
                  <div className="pt-1 mt-1 border-t border-steel-100">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSiteDropdown(false);
                        navigate('/entreprise/projects');
                      }}
                      className="w-full text-center py-1.5 text-xs font-bold text-primary-dark hover:underline"
                    >
                      + {lang === 'fr' ? 'Gérer les chantiers' : 'إضافة وتعديل أوراش المقاولة'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* GPS Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseCurrentLocation}
              className="text-primary border-primary/40 hover:bg-steel-800 shrink-0"
              leftIcon={<Crosshair className="w-3.5 h-3.5" />}
            >
              <span className="hidden sm:inline">{lang === 'fr' ? 'Mon GPS' : 'موقعي'}</span>
            </Button>
          </div>
        </div>

        {/* Filter Bar: Machine Category + Radius + Amenities */}
        <div className="bg-steel-900 px-4 py-2.5 border-t border-steel-800/80">
          <div className="max-w-7xl mx-auto flex items-center gap-3 overflow-x-auto no-scrollbar text-xs">
            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Truck className="w-3.5 h-3.5 text-primary" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-steel-800 text-white font-bold px-3 py-1.5 rounded-xl border border-steel-700 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[150px]"
              >
                <option value="all">{lang === 'fr' ? 'Toutes les machines' : 'جميع أنواع الآليات'}</option>
                {EQUIPMENT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {lang === 'fr' ? c.name_fr : c.name_ar}
                  </option>
                ))}
              </select>
            </div>

            {/* City Jump Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Compass className="w-3.5 h-3.5 text-primary" />
              <select
                onChange={(e) => handleCitySelect(e.target.value)}
                className="bg-steel-800 text-white font-bold px-3 py-1.5 rounded-xl border border-steel-700 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">{lang === 'fr' ? 'Centrer sur ville...' : 'تغيير المدينة...'}</option>
                {MOROCCAN_CITIES.map((c: MoroccanCity) => (
                  <option key={c.id} value={c.name_ar}>
                    {lang === 'fr' ? c.name_fr : c.name_ar}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Radius Radius Slider/Buttons */}
            <div className="flex items-center gap-1 shrink-0 bg-steel-800 p-0.5 rounded-xl border border-steel-700">
              {[
                { radius: 15, label: '15 km' },
                { radius: 35, label: '35 km' },
                { radius: 70, label: '70 km' },
                { radius: 999, label: lang === 'fr' ? 'Tout le Maroc' : 'المغرب كاملاً' },
              ].map((r) => (
                <button
                  key={r.radius}
                  type="button"
                  onClick={() => setSearchRadiusKm(r.radius)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    searchRadiusKm === r.radius
                      ? 'bg-primary text-ink'
                      : 'text-steel-400 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Checkbox: With Operator */}
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-steel-300 shrink-0 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={withOperatorOnly}
                onChange={(e) => setWithOperatorOnly(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <span>{lang === 'fr' ? 'Avec chauffeur' : 'مع سائق معتمد'}</span>
            </label>

            {/* Checkbox: Fuel Included */}
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-steel-300 shrink-0 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={fuelIncludedOnly}
                onChange={(e) => setFuelIncludedOnly(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <span>{lang === 'fr' ? 'Carburant inclus' : 'الديزل مشمول'}</span>
            </label>
          </div>
        </div>
      </header>

      {/* Main Radar Layout: Split Map + InDrive Feed */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 relative min-h-[calc(100vh-130px)]">
        {/* Left Side: Real-Time InDrive Machinery Feed */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white border-e border-steel-200 overflow-y-auto max-h-[calc(100vh-130px)] flex flex-col order-2 lg:order-1">
          {/* Radar Header Status */}
          <div className="p-4 bg-surface border-b border-steel-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-steel-500 block">
                {lang === 'fr' ? 'Résultats du radar' : 'الآليات المتاحة حول ورشك:'}
              </span>
              <h2 className="text-sm font-black text-ink">
                {machinesWithDistance.length}{' '}
                {lang === 'fr'
                  ? `engins trouvés dans un rayon de ${searchRadiusKm === 999 ? 'tout le Maroc' : searchRadiusKm + ' km'}`
                  : `آليات تم رصدها ضمن نطاق ${searchRadiusKm === 999 ? 'المغرب كاملاً' : searchRadiusKm + ' كم'}`}
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
              {lang === 'fr' ? 'Disponible maintenant' : 'متاحة للتسليم الفوري'}
            </span>
          </div>

          {/* Machine List */}
          <div className="flex-1 p-3 space-y-3">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-steel-500">
                {lang === 'fr' ? 'Recherche des engins à proximité...' : 'جاري فحص ورصد أقرب الآليات لورشك...'}
              </div>
            ) : machinesWithDistance.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <Truck className="w-12 h-12 text-steel-300 mx-auto" />
                <h3 className="text-sm font-black text-ink">
                  {lang === 'fr' ? 'Aucun engin dans ce rayon' : 'لم يتم العثور على آليات في هذا النطاق'}
                </h3>
                <p className="text-xs text-steel-500">
                  {lang === 'fr'
                    ? 'Essayez d\'augmenter le rayon de recherche ou de changer la catégorie d\'engin.'
                    : 'جرّب توسيع نطاق البحث إلى 70 كم أو اختيار نوع آخر من الآليات.'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchRadiusKm(999)}
                >
                  {lang === 'fr' ? 'Rechercher dans tout le Maroc' : 'توسيع البحث لكافة مدن المغرب'}
                </Button>
              </div>
            ) : (
              machinesWithDistance.map((m) => {
                const isSelected = selectedMachine?.id === m.id;
                return (
                  <Card
                    key={m.id}
                    onClick={() => setSelectedMachine(m)}
                    className={`p-3.5 transition-all cursor-pointer rounded-2xl border text-start ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/30 bg-amber-50/40 shadow-md'
                        : 'border-steel-200 hover:border-steel-400 bg-white shadow-soft'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Thumbnail */}
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-steel-100 shrink-0 relative">
                        <img
                          src={m.images[0]}
                          alt={m.title_ar}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 start-1 bg-ink/80 backdrop-blur text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {m.year}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="text-xs sm:text-sm font-black text-ink truncate">
                              {lang === 'fr' ? m.title_fr : m.title_ar}
                            </h3>
                            <span className="text-xs font-black text-primary-dark whitespace-nowrap">
                              {m.rate_daily?.toLocaleString('fr-FR')} MAD
                            </span>
                          </div>

                          <p className="text-[11px] text-steel-500 truncate mt-0.5">
                            {m.brand} {m.model} · {m.city}
                          </p>

                          {/* InDrive Distance & ETA Pill */}
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-black border border-emerald-200">
                              <MapPin className="w-3 h-3 text-emerald-600" />
                              <span>{formatDistanceKm(m.distanceKm, lang)} {lang === 'fr' ? 'du chantier' : 'من الورش'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200">
                              <Clock className="w-3 h-3 text-blue-600" />
                              <span>{formatEta(m.etaMinutes, lang)}</span>
                            </span>
                          </div>
                        </div>

                        {/* Owner & Badges */}
                        <div className="mt-2.5 pt-2 border-t border-steel-100 flex items-center justify-between">
                          <span className="text-[10px] text-steel-600 font-bold flex items-center gap-1 truncate">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>{m.owner?.company_name || 'مالك معتمد'}</span>
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {m.with_operator && (
                              <span className="text-[9px] font-bold bg-steel-100 text-steel-700 px-1.5 py-0.5 rounded">
                                {lang === 'fr' ? 'Chauffeur' : 'سائق'}
                              </span>
                            )}
                            {m.fuel_included && (
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                                {lang === 'fr' ? 'Diesel' : 'ديزل'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Action Toolbar when Selected */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-steel-200/80 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsBookingModalOpen(true);
                          }}
                          className="flex-1 justify-center text-xs font-black"
                          leftIcon={<CalendarCheck className="w-3.5 h-3.5" />}
                        >
                          {lang === 'fr' ? 'Réserver pour ce chantier' : 'احجز فوراً لهذا الورش'}
                        </Button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartChatWithOwner(m);
                          }}
                          className="p-2 rounded-xl bg-steel-100 hover:bg-steel-200 text-steel-800 transition-colors"
                          title={lang === 'fr' ? 'Chatter avec le propriétaire' : 'محادثة المالك'}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        <a
                          href={`tel:${m.owner?.phone || '+212600000000'}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-xl bg-steel-100 hover:bg-steel-200 text-steel-800 transition-colors"
                          title={lang === 'fr' ? 'Appeler' : 'اتصال هاتفي'}
                        >
                          <Phone className="w-4 h-4" />
                        </a>

                        <a
                          href={`https://wa.me/${(m.owner?.phone || '+212600000000').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `السلام عليكم، تواصلت معك عبر JADIJCB بخصوص كراء آلية (${m.title_ar}) لورشنا في (${siteName})`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                          title="WhatsApp"
                        >
                          <span className="text-xs font-black">WA</span>
                        </a>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Interactive Leaflet Map with Radar & Site Pin */}
        <div className="lg:col-span-7 xl:col-span-8 relative h-[450px] lg:h-full order-1 lg:order-2">
          {/* Map Tip Overlay */}
          <div className="absolute top-3 start-3 z-[1000] bg-ink/90 backdrop-blur text-white px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-lg flex items-center gap-2 border border-steel-700 pointer-events-none">
            <span className="text-primary text-sm">📍</span>
            <span>{lang === 'fr' ? 'Cliquez sur la carte pour déplacer votre chantier' : 'انقر على الخريطة لتحديد أو نقل موقع ورشك'}</span>
          </div>

          <MapContainer
            center={[siteLocation.lat, siteLocation.lng]}
            zoom={11}
            style={{ width: '100%', height: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Listener to reposition site when contractor clicks on map */}
            <SiteMapClickListener
              onSiteSelected={(lat, lng) => {
                setSiteLocation({ lat, lng });
                toast.success(lang === 'fr' ? 'Position du chantier mise à jour' : 'تم تحديث موقع ورش العمل');
              }}
            />

            {/* Fly to new center when changed */}
            <MapCenterController center={[siteLocation.lat, siteLocation.lng]} zoom={11} />

            {/* Construction Job Site Marker */}
            <Marker position={[siteLocation.lat, siteLocation.lng]} icon={siteMarkerIcon}>
              <Popup>
                <div className="text-center p-1">
                  <span className="font-black text-xs text-ink block">{siteName}</span>
                  <span className="text-[10px] text-steel-500 block mt-0.5">
                    {siteLocation.lat.toFixed(4)}, {siteLocation.lng.toFixed(4)}
                  </span>
                </div>
              </Popup>
            </Marker>

            {/* Radar Radius Circle */}
            {searchRadiusKm !== 999 && (
              <Circle
                center={[siteLocation.lat, siteLocation.lng]}
                radius={searchRadiusKm * 1000}
                pathOptions={{
                  color: '#FFB400',
                  fillColor: '#FFB400',
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '4, 8',
                }}
              />
            )}

            {/* Machinery Markers */}
            {machinesWithDistance.map((m) => (
              <Marker
                key={m.id}
                position={[m.location_lat || m.lat || 33.5731, m.location_lng || m.lng || -7.5898]}
                icon={createMachineMarkerIcon(m)}
                eventHandlers={{
                  click: () => {
                    setSelectedMachine(m);
                  },
                }}
              >
                <Popup>
                  <div className="p-2 text-start space-y-1.5 min-w-[180px]">
                    <h4 className="font-black text-xs text-ink">{lang === 'fr' ? m.title_fr : m.title_ar}</h4>
                    <p className="text-[11px] text-primary-dark font-black">
                      {m.rate_daily?.toLocaleString('fr-FR')} MAD / {lang === 'fr' ? 'jour' : 'يوم'}
                    </p>
                    <p className="text-[10px] text-emerald-700 font-bold">
                      📍 {formatDistanceKm(m.distanceKm, lang)} {lang === 'fr' ? 'du chantier' : 'من ورشك'}
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedMachine(m);
                        setIsBookingModalOpen(true);
                      }}
                      className="w-full justify-center text-[11px] mt-1"
                    >
                      {lang === 'fr' ? 'Réserver' : 'احجز الآن'}
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </main>

      {/* Booking Modal */}
      {selectedMachine && (
        <CreateBookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          machines={[selectedMachine]}
          existingBookings={[]}
          onBookingCreated={() => {
            setIsBookingModalOpen(false);
            toast.success(
              lang === 'fr'
                ? 'Réservation envoyée au propriétaire de l\'engin !'
                : 'تم إرسال طلب الحجز لمالك الآلية بنجاح!'
            );
            navigate('/entreprise/bookings');
          }}
        />
      )}
    </div>
  );
};

export default SiteRadarMapPage;
