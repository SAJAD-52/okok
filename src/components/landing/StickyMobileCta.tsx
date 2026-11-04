import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, MessageCircle } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

export const StickyMobileCta: React.FC = () => {
  const { lang } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show when scrolled past 480px (past hero)
      if (window.scrollY > 480) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="md:hidden fixed bottom-0 start-0 end-0 z-40 bg-ink/95 backdrop-blur-md border-t border-steel-700/80 px-4 py-2.5 shadow-2xl safe-area-pb"
        >
          <div className="flex items-center gap-2 max-w-md mx-auto">
            {/* Primary Action Button */}
            <Link
              to="/auth?mode=signup"
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-ink font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm truncate"
            >
              <Sparkles className="w-4 h-4 shrink-0 fill-ink" />
              <span className="truncate">
                {lang === 'fr' ? 'Essai gratuit 3 jours' : 'جرب مجاناً لمدة 3 أيام'}
              </span>
            </Link>

            {/* WhatsApp Direct Action Button */}
            <Link
              to="/auth?mode=signup"
              className="min-h-[44px] min-w-[44px] px-3 py-2.5 rounded-xl bg-steel-800 hover:bg-steel-700 active:scale-[0.98] text-white border border-steel-600 flex items-center justify-center shrink-0"
              aria-label={lang === 'fr' ? 'Commencer avec WhatsApp' : 'ابدأ الآن برقم واتسابك'}
            >
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StickyMobileCta;
