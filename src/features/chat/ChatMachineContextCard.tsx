import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ExternalLink, MapPin, Tag } from 'lucide-react';
import { Machine } from '../../types/database';
import { useLanguage } from '../../hooks/useLanguage';

interface ChatMachineContextCardProps {
  machine: Machine | null | undefined;
}

export const ChatMachineContextCard: React.FC<ChatMachineContextCardProps> = ({
  machine,
}) => {
  const { t, lang, isRTL } = useLanguage();
  const navigate = useNavigate();

  if (!machine) return null;

  const title = lang === 'fr' ? machine.title_fr : machine.title_ar;
  const isRent = machine.listing_mode !== 'sale';
  const imgUrl =
    machine.images?.[0] ||
    'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=400&q=80';

  return (
    <div className="p-3 bg-amber-50/70 border-b border-primary/30 flex items-center justify-between gap-3 text-start shrink-0 backdrop-blur-sm">
      <div className="flex items-center gap-3 min-w-0">
        <img
          src={imgUrl}
          alt={title}
          className="w-12 h-12 rounded-xl object-cover border border-amber-200 shrink-0 bg-white"
        />

        <div className="min-w-0">
          <span className="text-[10px] text-amber-800 font-extrabold block uppercase tracking-wider">
            {t('chat.machine_context_title')}
          </span>
          <h4 className="text-xs font-black text-ink truncate">
            {title}
          </h4>
          <div className="flex items-center gap-2 text-[11px] text-steel-600 font-mono">
            <span className="font-black text-primary-dark">
              {isRent
                ? `${machine.rate_daily?.toLocaleString('fr-FR')} MAD/j`
                : `${machine.sale_price?.toLocaleString('fr-FR')} MAD`}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 font-sans">
              <MapPin className="w-3 h-3 text-steel-400" />
              {machine.city || 'Maroc'}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/marketplace/${machine.id}`)}
        className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs font-bold text-ink hover:bg-amber-100 transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-sm"
      >
        <span>{lang === 'fr' ? 'Fiche' : 'تفاصيل الآلية'}</span>
        <ExternalLink className="w-3.5 h-3.5 text-primary-dark" />
      </button>
    </div>
  );
};

export default ChatMachineContextCard;
