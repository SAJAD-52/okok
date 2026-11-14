// ============================================================================
// JADIJCB: Contractor Job Sites & Projects Management (أوراش ومشاريع المقاولة)
// Responsive Mobile-First Layout + Interactive Map Site Picker
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardHat,
  MapPin,
  Plus,
  Trash2,
  Compass,
  Phone,
  User,
  Building,
  CheckCircle,
  X,
  Navigation,
  Radio,
  Globe,
  MessageSquare,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ContractorSite, DispatchCampaign, MoroccanCity } from '../types/database';
import { MOROCCAN_CITIES } from '../data/cities';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { MapLocationPicker } from '../components/machines/MapLocationPicker';
import { DispatchCampaignModal } from '../components/projects/DispatchCampaignModal';
import {
  closeDispatchCampaign,
  fetchContractorCampaigns,
  subscribeLocalDispatchEvents,
} from '../lib/dispatchService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';

export const ContractorProjectsPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [sites, setSites] = useState<ContractorSite[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [dispatchSite, setDispatchSite] = useState<ContractorSite | null>(null);
  const [campaigns, setCampaigns] = useState<DispatchCampaign[]>([]);

  // New Site Form
  const [siteName, setSiteName] = useState('');
  const [cityId, setCityId] = useState('casablanca');
  const [city, setCity] = useState('الدار البيضاء');
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('+2126');
  const [lat, setLat] = useState<number>(33.5731);
  const [lng, setLng] = useState<number>(-7.5898);

  const contractorId = user?.id || profile?.id || 'demo';

  useEffect(() => {
    let cancelled = false;
    const loadCampaigns = async () => {
      const list = await fetchContractorCampaigns(contractorId);
      if (!cancelled) setCampaigns(list);
    };
    loadCampaigns();

    const unsubLocal = subscribeLocalDispatchEvents(() => {
      loadCampaigns();
    });

    let channel: any = null;
    if (isSupabaseConfigured && user?.id) {
      channel = supabase
        .channel(`contractor_campaigns_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'dispatch_notifications',
            filter: `contractor_id=eq.${user.id}`,
          },
          () => {
            loadCampaigns();
          }
        )
        .subscribe();
    }

    return () => {
      cancelled = true;
      unsubLocal();
      if (channel) supabase.removeChannel(channel);
    };
  }, [contractorId, user?.id]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('jadijcb_contractor_sites');
      if (stored) {
        setSites(JSON.parse(stored));
      } else {
        const defaultSites: ContractorSite[] = [
          {
            id: 'site_1',
            contractor_id: user?.id || 'demo',
            name: 'ورش مشروع عين السبع - الدار البيضاء',
            city: 'الدار البيضاء',
            address: 'المنطقة الصناعية عين السبع، شارع الشفشاوني',
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
            address: 'القصر المجاز، ميناء طنجة المتوسط',
            lat: 35.7595,
            lng: -5.834,
            manager_name: 'عمر التازي',
            manager_phone: '+212662987654',
            created_at: new Date().toISOString(),
          },
          {
            id: 'site_3',
            contractor_id: user?.id || 'demo',
            name: 'مشروع إنجاز مسلك قروي - ورزازات / درعة',
            city: 'ورزازات',
            address: 'طريق تزارين - إقليم زاكورة',
            lat: 30.9335,
            lng: -6.937,
            manager_name: 'محمد الصغيري',
            manager_phone: '+212671009988',
            created_at: new Date().toISOString(),
          },
        ];
        setSites(defaultSites);
        localStorage.setItem('jadijcb_contractor_sites', JSON.stringify(defaultSites));
      }
    } catch {
      // Ignore
    }
  }, [user]);

  const saveSitesToStorage = (updated: ContractorSite[]) => {
    setSites(updated);
    try {
      localStorage.setItem('jadijcb_contractor_sites', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleCityChange = (selectedCityId: string) => {
    const found = MOROCCAN_CITIES.find((c: MoroccanCity) => c.id === selectedCityId);
    if (found) {
      setCityId(found.id);
      setCity(lang === 'fr' ? found.name_fr : found.name_ar);
      setLat(found.lat);
      setLng(found.lng);
    }
  };

  const handleMapLocationChange = (newLat: number, newLng: number, matchedCityId?: string) => {
    setLat(newLat);
    setLng(newLng);
    if (matchedCityId) {
      const found = MOROCCAN_CITIES.find((c: MoroccanCity) => c.id === matchedCityId);
      if (found) {
        setCityId(found.id);
        setCity(lang === 'fr' ? found.name_fr : found.name_ar);
      }
    }
  };

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim()) {
      toast.error(lang === 'fr' ? 'Veuillez saisir le nom du chantier' : 'يرجى إدخال اسم الورش');
      return;
    }

    const matchedCity = MOROCCAN_CITIES.find((c: MoroccanCity) => c.id === cityId);
    const cityLabel = matchedCity ? (lang === 'fr' ? matchedCity.name_fr : matchedCity.name_ar) : city;

    const newSite: ContractorSite = {
      id: 'site_' + Math.random().toString(36).substring(2, 9),
      contractor_id: user?.id || 'demo',
      name: siteName.trim(),
      city: cityLabel,
      lat,
      lng,
      manager_name: managerName.trim() || undefined,
      manager_phone: managerPhone.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    const updated = [newSite, ...sites];
    saveSitesToStorage(updated);
    setIsAddModalOpen(false);
    toast.success(lang === 'fr' ? 'Chantier ajouté avec succès !' : 'تمت إضافة الورش بنجاح!');

    // Reset form
    setSiteName('');
    setManagerName('');
    setManagerPhone('+2126');
  };

  const handleDeleteSite = (siteId: string) => {
    const updated = sites.filter((s) => s.id !== siteId);
    saveSitesToStorage(updated);
    toast.success(lang === 'fr' ? 'Chantier supprimé' : 'تم حذف الورش من القائمة');
  };

  return (
    <div className="space-y-5 sm:space-y-6 text-start">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-black text-ink flex items-center gap-2">
            <HardHat className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
            <span className="text-balance">
              {lang === 'fr' ? 'Mes Chantiers & Projets de Construction' : 'أوراش ومشاريع المقاولة'}
            </span>
          </h1>
          <p className="text-xs text-steel-500 mt-1 leading-relaxed">
            {lang === 'fr'
              ? 'Enregistrez vos chantiers sur la carte pour trouver en un clic les engins les plus proches grâce au radar.'
              : 'احفظ مواقع أوراش البناء الخاصة بشركتك على الخريطة للبحث الفوري عن أقرب الآليات والشاحنات بضغطة زر واحدة.'}
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="w-full sm:w-auto justify-center shrink-0 min-h-[44px] font-black"
        >
          {lang === 'fr' ? 'Ajouter un nouveau chantier' : 'إضافة ورش عمل جديد'}
        </Button>
      </div>

      {/* Empty State */}
      {sites.length === 0 ? (
        <Card className="p-8 sm:p-12 bg-white border border-steel-200 rounded-3xl text-center space-y-3">
          <MapPin className="w-12 h-12 text-steel-300 mx-auto" />
          <h2 className="text-base font-black text-ink">
            {lang === 'fr' ? 'Aucun chantier enregistré' : 'لا توجد أوراش مسجلة حالياً'}
          </h2>
          <p className="text-xs text-steel-500 max-w-md mx-auto">
            {lang === 'fr'
              ? 'Placez votre premier chantier sur la carte pour calculer automatiquement les distances des engins disponibles.'
              : 'حدد موقع ورشك الأول على الخريطة لتسريع إيجاد أقرب الآليات وتوجيه السائقين بسهولة.'}
          </p>
          <div className="pt-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              className="min-h-[44px]"
            >
              {lang === 'fr' ? 'Ajouter un chantier' : 'إضافة ورش جديد'}
            </Button>
          </div>
        </Card>
      ) : (
        /* Grid of Saved Sites */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {sites.map((s) => (
            <Card
              key={s.id}
              className="p-4 sm:p-5 bg-white border border-steel-200 shadow-soft rounded-2xl sm:rounded-3xl flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-primary-dark flex items-center justify-center font-black shrink-0">
                      <Building className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-ink leading-snug break-words">{s.name}</h3>
                      <span className="text-[11px] text-steel-500 flex items-center gap-1 font-bold mt-0.5">
                        <MapPin className="w-3 h-3 text-steel-400 shrink-0" />
                        <span>{s.city}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSite(s.id)}
                    className="min-w-[44px] min-h-[44px] -m-1.5 flex items-center justify-center rounded-xl text-steel-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                    title={lang === 'fr' ? 'Supprimer' : 'حذف'}
                    aria-label={lang === 'fr' ? 'Supprimer' : 'حذف'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Location / Coordinates Row */}
                <div className="text-xs text-steel-600 bg-steel-50 px-3 py-2 rounded-xl border border-steel-100 space-y-1">
                  {s.address && <p className="text-steel-700 leading-relaxed">{s.address}</p>}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-steel-500">
                    <span className="flex items-center gap-1 font-bold text-ink">
                      <Navigation className="w-3 h-3 text-primary-dark shrink-0" />
                      <span>{lang === 'fr' ? 'Position GPS carte' : 'موقع الخريطة'}</span>
                    </span>
                    <span dir="ltr" className="font-mono tabular-nums text-[11px]">
                      {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                    </span>
                  </div>
                </div>

                {(s.manager_name || s.manager_phone) && (
                  <div className="pt-2 border-t border-steel-100 text-xs text-steel-600 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <User className="w-3.5 h-3.5 text-steel-400 shrink-0" />
                      <span className="truncate">{s.manager_name || (lang === 'fr' ? 'Chef de chantier' : 'رئيس الورش')}</span>
                    </span>
                    {s.manager_phone && (
                      <a
                        href={`tel:${s.manager_phone}`}
                        dir="ltr"
                        className="font-bold font-mono tabular-nums text-primary-dark hover:underline flex items-center gap-1 py-1"
                      >
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{s.manager_phone}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Direct Radar + Live Dispatch Campaign Buttons */}
              <div className="pt-3.5 mt-3.5 border-t border-steel-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    navigate(`/entreprise/map?lat=${s.lat}&lng=${s.lng}&site=${encodeURIComponent(s.name)}`)
                  }
                  leftIcon={<Compass className="w-4 h-4" />}
                  className="w-full justify-center font-black text-[11px] sm:text-xs min-h-[44px] px-2.5 !whitespace-normal text-center leading-tight py-2"
                >
                  {lang === 'fr' ? 'Voir sur la carte' : 'ابحث في الخريطة'}
                </Button>

                <Button
                  type="button"
                  variant="dark"
                  size="sm"
                  onClick={() => setDispatchSite(s)}
                  leftIcon={<Radio className="w-4 h-4 text-primary" />}
                  className="w-full justify-center font-black text-[11px] sm:text-xs min-h-[44px] px-2.5 !whitespace-normal text-center leading-tight py-2"
                >
                  {lang === 'fr' ? 'Lancer alerte directe' : 'إطلاق حملة بحث مباشر'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Active & Recent Live Dispatch Campaigns Section */}
      {campaigns.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary-dark shrink-0" />
              <span>
                {lang === 'fr'
                  ? 'Campagnes de recherche directe lancées'
                  : 'حملات البحث المباشر المرسلة للملاك'}
              </span>
            </h2>
            <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 tabular-nums">
              {campaigns.filter((c) => c.status === 'active').length}{' '}
              {lang === 'fr' ? 'actives' : 'نشطة'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((camp) => {
              const acceptedNotifs = (camp.notifications || []).filter((n) => n.status === 'accepted');
              const isClosed = camp.status === 'closed';

              return (
                <Card
                  key={camp.id}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isClosed
                      ? 'bg-steel-50/70 border-steel-200 opacity-85'
                      : 'bg-white border-amber-300 shadow-soft'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                            isClosed
                              ? 'bg-steel-200 text-steel-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isClosed
                            ? lang === 'fr'
                              ? 'Clôturée'
                              : 'مغلقة'
                            : lang === 'fr'
                            ? 'En diffusion live'
                            : 'نشطة الآن'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-steel-100 text-steel-700 text-[10px] font-bold tabular-nums">
                          {camp.is_nationwide ? (
                            <>
                              <Globe className="w-3 h-3 text-primary-dark" />
                              <span>{lang === 'fr' ? 'Tout le Maroc' : 'المغرب كاملاً'}</span>
                            </>
                          ) : (
                            <span>
                              {lang === 'fr' ? `Rayon ${camp.radius_km} km` : `نطاق ${camp.radius_km} كم`}
                            </span>
                          )}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-ink mt-1.5">{camp.machine_name}</h3>
                      <p className="text-[11px] text-steel-500 font-bold flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{camp.site_name}</span>
                      </p>
                    </div>

                    <div className="text-end shrink-0">
                      <span className="text-xs font-black text-primary-dark font-mono tabular-nums block">
                        {camp.matched_owners_count}{' '}
                        {lang === 'fr' ? 'notifiés' : 'مالك'}
                      </span>
                      <span className="text-[10px] text-steel-400 font-mono" dir="ltr">
                        {camp.created_at?.slice(0, 10)}
                      </span>
                    </div>
                  </div>

                  {/* Owner Responses */}
                  {acceptedNotifs.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-steel-100">
                      <p className="text-[11px] font-black text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {lang === 'fr'
                            ? `${acceptedNotifs.length} propriétaire(s) intéressé(s) !`
                            : `استجاب ${acceptedNotifs.length} مالك آليات لطلبك!`}
                        </span>
                      </p>
                      {acceptedNotifs.map((n) => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 text-xs">
                            <p className="font-black text-ink truncate">
                              {n.matched_machine_title || camp.machine_name}
                            </p>
                            {n.distance_km != null && (
                              <span className="text-[10px] text-emerald-800 font-bold tabular-nums">
                                {lang === 'fr' ? 'À' : 'على بعد'} {Math.round(n.distance_km)}{' '}
                                {lang === 'fr' ? 'km' : 'كم'}
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              navigate(
                                `/entreprise/messages?target=${n.owner_id}&machine=${n.machine_id || ''}`
                              )
                            }
                            leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                            className="shrink-0 text-[11px] min-h-[38px]"
                          >
                            {lang === 'fr' ? 'Discuter' : 'محادثة المالك'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-steel-500 pt-2 border-t border-steel-100">
                      {camp.matched_owners_count > 0
                        ? lang === 'fr'
                          ? 'Alerte envoyée. En attente de réponse des propriétaires...'
                          : 'تم إرسال الإشعار الصوتي للملاك داخل النطاق وفي انتظار تفاعلهم...'
                        : lang === 'fr'
                        ? 'Aucun engin trouvé lors du lancement dans ce rayon.'
                        : 'لم يتم العثور على آليات منشورة داخل هذا القطر وقت الإرسال.'}
                    </p>
                  )}

                  {!isClosed && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await closeDispatchCampaign(camp.id);
                          setCampaigns((prev) =>
                            prev.map((c) => (c.id === camp.id ? { ...c, status: 'closed' } : c))
                          );
                          toast.info(lang === 'fr' ? 'Campagne clôturée' : 'تم إغلاق حملة البحث');
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-steel-500 hover:text-rose-600 transition-colors cursor-pointer py-1 px-2"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Clôturer la campagne' : 'إغلاق الحملة'}</span>
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile-Responsive Bottom-Sheet / Modal for Adding Site */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <Card className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-white border border-steel-200 shadow-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden p-0">
            {/* Sticky Modal Header */}
            <div className="bg-ink text-white px-4 py-3.5 sm:p-5 shrink-0">
              <div className="sm:hidden w-10 h-1 bg-steel-600 rounded-full mx-auto mb-2.5" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <HardHat className="w-5 h-5 text-primary shrink-0" />
                  <h3 className="text-sm sm:text-base font-black text-white truncate">
                    {lang === 'fr' ? 'Nouveau Chantier' : 'إضافة ورش بناء جديد'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-w-[40px] min-h-[40px] -me-1 rounded-xl text-steel-300 hover:text-white hover:bg-steel-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  aria-label={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateSite} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <Input
                  label={lang === 'fr' ? 'Nom du chantier / projet' : 'اسم الورش أو المشروع'}
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder={lang === 'fr' ? 'Ex: Chantier Bouskoura Résidences' : 'مثال: ورش تهيئة مركب بوسكورة'}
                  required
                />

                <div>
                  <label className="text-xs font-bold text-steel-700 block mb-1.5">
                    {lang === 'fr' ? 'Ville du chantier' : 'المدينة'}
                  </label>
                  <select
                    value={cityId}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-steel-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  >
                    {MOROCCAN_CITIES.map((c: MoroccanCity) => (
                      <option key={c.id} value={c.id}>
                        {lang === 'fr' ? c.name_fr : c.name_ar}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Map Location Picker instead of typing address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-steel-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary-dark shrink-0" />
                    <span>
                      {lang === 'fr'
                        ? 'Localiser le chantier sur la carte'
                        : 'تحديد مكان الورش على الخريطة'}
                    </span>
                  </label>
                  <MapLocationPicker
                    lat={lat}
                    lng={lng}
                    cityId={cityId}
                    hideCitySelector={true}
                    showGpsButton={true}
                    mapHeightClass="h-48 sm:h-56"
                    instructionText={
                      lang === 'fr'
                        ? 'Appuyez sur la carte ou déplacez le marqueur sur le chantier'
                        : 'انقر على الخريطة أو اسحب العلامة لتحديد مكان الورش'
                    }
                    onLocationChange={handleMapLocationChange}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={lang === 'fr' ? 'Chef de chantier' : 'رئيس الورش'}
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="هشام العلمي"
                  />
                  <Input
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    label={lang === 'fr' ? 'Téléphone' : 'الهاتف'}
                    value={managerPhone}
                    onChange={(e) => setManagerPhone(e.target.value)}
                    placeholder="+2126..."
                  />
                </div>
              </div>

              {/* Sticky Modal Footer */}
              <div className="shrink-0 p-4 sm:px-6 bg-steel-50 border-t border-steel-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-full sm:w-auto justify-center min-h-[44px]"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                  className="w-full sm:w-auto justify-center min-h-[44px] font-black"
                >
                  {lang === 'fr' ? 'Enregistrer le chantier' : 'حفظ بيانات الورش'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Live InDrive-Style Dispatch Campaign Modal */}
      <DispatchCampaignModal
        isOpen={Boolean(dispatchSite)}
        onClose={() => setDispatchSite(null)}
        site={dispatchSite}
        onCampaignLaunched={(newCampaign) => {
          setCampaigns((prev) => [newCampaign, ...prev]);
        }}
      />
    </div>
  );
};

export default ContractorProjectsPage;
