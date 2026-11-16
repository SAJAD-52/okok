// ============================================================================
// JADIJCB: Driver Job Offers Section (/driver/joboffer)
// Displays urgent & active job offers as clean structured cards with:
// machine type, offered salary (MAD), city & location, duration, experience,
// accommodation/meals info, and apply/call/WhatsApp/chat actions.
// ============================================================================

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  Clock,
  Award,
  Building2,
  Phone,
  MessageSquare,
  CheckCircle2,
  Search,
  Home,
  Utensils,
  BellRing,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { DriverJobOffer } from '../types/database';
import {
  DRIVER_MACHINE_OPTIONS,
  getDriverExperienceOption,
} from '../data/driverMachines';
import {
  applyToDriverJobOffer,
  fetchDriverJobOffers,
  subscribeDriverJobOffers,
} from '../lib/driverOfferService';
import { chatStore } from '../lib/chatStore';

type OfferFilterTab = 'all' | 'matching' | 'urgent' | 'applied';

function formatRelativeTime(iso: string, lang: 'ar' | 'fr'): string {
  const diffMin = Math.max(
    1,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  );
  if (diffMin < 60) {
    return lang === 'fr' ? `Il y a ${diffMin} min` : `منذ ${diffMin} دقيقة`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return lang === 'fr' ? `Il y a ${diffHours} h` : `منذ ${diffHours} ساعة`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return lang === 'fr' ? `Il y a ${diffDays} j` : `منذ ${diffDays} يوم`;
}

export const DriverJobOffersPage: React.FC = () => {
  const { lang } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [offers, setOffers] = useState<DriverJobOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OfferFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedMachine, setSelectedMachine] = useState('all');
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const driverId = profile?.id || user?.id || 'driver-local';
  const driverMachines = useMemo(
    () => (Array.isArray(profile?.driver_machines) ? profile.driver_machines : []),
    [profile?.driver_machines]
  );

  const loadOffers = useCallback(async () => {
    try {
      const list = await fetchDriverJobOffers(driverId);
      setOffers(list);
    } finally {
      setIsLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    loadOffers();
    const unsub = subscribeDriverJobOffers(driverMachines, () => {
      loadOffers();
    });
    return unsub;
  }, [loadOffers, driverMachines]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      if (o.city) set.add(o.city);
    });
    return Array.from(set);
  }, [offers]);

  const filteredOffers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return offers.filter((offer) => {
      if (
        activeTab === 'matching' &&
        driverMachines.length > 0 &&
        !driverMachines.includes(offer.machine_category)
      ) {
        return false;
      }
      if (activeTab === 'urgent' && !offer.is_urgent) return false;
      if (activeTab === 'applied' && !offer.has_applied) return false;

      if (selectedCity !== 'all' && offer.city !== selectedCity) return false;
      if (selectedMachine !== 'all' && offer.machine_category !== selectedMachine) {
        return false;
      }

      if (q) {
        const hay = [
          offer.machine_label_ar,
          offer.machine_label_fr,
          offer.city,
          offer.work_location_note,
          offer.owner_name,
          offer.owner_company,
          offer.description_ar,
          offer.description_fr,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [offers, activeTab, driverMachines, selectedCity, selectedMachine, searchQuery]);

  const handleApply = async (offer: DriverJobOffer) => {
    setApplyingId(offer.id);
    await applyToDriverJobOffer({
      offer,
      driverId,
      driverName: profile?.full_name || 'سائق JADIJCB',
      driverPhone: profile?.phone || '',
      driverCity: profile?.city || '',
      driverExperience: profile?.driver_experience_years || '3_5',
    });

    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, has_applied: true } : o))
    );
    setApplyingId(null);

    toast.success(
      lang === 'fr'
        ? 'Votre intérêt a été transmis ! Vous pouvez aussi appeler le propriétaire.'
        : 'تم تسجيل طلبك للعمل بنجاح! يمكنك أيضاً الاتصال المباشر بالمالك.'
    );
  };

  const handleStartChat = async (offer: DriverJobOffer) => {
    if (offer.is_demo || offer.owner_id.startsWith('starter-')) {
      if (!offer.has_applied) {
        await handleApply(offer);
      }
      if (offer.owner_phone) {
        const cleanWa = offer.owner_phone.replace(/\D/g, '');
        window.open(
          `https://wa.me/${cleanWa}?text=${encodeURIComponent(
            lang === 'fr'
              ? `Bonjour, je suis conducteur (${profile?.full_name || ''}) intéressé par l'offre : ${offer.machine_label_fr}`
              : `السلام عليكم، أنا سائق (${profile?.full_name || ''}) مهتم بعرض العمل الخاص بـ: ${offer.machine_label_ar}`
          )}`,
          '_blank',
          'noopener,noreferrer'
        );
      }
      return;
    }

    try {
      const conv = await chatStore.getOrCreateConversation(
        driverId,
        offer.owner_id,
        null,
        {
          id: offer.owner_id,
          full_name: offer.owner_name,
          company_name: offer.owner_company,
          phone: offer.owner_phone || '',
          role: 'owner',
        }
      );

      await chatStore.sendMessage(
        conv.id,
        driverId,
        lang === 'fr'
          ? `Bonjour, je postule pour votre offre de conducteur (${offer.machine_label_fr}) à ${offer.city}.`
          : `السلام عليكم، أنا سائق محترف أتقدم لطلب العمل الخاص بـ (${offer.machine_label_ar}) بمدينة ${offer.city}.`,
        offer.owner_id,
        {
          senderName: profile?.full_name || 'سائق',
          recipientRole: 'owner',
        }
      );

      navigate(`/driver/messages?conv=${encodeURIComponent(conv.id)}`);
    } catch {
      toast.error(
        lang === 'fr'
          ? 'Impossible d’ouvrir la messagerie.'
          : 'تعذر فتح المحادثة، يمكنك استخدام الاتصال المباشر.'
      );
    }
  };

  return (
    <div className="space-y-5 text-start">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink">
            {lang === 'fr'
              ? 'Offres d’emploi pour conducteurs'
              : 'عروض وطلبات العمل للسائقين'}
          </h1>
          <p className="text-xs sm:text-sm text-steel-600 mt-0.5">
            {lang === 'fr'
              ? 'Toutes les campagnes urgentes des propriétaires d’engins apparaissent ici avec tarif, ville et détails du chantier.'
              : 'تظهر هنا جميع طلبات وحملات التشغيل العاجلة التي يطلقها ملاك الآليات مع نوع الآلية، الأجرة، والمدينة.'}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-ink shrink-0">
          <BellRing className="w-4 h-4 text-primary-dark shrink-0" />
          <span className="tabular-nums">
            {filteredOffers.length}{' '}
            {lang === 'fr' ? 'offres affichées' : 'عرض متاح'}
          </span>
        </div>
      </div>

      {/* Filters & Segmented Tabs */}
      <Card className="p-4 bg-white border border-steel-200 rounded-2xl space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              {
                id: 'all',
                label: lang === 'fr' ? `Toutes (${offers.length})` : `الكل (${offers.length})`,
              },
              {
                id: 'matching',
                label:
                  lang === 'fr'
                    ? 'Mes engins'
                    : 'تطابق آلياتي',
              },
              {
                id: 'urgent',
                label:
                  lang === 'fr'
                    ? 'Urgent'
                    : 'عاجل الآن',
              },
              {
                id: 'applied',
                label:
                  lang === 'fr'
                    ? 'Mes candidatures'
                    : 'طلبات قدّمتها',
              },
            ] as { id: OfferFilterTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 min-h-[40px] transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-ink text-primary'
                  : 'bg-surface text-steel-600 hover:text-ink border border-steel-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-steel-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'fr'
                  ? 'Rechercher engin, ville, chantier...'
                  : 'ابحث بنوع الآلية، المدينة، أو اسم المقاولة...'
              }
              className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-steel-300 bg-white text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
          </div>

          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-steel-300 bg-white text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          >
            <option value="all">
              {lang === 'fr' ? 'Toutes les villes' : 'كل المدن المغربية'}
            </option>
            {availableCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-steel-300 bg-white text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          >
            <option value="all">
              {lang === 'fr' ? 'Tous les engins' : 'كل أنواع الآليات'}
            </option>
            {DRIVER_MACHINE_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {lang === 'fr' ? m.labelFr : m.labelAr}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Job Offers Cards Feed */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-steel-100 animate-pulse" />
          ))}
        </div>
      ) : filteredOffers.length === 0 ? (
        <Card className="p-10 text-center bg-white border border-steel-200 rounded-2xl space-y-3">
          <Briefcase className="w-10 h-10 text-steel-300 mx-auto" />
          <h3 className="text-base font-black text-ink">
            {lang === 'fr'
              ? 'Aucune offre ne correspond aux filtres'
              : 'لا توجد عروض مطابقة لاختيارات البحث الحالية'}
          </h3>
          <p className="text-xs text-steel-500 max-w-md mx-auto">
            {lang === 'fr'
              ? 'Réinitialisez les filtres pour consulter toutes les offres disponibles.'
              : 'أعد ضبط الفلاتر لعرض جميع عروض العمل المفتوحة في مختلف المدن.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => {
              setActiveTab('all');
              setSearchQuery('');
              setSelectedCity('all');
              setSelectedMachine('all');
            }}
            className="min-h-[44px] text-xs font-bold"
          >
            {lang === 'fr' ? 'Afficher toutes les offres' : 'عرض كل العروض'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOffers.map((offer) => {
            const isMatch = driverMachines.includes(offer.machine_category);
            const expReq = offer.experience_required
              ? getDriverExperienceOption(offer.experience_required)
              : null;

            return (
              <Card
                key={offer.id}
                className="p-5 bg-white border border-steel-200 rounded-2xl flex flex-col justify-between gap-4 hover:border-primary/70 transition-colors"
              >
                <div className="space-y-3.5">
                  {/* Top Metadata Line (clean unboxed typography with separators) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-steel-500">
                      {offer.is_urgent && (
                        <span className="inline-flex items-center gap-1 font-black text-rose-600">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {lang === 'fr' ? 'Recrutement urgent' : 'طلب عاجل'}
                        </span>
                      )}
                      {offer.is_urgent && <span aria-hidden="true">·</span>}
                      <span className="tabular-nums">
                        {formatRelativeTime(offer.created_at, lang)}
                      </span>
                      {isMatch && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-emerald-700">
                            {lang === 'fr' ? 'Correspond à vos engins' : 'يطابق تخصصك'}
                          </span>
                        </>
                      )}
                    </div>

                    {offer.has_applied && (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        {lang === 'fr' ? 'Candidature envoyée' : 'تم التقديم'}
                      </span>
                    )}
                  </div>

                  {/* Primary Title (Machine Type) & Offered Price (MAD) */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-steel-100">
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-black text-ink leading-snug">
                        {lang === 'fr' ? offer.machine_label_fr : offer.machine_label_ar}
                      </h2>
                      <span className="text-xs text-steel-500 block mt-0.5">
                        {lang === 'fr' ? offer.machine_label_ar : offer.machine_label_fr}
                      </span>
                    </div>

                    <div className="text-end shrink-0 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                      <span className="text-[10px] font-bold text-steel-600 block">
                        {lang === 'fr' ? 'Rémunération proposée' : 'الأجرة / الثمن'}
                      </span>
                      <span className="text-base sm:text-lg font-black text-ink tabular-nums">
                        {offer.offered_salary.toLocaleString('fr-FR')}{' '}
                        <span className="text-xs font-bold">
                          {lang === 'fr'
                            ? `MAD/${offer.salary_unit === 'month' ? 'mois' : 'jour'}`
                            : `د.م/${offer.salary_unit === 'month' ? 'شهر' : 'يوم'}`}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Structured 2x2 Key Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-primary-dark shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-steel-500 block text-[11px]">
                          {lang === 'fr' ? 'Ville & Chantier' : 'المدينة وموقع العمل'}
                        </span>
                        <span className="font-bold text-ink block">
                          {offer.city}
                          {offer.work_location_note ? ` — ${offer.work_location_note}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-primary-dark shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-steel-500 block text-[11px]">
                          {lang === 'fr' ? 'Durée prévue' : 'المدة المتوقعة'}
                        </span>
                        <span className="font-bold text-ink block">
                          {offer.duration_label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-primary-dark shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-steel-500 block text-[11px]">
                          {lang === 'fr' ? 'Propriétaire / Entreprise' : 'المالك / المقاولة'}
                        </span>
                        <span className="font-bold text-ink block truncate">
                          {offer.owner_company || offer.owner_name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Award className="w-4 h-4 text-primary-dark shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-steel-500 block text-[11px]">
                          {lang === 'fr' ? 'Expérience souhaitée' : 'الخبرة المطلوبة'}
                        </span>
                        <span className="font-bold text-ink block">
                          {expReq
                            ? lang === 'fr'
                              ? expReq.shortFr
                              : expReq.shortAr
                            : lang === 'fr'
                            ? 'Confirmé'
                            : 'سائق متمرس'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description & Perks */}
                  <div className="space-y-2 pt-1">
                    {(offer.accommodation_included || offer.meals_included) && (
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-emerald-700">
                        {offer.accommodation_included && (
                          <span className="inline-flex items-center gap-1">
                            <Home className="w-3.5 h-3.5" />
                            {lang === 'fr' ? 'Logement assuré' : 'السكن موفّر'}
                          </span>
                        )}
                        {offer.meals_included && (
                          <span className="inline-flex items-center gap-1">
                            <Utensils className="w-3.5 h-3.5" />
                            {lang === 'fr' ? 'Repas pris en charge' : 'التغذية متوفرة'}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-steel-600 leading-relaxed">
                      {lang === 'fr' ? offer.description_fr : offer.description_ar}
                    </p>
                  </div>
                </div>

                {/* Card Bottom Action Bar */}
                <div className="pt-3 border-t border-steel-100 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={offer.has_applied ? 'outline' : 'primary'}
                    size="md"
                    isLoading={applyingId === offer.id}
                    disabled={Boolean(offer.has_applied)}
                    onClick={() => handleApply(offer)}
                    className="flex-1 min-w-[160px] justify-center font-black text-xs min-h-[44px]"
                    leftIcon={
                      offer.has_applied ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Briefcase className="w-4 h-4" />
                      )
                    }
                  >
                    {offer.has_applied
                      ? lang === 'fr'
                        ? 'Intérêt envoyé'
                        : 'تم إرسال اهتمامك'
                      : lang === 'fr'
                      ? 'Postuler à cette offre'
                      : 'تقديم طلب / مهتم بالعمل'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => handleStartChat(offer)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-ink text-white hover:bg-steel-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>{lang === 'fr' ? 'Discuter' : 'تواصل'}</span>
                  </button>

                  {offer.owner_phone && (
                    <a
                      href={`tel:${offer.owner_phone}`}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DriverJobOffersPage;
