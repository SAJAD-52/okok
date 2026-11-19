import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, Truck } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

export const StickyMobileCta: React.FC = () => {
  const { lang } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
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
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="md:hidden fixed bottom-0 start-0 end-0 z-40 bg-ink/95 backdrop-blur-md border-t border-slate-700/90 px-3 py-2 shadow-2xl"
        >
          <div className="flex items-center gap-2 max-w-md mx-auto">
            {/* Primary Action: Register / Owner Trial */}
            <Link
              to="/auth?mode=signup"
              className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-ink font-black text-xs flex items-center justify-center gap-1.5 shadow-sm truncate"
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {lang === 'fr' ? 'Inscrire mes engins' : 'سجل فـ 30 ثانية'}
              </span>
            </Link>

            {/* Secondary Action: Marketplace / Radar */}
            <Link
              to="/marketplace"
              className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white border border-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 truncate"
            >
              <Compass className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">
                {lang === 'fr' ? 'Trouver un engin' : 'تصفح الآليات'}
              </span>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StickyMobileCta;
