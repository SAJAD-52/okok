import React, { useState } from 'react';
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
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { MOCK_MACHINES } from '../data/mockData';
import { MOROCCAN_CITIES, getCityById } from '../data/cities';
import { formatPriceMAD } from '../data/rentalTerms';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

const customMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang, isRTL } = useLanguage();

  const machine = MOCK_MACHINES.find((m) => m.id === id) || MOCK_MACHINES[0];
  const city = getCityById(machine.city_id);

  // Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [term, setTerm] = useState<'daily' | 'hourly' | 'weekly'>('daily');
  const [duration, setDuration] = useState(3);
  const [startDate, setStartDate] = useState('2026-03-15');
  const [withOperator, setWithOperator] = useState(machine.with_operator);
  const [siteAddress, setSiteAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  const calculateTotal = () => {
    let base = 0;
    if (term === 'hourly') base = machine.rate_hourly * duration;
    else if (term === 'daily') base = machine.rate_daily * duration;
    else base = machine.rate_weekly * duration;

    const operatorCost = withOperator && machine.operator_daily_rate ? machine.operator_daily_rate * duration : 0;
    return base + operatorCost;
  };

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsBookingModalOpen(false);
      toast.success(
        lang === 'fr'
          ? 'Demande de réservation transmise au propriétaire avec succès !'
          : 'تم إرسال طلب الحجز إلى مالك الآلية بنجاح!'
      );
      navigate('/app/bookings');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <PublicHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Back Link */}
        <button
          onClick={() => navigate('/marketplace')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-steel-600 hover:text-ink mb-6 cursor-pointer"
        >
          <ArrowIcon className="w-4 h-4" />
          <span>{lang === 'fr' ? 'Retour au catalogue' : 'الرجوع إلى سوق الآليات'}</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Info Column (2 spans) */}
          <div className="lg:col-span-2 space-y-6 text-start">
            {/* Title & Location Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="primary" size="md">
                  {machine.brand} {machine.model}
                </Badge>
                {machine.with_operator && (
                  <Badge variant="success" size="md">
                    {t('marketplace.with_operator')}
                  </Badge>
                )}
                <span className="text-xs text-steel-500 font-mono latin-nums">
                  {lang === 'fr' ? 'Année' : 'سنة'}: {machine.year}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink leading-tight">
                {lang === 'fr' ? machine.title_fr : machine.title_ar}
              </h1>

              <div className="flex items-center gap-2 text-xs text-steel-500 mt-2">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span>
                  {city ? (lang === 'fr' ? city.name_fr : city.name_ar) : machine.city_id},{' '}
                  {city ? (lang === 'fr' ? city.region_fr : city.region_ar) : ''}
                </span>
              </div>
            </div>

            {/* Gallery Image */}
            <div className="rounded-2xl overflow-hidden aspect-video bg-steel-100 border border-steel-200 shadow-soft">
              <img
                src={machine.images[0]}
                alt={lang === 'fr' ? machine.title_fr : machine.title_ar}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Description */}
            <Card className="p-6">
              <h2 className="text-base font-bold text-ink mb-3">
                {lang === 'fr' ? 'Description de la machine' : 'تفاصيل وحالة الآلية'}
              </h2>
              <p className="text-xs sm:text-sm text-steel-700 leading-relaxed">
                {lang === 'fr' ? machine.description_fr : machine.description_ar}
              </p>
            </Card>

            {/* Technical Specs */}
            <Card className="p-6">
              <h2 className="text-base font-bold text-ink mb-4">
                {t('machine_detail.specs_title')}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {machine.specs.operating_weight_ton && (
                  <div className="p-3 rounded-xl bg-surface border border-steel-200">
                    <span className="text-[11px] text-steel-500 block">
                      {t('machine_detail.weight')}
                    </span>
                    <span className="text-sm font-bold text-ink latin-nums font-mono">
                      {machine.specs.operating_weight_ton} Tonnes
                    </span>
                  </div>
                )}

                {machine.specs.bucket_capacity_m3 && (
                  <div className="p-3 rounded-xl bg-surface border border-steel-200">
                    <span className="text-[11px] text-steel-500 block">
                      {t('machine_detail.bucket')}
                    </span>
                    <span className="text-sm font-bold text-ink latin-nums font-mono">
                      {machine.specs.bucket_capacity_m3} m³
                    </span>
                  </div>
                )}

                {machine.specs.engine_power_hp && (
                  <div className="p-3 rounded-xl bg-surface border border-steel-200">
                    <span className="text-[11px] text-steel-500 block">
                      {t('machine_detail.engine')}
                    </span>
                    <span className="text-sm font-bold text-ink latin-nums font-mono">
                      {machine.specs.engine_power_hp} Ch (CV)
                    </span>
                  </div>
                )}

                {machine.specs.max_dig_depth_m && (
                  <div className="p-3 rounded-xl bg-surface border border-steel-200">
                    <span className="text-[11px] text-steel-500 block">
                      {t('machine_detail.reach')}
                    </span>
                    <span className="text-sm font-bold text-ink latin-nums font-mono">
                      {machine.specs.max_dig_depth_m} m
                    </span>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-surface border border-steel-200">
                  <span className="text-[11px] text-steel-500 block">
                    {t('machine_detail.year')}
                  </span>
                  <span className="text-sm font-bold text-ink latin-nums font-mono">
                    {machine.year}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-steel-200">
                  <span className="text-[11px] text-steel-500 block">
                    {t('machine_detail.condition')}
                  </span>
                  <span className="text-sm font-bold text-success capitalize">
                    {lang === 'fr' ? 'Excellente' : 'ممتازة ومفحوصة'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Leaflet Map Preview */}
            <Card className="p-6">
              <h2 className="text-base font-bold text-ink mb-3">
                {t('machine_detail.location_title')}
              </h2>
              <div className="w-full h-64 rounded-xl overflow-hidden border border-steel-200">
                <MapContainer
                  center={[machine.location_lat, machine.location_lng]}
                  zoom={12}
                  scrollWheelZoom={false}
                  className="w-full h-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker
                    position={[machine.location_lat, machine.location_lng]}
                    icon={customMarkerIcon}
                  />
                </MapContainer>
              </div>
            </Card>
          </div>

          {/* Booking & Pricing Sidebar Column (1 span) */}
          <div className="space-y-6 text-start">
            {/* Rates & Booking Card */}
            <Card className="p-6 bg-white border border-steel-200 shadow-elevated">
              <h2 className="text-sm font-bold uppercase tracking-wider text-steel-500 mb-4">
                {t('machine_detail.pricing_card_title')}
              </h2>

              <div className="space-y-3 pb-6 border-b border-steel-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-steel-600">
                    {t('machine_detail.rate_daily')}
                  </span>
                  <span className="text-lg font-bold text-ink font-mono latin-nums">
                    {formatPriceMAD(machine.rate_daily, lang)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-steel-600">
                    {t('machine_detail.rate_hourly')}
                  </span>
                  <span className="text-sm font-bold text-steel-700 font-mono latin-nums">
                    {formatPriceMAD(machine.rate_hourly, lang)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-steel-600">
                    {t('machine_detail.rate_weekly')}
                  </span>
                  <span className="text-sm font-bold text-steel-700 font-mono latin-nums">
                    {formatPriceMAD(machine.rate_weekly, lang)}
                  </span>
                </div>
              </div>

              {/* Service Features Included */}
              <div className="py-4 space-y-2.5 text-xs text-steel-700 border-b border-steel-100">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-success shrink-0" />
                  <span>{t('machine_detail.operator_included')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary shrink-0" />
                  <span>{t('machine_detail.delivery_available')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-steel-400 shrink-0" />
                  <span>{t('machine_detail.fuel_included')}</span>
                </div>
              </div>

              <div className="pt-6">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full justify-center font-bold"
                  onClick={() => setIsBookingModalOpen(true)}
                >
                  {t('marketplace.book_now')}
                </Button>
              </div>
            </Card>

            {/* Owner Profile Card */}
            <Card className="p-6 bg-white border border-steel-200">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-steel-900 text-primary flex items-center justify-center font-bold text-lg">
                  AT
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-ink">
                      {machine.owner?.company_name || 'Atlas BTP Maroc'}
                    </h3>
                    <ShieldCheck className="w-4 h-4 text-success" />
                  </div>
                  <p className="text-xs text-steel-500 mt-0.5">
                    {t('machine_detail.verified_owner')}
                  </p>
                  <p className="text-[11px] font-mono text-steel-400 mt-0.5">
                    ICE: 001928471000032
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => navigate('/app/messages')}
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                >
                  {t('machine_detail.contact_owner')}
                </Button>
                <a
                  href="tel:+212661245588"
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-semibold text-steel-700 bg-steel-50 hover:bg-steel-100 rounded-xl min-h-[44px]"
                >
                  <Phone className="w-4 h-4 text-primary-dark" />
                  <span>+212 6 61 24 55 88</span>
                </a>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Booking / Rental Request Modal */}
      <Modal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        title={t('marketplace.book_now')}
        description={lang === 'fr' ? machine.title_fr : machine.title_ar}
      >
        <form onSubmit={handleConfirmBooking} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['daily', 'hourly', 'weekly'] as const).map((tOpt) => (
              <button
                key={tOpt}
                type="button"
                onClick={() => setTerm(tOpt)}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all min-h-[44px] cursor-pointer ${
                  term === tOpt
                    ? 'border-primary bg-primary-100 text-ink'
                    : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                }`}
              >
                {tOpt === 'daily'
                  ? t('marketplace.per_day')
                  : tOpt === 'hourly'
                  ? t('marketplace.per_hour')
                  : lang === 'fr'
                  ? 'Par semaine'
                  : 'بالأسبوع'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              label={lang === 'fr' ? 'Date de début du chantier' : 'تاريخ بداية الورش'}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              type="number"
              min="1"
              label={
                term === 'daily'
                  ? lang === 'fr' ? 'Nombre de jours' : 'عدد الأيام'
                  : term === 'hourly'
                  ? lang === 'fr' ? 'Nombre d\'heures' : 'عدد الساعات'
                  : lang === 'fr' ? 'Nombre de semaines' : 'عدد الأسابيع'
              }
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
              required
            />
          </div>

          <Input
            label={lang === 'fr' ? 'Adresse exacte du chantier' : 'عنوان موقع الورش'}
            placeholder={lang === 'fr' ? 'ex. Zone Industrielle Sapino, Nouaceur' : 'مثال: المنطقة الصناعية سابينو، النواصر'}
            value={siteAddress}
            onChange={(e) => setSiteAddress(e.target.value)}
            required
          />

          {/* Pricing Summary */}
          <div className="p-4 bg-surface rounded-xl border border-steel-200 text-xs space-y-2">
            <div className="flex justify-between text-steel-600">
              <span>{lang === 'fr' ? 'Estimation totale :' : 'المجموع التقديري:'}</span>
              <span className="font-bold text-ink font-mono text-base latin-nums">
                {formatPriceMAD(calculateTotal(), lang)}
              </span>
            </div>
            <p className="text-[11px] text-steel-500">
              {lang === 'fr'
                ? '* Contrat de location numérique généré après acceptation du propriétaire.'
                : '* يتم إصدار عقد الكراء الرقمي فور تأكيد المالك.'}
            </p>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full justify-center font-bold"
            isLoading={isSubmitting}
          >
            {t('machine_detail.request_quote')}
          </Button>
        </form>
      </Modal>

      <Footer />
    </div>
  );
};

export default MachineDetailPage;
