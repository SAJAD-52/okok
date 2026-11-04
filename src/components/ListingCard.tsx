import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Heart, 
  MapPin, 
  UserCheck, 
  Truck, 
  Fuel, 
  Clock, 
  CheckCircle2, 
  Phone, 
  MessageSquare, 
  FileText,
  Star 
} from 'lucide-react';
import { MachineListing } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getCityById } from '../data/cities';

interface ListingCardProps {
  listing: MachineListing;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
  const { t } = useTranslation();
  const { 
    language, 
    toggleFavorite, 
    isFavorite, 
    setSelectedListing, 
    setQuoteListing 
  } = useAppStore();

  const city = getCityById(listing.cityId);
  const isFav = isFavorite(listing.id);

  const formatPrice = (price: number) => {
    // Format with Latin digits as requested: 1 800 MAD
    const formatted = new Intl.NumberFormat('fr-FR').format(price);
    return `${formatted} MAD`;
  };

  const getPriceUnitText = () => {
    switch (listing.priceUnit) {
      case 'hour':
        return t('card.per_hour');
      case 'day':
        return t('card.per_day');
      case 'week':
        return t('card.per_week');
      case 'month':
        return t('card.per_month');
      case 'total':
      default:
        return t('card.total_sale');
    }
  };

  const openWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = language === 'ar'
      ? `السلام عليكم، أنا مهتم بآلية ${listing.titleAr} المعروضة على منصة JADIJCB (المرجع: ${listing.id})`
      : `Bonjour, je suis intéressé par l'engin ${listing.titleFr} sur JADIJCB (Réf: ${listing.id})`;
    const url = `https://wa.me/${listing.owner.whatsapp}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <article 
      onClick={() => setSelectedListing(listing)}
      className="group bg-white rounded-2xl border border-slate-200/90 shadow-soft hover:shadow-lift transition-all duration-300 flex flex-col overflow-hidden cursor-pointer"
    >
      {/* Top Image & Status Badges */}
      <div className="relative aspect-[16/10] sm:aspect-[16/10] bg-slate-900 overflow-hidden">
        <img
          src={listing.images[0] || 'https://images.unsplash.com/photo-1579275542618-a1dfed5f54ba?auto=format&fit=crop&w=1000&q=80'}
          alt={language === 'ar' ? listing.titleAr : listing.titleFr}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-black/30 pointer-events-none" />

        {/* Transaction Type Tag (Rent / Sale) */}
        <div className="absolute top-3 start-3 flex items-center gap-1.5 z-10">
          <span 
            className={`px-3 py-1 rounded-lg text-xs font-black tracking-wide uppercase shadow-sm ${
              listing.type === 'rent'
                ? 'bg-primary text-ink'
                : 'bg-ink text-primary border border-primary/50'
            }`}
          >
            {listing.type === 'rent' ? t('card.rent') : t('card.sale')}
          </span>

          {listing.owner.isVerified && (
            <span className="bg-emerald-600/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('card.verified')}</span>
            </span>
          )}
        </div>

        {/* Favorite Heart Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(listing.id);
          }}
          className="absolute top-3 end-3 min-w-[40px] min-h-[40px] rounded-full bg-white/90 backdrop-blur-sm hover:bg-white text-slate-700 flex items-center justify-center transition-transform active:scale-90 z-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Add to favorites"
        >
          <Heart 
            className={`w-5 h-5 transition-colors ${
              isFav ? 'fill-danger text-danger' : 'text-slate-600'
            }`} 
          />
        </button>

        {/* Location chip on bottom of image */}
        <div className="absolute bottom-3 start-3 end-3 flex items-center justify-between text-white text-xs z-10">
          <span className="inline-flex items-center gap-1 bg-ink/80 backdrop-blur-md px-2.5 py-1 rounded-lg">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold">
              {city ? (language === 'ar' ? city.nameAr : city.nameFr) : listing.cityId}
            </span>
          </span>

          {listing.hoursWorked && (
            <span className="inline-flex items-center gap-1 bg-ink/80 backdrop-blur-md px-2.5 py-1 rounded-lg font-sans">
              <Clock className="w-3.5 h-3.5 text-slate-300" />
              <span>{listing.hoursWorked.toLocaleString('en-US')} h</span>
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & Model Badge */}
          <div className="flex items-center justify-between text-xs text-slate-muted mb-1.5 font-sans">
            <span className="font-black text-ink uppercase tracking-wider">{listing.brand}</span>
            <span>{t('card.year', { year: listing.year })}</span>
          </div>

          {/* Title */}
          <h3 className="text-base sm:text-lg font-bold text-ink leading-tight line-clamp-2 group-hover:text-primary-dark transition-colors mb-3">
            {language === 'ar' ? listing.titleAr : listing.titleFr}
          </h3>

          {/* Key Feature Badges */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
              listing.withOperator ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-600'
            }`}>
              <UserCheck className="w-3 h-3 text-amber-600" />
              <span>{listing.withOperator ? t('card.with_operator') : t('card.no_operator')}</span>
            </span>

            {listing.deliveryAvailable && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Truck className="w-3 h-3 text-emerald-600" />
                <span>{t('card.delivery_included')}</span>
              </span>
            )}

            {listing.fuelIncluded && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                <Fuel className="w-3 h-3 text-blue-600" />
                <span>{t('card.fuel_included')}</span>
              </span>
            )}
          </div>
        </div>

        {/* Pricing & Actions */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className="text-xl sm:text-2xl font-black text-ink font-sans tracking-tight">
                {formatPrice(listing.price)}
              </span>
              <span className="text-xs text-slate-muted ms-1.5 font-medium">
                {getPriceUnitText()}
              </span>
            </div>
            {listing.depositMAD ? (
              <span className="text-[11px] text-slate-400 font-sans">
                {language === 'ar' ? `ضمان: ${listing.depositMAD} MAD` : `Caution: ${listing.depositMAD} MAD`}
              </span>
            ) : null}
          </div>

          {/* Action CTAs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setQuoteListing(listing);
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-ink text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <FileText className="w-4 h-4 stroke-[2.5]" />
              <span>{t('card.request_quote')}</span>
            </button>

            <button
              type="button"
              onClick={openWhatsApp}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t('card.contact_whatsapp')}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
