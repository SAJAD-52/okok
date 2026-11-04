import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, Sparkles } from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const FinalCtaBand: React.FC = () => {
  const { lang } = useLanguage();

  return (
    <section className="relative bg-ink text-white py-16 sm:py-24 border-b border-steel-800 overflow-hidden">
      {/* Background Grid Pattern & Central Ambient Glow */}
      <div className="absolute inset-0 bg-industrial-grid opacity-25 pointer-events-none" />
      <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/20 rounded-full blur-[130px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          {/* Subtle Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-steel-900 border border-steel-700 text-xs font-semibold text-primary mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>
              {lang === 'fr'
                ? 'Activez votre flotte dès aujourd\'hui'
                : 'انضم لمئات المقاولين وأصحاب المعدات بالمغرب'}
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight max-w-3xl mb-4">
            {lang === 'fr'
              ? 'Prêt à maximiser le rendement de vos engins de chantier ?'
              : 'جاهز لمضاعفة تشغيل آلياتك وزيادة مداخيلك الشهرية؟'}
          </h2>

          {/* Subheading */}
          <p className="text-sm sm:text-base text-steel-300 max-w-xl mx-auto leading-relaxed mb-8">
            {lang === 'fr'
              ? 'Rejoignez le réseau professionnel JADIJCB en 30 secondes. 3 jours d\'essai gratuit sans engagement, sans carte bancaire.'
              : 'ابدأ تجربتك المجانية لمدة 3 أيام كاملة بدون بطاقة بنكية. استقبل أولى طلبات الكراء وضع أسطولك أمام كبرى مقاولات المغرب.'}
          </p>

          {/* Dual CTA */}
          <div className="w-full max-w-md mx-auto">
            <DualCtaRow centered={true} />
          </div>

          {/* Direct WhatsApp Assistance Line */}
          <div className="mt-8 pt-8 border-t border-steel-800/80 flex flex-wrap items-center justify-center gap-6 text-xs text-steel-400">
            <a
              href="https://wa.me/212661889900"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-emerald-400 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'fr' ? 'WhatsApp Direct : +212 6 61 88 99 00' : 'واتساب الدعم الفني: 00 99 88 661 (212+)'}</span>
            </a>
            <span>·</span>
            <div className="inline-flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              <span dir="ltr" className="font-mono latin-nums">+212 (0) 522 98 44 20</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCtaBand;
