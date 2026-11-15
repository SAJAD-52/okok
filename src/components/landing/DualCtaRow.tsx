import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Compass, Truck } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface DualCtaRowProps {
  className?: string;
  centered?: boolean;
}

export const DualCtaRow: React.FC<DualCtaRowProps> = ({
  className = '',
  centered = true,
}) => {
  const { lang, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 ${
        centered ? 'justify-center' : 'justify-start'
      } ${className}`}
    >
      {/* Primary CTA: Machinery Owners & Spare Parts Suppliers */}
      <Link
        to="/auth?mode=signup"
        className="w-full sm:w-auto min-h-[48px] px-5 sm:px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-ink font-extrabold text-sm sm:text-base shadow-sm hover:shadow-yellow-glow transition-all flex items-center justify-center gap-2 cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Truck className="w-4 h-4 text-ink shrink-0" />
        <span className="truncate">
          {lang === 'fr' ? 'Inscrire mes engins (3j gratuits)' : 'سجّل آلياتك الآن (3 أيام مجاناً)'}
        </span>
        <ArrowIcon className="w-4 h-4 shrink-0" />
      </Link>

      {/* Secondary CTA: Site Owners / Contractors (Radar & Marketplace) */}
      <Link
        to="/marketplace"
        className="w-full sm:w-auto min-h-[48px] px-5 sm:px-6 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] active:scale-[0.98] text-white border border-slate-600 font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Compass className="w-4 h-4 text-primary shrink-0" />
        <span className="truncate">
          {lang === 'fr' ? 'Trouver un engin / Pièces' : 'أبحث عن آلية أو قطع غيار'}
        </span>
      </Link>
    </div>
  );
};

export default DualCtaRow;
