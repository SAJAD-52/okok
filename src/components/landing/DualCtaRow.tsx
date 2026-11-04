import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
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
      className={`flex flex-col sm:flex-row items-center gap-3 pt-6 ${
        centered ? 'justify-center text-center' : 'justify-start text-start'
      } ${className}`}
    >
      {/* Primary CTA: 3 Days Free Trial */}
      <Link
        to="/auth?mode=signup"
        className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-ink font-extrabold text-sm sm:text-base shadow-sm hover:shadow-yellow-glow transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Sparkles className="w-4 h-4 text-ink shrink-0" />
        <span>{lang === 'fr' ? 'Essai gratuit de 3 jours' : 'جرب مجاناً لمدة 3 أيام'}</span>
        <ArrowIcon className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
      </Link>

      {/* Secondary CTA: Start with WhatsApp */}
      <Link
        to="/auth?mode=signup"
        className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl bg-steel-900/90 hover:bg-steel-800 active:scale-[0.98] text-white border border-steel-700/80 font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{lang === 'fr' ? 'Commencer avec WhatsApp' : 'ابدأ الآن برقم واتسابك'}</span>
      </Link>
    </div>
  );
};

export default DualCtaRow;
