// ============================================================================
// JADIJCB: Marketplace Machine Card Component
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ShieldCheck,
  Truck,
  Fuel,
  UserCheck,
  Star,
  Check,
  CalendarCheck,
  MessageCircle,
  MessageSquare,
} from 'lucide-react';
import { Machine } from '../../types/database';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useLanguage } from '../../hooks/useLanguage';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../hooks/useAuth';
import { formatPriceMAD } from '../../data/rentalTerms';

interface MachineCardProps {
  machine: Machine;
  onBookClick?: (machine: Machine) => void;
}

export const MachineCard: React.FC<MachineCardProps> = ({ machine, onBookClick }) => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user, profile } = useAuth();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images = machine.images?.length
    ? machine.images
    : ['https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&q=80'];

  const isFav = isFavorite(machine.id);

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const title = lang === 'fr' ? machine.title_fr : machine.title_ar;
    toggleFavorite(machine.id, title);
  };

  const title = lang === 'fr' ? machine.title_fr : machine.title_ar;
  const isRent = machine.listing_mode !== 'sale';

  // Check if current user is the owner of this machine (cannot book own machines)
  const currentUserId = user?.id || profile?.id;
  const isOwnMachine = Boolean(
    currentUserId &&
    machine.owner_id &&
    (machine.owner_id === currentUserId || (profile && machine.owner_id === profile.id))
  );

  // WhatsApp prefilled message & link
  const ownerPhone = (
    machine.owner?.phone ||
    (machine as any).phone ||
    '212661234567'
  ).replace(/\D/g, '');

  const machineTitle = (lang === 'fr' ? machine.title_fr : machine.title_ar) || `${machine.brand} ${machine.model}`;
  const whatsappMsg = encodeURIComponent(
    lang === 'fr'
      ? `Bonjour, je souhaite réserver l'engin "${machineTitle}" (${machine.city || 'Maroc'}) proposé à ${machine.rate_daily?.toLocaleString('fr-FR')} MAD/jour sur JADIJCB.\nLien: ${typeof window !== 'undefined' ? window.location.origin : ''}/marketplace/${machine.id}`
      : `السلام عليكم، أرغب في حجز الآلية "${machineTitle}" (${machine.city || 'المغرب'}) المعروضة بسعر ${machine.rate_daily?.toLocaleString('fr-FR')} د.م/يوم على منصة JADIJCB.\nالرابط: ${typeof window !== 'undefined' ? window.location.origin : ''}/marketplace/${machine.id}`
  );
  const whatsappLink = `https://wa.me/${ownerPhone}?text=${whatsappMsg}`;

  const handleBookingClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onBookClick) {
      onBookClick(machine);
    } else {
      navigate(`/marketplace/${machine.id}?book=true`);
    }
  };

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const isContractor = profile?.role === 'contractor' || profile?.role === 'client';
    const basePath = isContractor ? '/entreprise/messages' : '/owner/messages';
    navigate(`${basePath}?machine_id=${machine.id}&target_user=${machine.owner_id || ''}`);
  };

  return (
    <Card
      onClick={() => navigate(`/marketplace/${machine.id}`)}
      className="group overflow-hidden border border-steel-200 hover:border-primary/60 hover:shadow-elevated transition-all duration-300 flex flex-col justify-between cursor-pointer rounded-2xl bg-white"
    >
      <div>
        {/* Image Carousel Container */}
        <div className="relative aspect-[16/10] overflow-hidden bg-steel-100 select-none">
          <img
            src={images[currentImageIndex]}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />

          {/* Mode Badge (Top Start) */}
          <div className="absolute top-3 start-3 z-10">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-black shadow-md ${
                isRent
                  ? 'bg-primary text-ink'
                  : 'bg-ink text-white'
              }`}
            >
              {isRent
                ? lang === 'fr'
                  ? 'Location'
                  : 'للكراء'
                : lang === 'fr'
                ? 'À vendre'
                : 'للبيع'}
            </span>
          </div>

          {/* Favorite Button (Top End) */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            className={`absolute top-3 end-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer ${
              isFav
                ? 'bg-red-500 text-white'
                : 'bg-white/90 text-steel-700 hover:bg-white hover:text-red-500 backdrop-blur-sm'
            }`}
            aria-label="Ajouter aux favoris"
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </button>

          {/* Carousel Arrows (only if multiple images) */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevImage}
                className="absolute inset-y-0 start-2 my-auto w-7 h-7 rounded-full bg-white/80 hover:bg-white text-ink flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 shadow-md z-10 cursor-pointer"
                aria-label="Image précédente"
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleNextImage}
                className="absolute inset-y-0 end-2 my-auto w-7 h-7 rounded-full bg-white/80 hover:bg-white text-ink flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 shadow-md z-10 cursor-pointer"
                aria-label="Image suivante"
              >
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {/* Dot Indicators */}
              <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1 z-10">
                {images.slice(0, 5).map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      currentImageIndex === idx
                        ? 'w-4 bg-primary'
                        : 'w-1.5 bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Card Body Details */}
        <div className="p-4 space-y-2 text-start">
          {/* Brand & City Row */}
          <div className="flex items-center justify-between text-xs text-steel-500">
            <span className="font-extrabold uppercase tracking-wider text-primary-dark">
              {machine.brand} · {machine.year}
            </span>
            <span className="flex items-center gap-1 font-bold text-steel-600">
              <MapPin className="w-3.5 h-3.5 text-steel-400 shrink-0" />
              <span>{machine.city || 'Casablanca'}</span>
            </span>
          </div>

          {/* Title */}
          <h3 className="font-black text-sm text-ink line-clamp-1 group-hover:text-primary-dark transition-colors">
            {title}
          </h3>

          {/* Equipment Highlights / Features */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-steel-600 pt-1">
            {machine.with_operator && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                {lang === 'fr' ? 'Chauffeur inclus' : 'مع سائق'}
              </span>
            )}
            {machine.fuel_included && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold border border-amber-200">
                {lang === 'fr' ? 'Carburant inclus' : 'المازوت مشمول'}
              </span>
            )}
            {machine.delivery_available && (
              <span className="px-2 py-0.5 rounded-md bg-steel-100 text-steel-700 font-medium">
                {lang === 'fr' ? 'Livraison sur site' : 'توصيل متوفر'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer: Owner Trust Badge & Price */}
      <div className="p-4 pt-3 border-t border-steel-100 flex items-center justify-between gap-3 text-start">
        {/* Owner Trust Badge */}
        <div className="flex items-center gap-1.5 text-[11px] text-steel-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold truncate max-w-[130px]">
            {machine.owner?.company_name || 'Loueur Vérifié ICE'}
          </span>
        </div>

        {/* Formatted Price */}
        <div className="text-end shrink-0">
          <div className="font-mono font-black text-base text-ink leading-tight">
            {isRent ? (
              <span>
                {machine.rate_daily?.toLocaleString('fr-FR')}{' '}
                <span className="text-xs font-bold text-steel-500">
                  {t('common.mad')} / {lang === 'fr' ? 'j' : 'يوم'}
                </span>
              </span>
            ) : (
              <span>
                {machine.sale_price?.toLocaleString('fr-FR')}{' '}
                <span className="text-xs font-bold text-steel-500">
                  {t('common.mad')}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Area: Booking Button for Contractors/Brokers OR Own Machine Badge */}
      <div className="px-4 pb-4 pt-0">
        {isOwnMachine ? (
          <div className="w-full py-2 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              {lang === 'fr'
                ? 'Votre propre engin (Vous êtes le propriétaire)'
                : 'آليتك الخاصة (أنت المالك)'}
            </span>
          </div>
        ) : isRent ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleBookingClick}
              className="flex-1 py-2 px-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.99] text-ink text-xs font-black shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-ink shrink-0" />
              <span className="truncate">{lang === 'fr' ? 'Réserver' : 'طلب حجز'}</span>
            </button>

            <button
              type="button"
              onClick={handleChatClick}
              title={lang === 'fr' ? 'Discussion instantanée dans la plateforme' : 'محادثة فورية داخل المنصة'}
              className="py-2 px-2.5 rounded-xl bg-steel-900 hover:bg-black active:scale-[0.99] text-primary text-xs font-black shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline font-bold">{lang === 'fr' ? 'Chat' : 'محادثة'}</span>
            </button>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={lang === 'fr' ? 'Contacter sur WhatsApp' : 'تواصل عبر واتساب'}
              className="py-2 px-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.99] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="hidden sm:inline font-bold">{lang === 'fr' ? 'WhatsApp' : 'واتساب'}</span>
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                navigate(`/marketplace/${machine.id}`);
              }}
              className="flex-1 py-2 px-2.5 rounded-xl bg-ink hover:bg-black text-primary text-xs font-black shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
            >
              <Truck className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{lang === 'fr' ? 'Détails & Achat' : 'معاينة الشراء'}</span>
            </button>

            <button
              type="button"
              onClick={handleChatClick}
              title={lang === 'fr' ? 'Discussion instantanée dans la plateforme' : 'محادثة فورية داخل المنصة'}
              className="py-2 px-2.5 rounded-xl bg-steel-100 hover:bg-steel-200 active:scale-[0.99] text-ink text-xs font-black shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5 text-steel-700 shrink-0" />
              <span className="hidden sm:inline font-bold">{lang === 'fr' ? 'Chat' : 'محادثة'}</span>
            </button>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={lang === 'fr' ? 'Contacter sur WhatsApp' : 'تواصل عبر واتساب'}
              className="py-2 px-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="hidden sm:inline font-bold">{lang === 'fr' ? 'WhatsApp' : 'واتساب'}</span>
            </a>
          </div>
        )}
      </div>
    </Card>
  );
};

export default MachineCard;
