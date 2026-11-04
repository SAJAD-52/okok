import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  MapPin, 
  UserCheck, 
  Truck, 
  Fuel, 
  Clock, 
  ShieldCheck, 
  Phone, 
  MessageSquare, 
  Calculator, 
  Calendar, 
  FileText,
  Star,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getCityById } from '../data/cities';

export const ListingDetailModal: React.FC = () => {
  const { t } = useTranslation();
  const { 
    language, 
    selectedListing, 
    setSelectedListing, 
    setQuoteListing 
  } = useAppStore();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [rentalDays, setRentalDays] = useState(3);
  const [includeDriver, setIncludeDriver] = useState(true);
  const [includeFuel, setIncludeFuel] = useState(false);

  if (!selectedListing) return null;

  const city = getCityById(selectedListing.cityId);
  const isRent = selectedListing.type === 'rent';

  // Calculator logic
  const baseDayPrice = selectedListing.price;
  const driverCostPerDay = 400; // MAD / day
  const fuelCostPerDay = 350; // MAD / day
  
  const calculatedTotal = (
    baseDayPrice * rentalDays +
    (includeDriver && isRent ? driverCostPerDay * rentalDays : 0) +
    (includeFuel && isRent ? fuelCostPerDay * rentalDays : 0)
  );

  const formatPrice = (price: number) => {
    return `${new Intl.NumberFormat('fr-FR').format(price)} MAD`;
  };

  const openWhatsApp = () => {
    const text = language === 'ar'
      ? `السلام عليكم، استفسار حول الآلية ${selectedListing.titleAr} على JADIJCB (رقم المرجع: ${selectedListing.id})`
      : `Bonjour, demande d'informations pour ${selectedListing.titleFr} sur JADIJCB (Réf: ${selectedListing.id})`;
    window.open(`https://wa.me/${selectedListing.owner.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-ink/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-ink text-white border-b border-steel/60">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase ${
              isRent ? 'bg-primary text-ink' : 'bg-white text-ink'
            }`}>
              {isRent ? t('card.rent') : t('card.sale')}
            </span>
            <span className="text-xs text-slate-300 font-sans">
              REF: {selectedListing.id.toUpperCase()}
            </span>
          </div>

          <button
            onClick={() => setSelectedListing(null)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-steel/60 hover:bg-steel text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Main Title & City */}
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-muted mb-1 font-sans">
              <span className="font-bold text-ink uppercase">{selectedListing.brand}</span>
              <span>•</span>
              <span>{t('card.year', { year: selectedListing.year })}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                {city ? (language === 'ar' ? city.nameAr : city.nameFr) : selectedListing.cityId}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-ink leading-tight">
              {language === 'ar' ? selectedListing.titleAr : selectedListing.titleFr}
            </h2>
          </div>

          {/* Image Showcase */}
          <div className="space-y-2">
            <div className="relative aspect-[16/9] bg-slate-900 rounded-2xl overflow-hidden shadow-inner">
              <img
                src={selectedListing.images[activeImageIndex] || selectedListing.images[0]}
                alt="Machinery photo"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 end-3 bg-ink/80 text-white text-xs px-2.5 py-1 rounded-lg backdrop-blur-md font-sans">
                {activeImageIndex + 1} / {selectedListing.images.length}
              </div>
            </div>

            {selectedListing.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedListing.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-20 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                      activeImageIndex === idx ? 'border-primary ring-2 ring-primary/40' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pricing & Quick Highlights */}
          <div className="p-4 rounded-2xl bg-surface border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-muted block font-medium">
                {isRent ? (language === 'ar' ? 'سعر الكراء الصافي' : 'Tarif de location') : (language === 'ar' ? 'سعر البيع المقترح' : 'Prix de vente')}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-ink font-sans">
                  {formatPrice(selectedListing.price)}
                </span>
                <span className="text-xs text-slate-muted">
                  / {selectedListing.priceUnit === 'day' ? t('card.per_day') : selectedListing.priceUnit}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedListing(null);
                  setQuoteListing(selectedListing);
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-ink font-bold text-sm shadow-md flex items-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <FileText className="w-4 h-4 stroke-[2.5]" />
                <span>{t('card.request_quote')}</span>
              </button>

              <button
                type="button"
                onClick={openWhatsApp}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-sm flex items-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t('card.contact_whatsapp')}</span>
              </button>
            </div>
          </div>

          {/* Technical Specifications Grid */}
          <div>
            <h3 className="text-base sm:text-lg font-bold text-ink mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded bg-primary" />
              <span>{t('details.technical_specs')}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-muted block">{t('details.brand')}</span>
                <span className="text-sm font-black text-ink font-sans">{selectedListing.brand}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-muted block">{t('details.model')}</span>
                <span className="text-sm font-black text-ink font-sans">{selectedListing.model}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-muted block">{t('details.year')}</span>
                <span className="text-sm font-black text-ink font-sans">{selectedListing.year}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-muted block">{t('details.condition')}</span>
                <span className="text-sm font-bold text-ink">
                  {selectedListing.condition === 'new' ? t('details.condition_new') : t('details.condition_excellent')}
                </span>
              </div>
              {selectedListing.hoursWorked && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-muted block">{t('details.hours')}</span>
                  <span className="text-sm font-black text-ink font-sans">{selectedListing.hoursWorked.toLocaleString('en-US')} h</span>
                </div>
              )}
              {selectedListing.weightTons && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-muted block">{t('details.tonnage')}</span>
                  <span className="text-sm font-black text-ink font-sans">{selectedListing.weightTons} T</span>
                </div>
              )}
              {selectedListing.powerHp && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-muted block">{t('details.power')}</span>
                  <span className="text-sm font-black text-ink font-sans">{selectedListing.powerHp} HP</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-base sm:text-lg font-bold text-ink mb-2">
              {t('details.overview')}
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
              {language === 'ar' ? selectedListing.descriptionAr : selectedListing.descriptionFr}
            </p>
          </div>

          {/* Cost Estimator (Interactive Calculation) */}
          {isRent && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-5 h-5 text-amber-700" />
                <h3 className="text-base font-bold text-amber-900">
                  {t('details.calculate_cost')}
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-amber-900 mb-1">
                    <span>{t('details.rental_days')}</span>
                    <span className="font-sans text-sm">{rentalDays} {language === 'ar' ? 'أيام' : 'jours'}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={rentalDays}
                    onChange={(e) => setRentalDays(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeDriver}
                      onChange={(e) => setIncludeDriver(e.target.checked)}
                      className="rounded accent-primary w-4 h-4"
                    />
                    <span>{t('details.need_operator')}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeFuel}
                      onChange={(e) => setIncludeFuel(e.target.checked)}
                      className="rounded accent-primary w-4 h-4"
                    />
                    <span>{t('details.need_fuel')} (+350 MAD/j)</span>
                  </label>
                </div>

                <div className="pt-3 border-t border-amber-200/80 flex items-center justify-between">
                  <span className="text-sm font-bold text-amber-950">
                    {t('details.estimated_total')}:
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-ink font-sans">
                    {formatPrice(calculatedTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Owner Info & Assurance */}
          <div className="p-4 rounded-2xl bg-surface border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-ink text-primary font-black flex items-center justify-center text-lg shadow-sm">
                {selectedListing.owner.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-extrabold text-ink">
                    {selectedListing.owner.companyName}
                  </h4>
                  {selectedListing.owner.isVerified && (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-muted mt-0.5">
                  <span className="flex items-center gap-1 text-amber-500 font-bold font-sans">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {selectedListing.owner.rating}
                  </span>
                  <span>({selectedListing.owner.reviewsCount} {language === 'ar' ? 'تقييم موثق' : 'avis'})</span>
                  <span>•</span>
                  <span>{t('details.response_time')}</span>
                </div>
              </div>
            </div>

            <a
              href={`tel:${selectedListing.owner.phone}`}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-steel hover:bg-steel-light text-white text-xs font-bold flex items-center gap-2 transition-colors self-stretch sm:self-auto justify-center"
            >
              <Phone className="w-4 h-4 text-primary" />
              <span dir="ltr">{selectedListing.owner.phone}</span>
            </a>
          </div>

          {/* Safety Guarantee Banner */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <span className="font-bold block mb-0.5">{t('details.safety_guarantee')}</span>
              {t('details.safety_guarantee_desc')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
