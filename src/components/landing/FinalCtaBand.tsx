import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Phone } from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const FinalCtaBand: React.FC = () => {
  const { lang } = useLanguage();

  return (
    <section className="relative bg-ink text-white py-14 sm:py-20 lg:py-24 border-b border-slate-800 overflow-hidden">
      {/* Background Grid Pattern & Central Ambient Glow */}
      <div className="absolute inset-0 bg-industrial-grid opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[640px] h-[280px] bg-primary/20 rounded-full blur-[130px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="flex flex-col items-center"
        >
          {/* Clean Unboxed Kicker */}
          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-primary mb-4">
            {lang === 'fr'
              ? 'Rejoignez le réseau national BTP au Maroc'
              : 'انضم لشبكة الأوراش وملاك الآليات بالمغرب'}
          </span>

          {/* Heading */}
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight max-w-3xl mb-4 text-balance">
            {lang === 'fr'
              ? 'Prêt à lancer votre chantier ou rentabiliser vos engins dès aujourd’hui ?'
              : 'جاهز تشغّل أسطولك ولا تلقى أقرب آلية لورشك في ثواني؟'}
          </h2>

          {/* Subheading */}
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl mx-auto leading-relaxed mb-6">
            {lang === 'fr'
              ? 'Inscription en 30 secondes avec votre numéro marocain. Gratuit pour les chantiers, 3 jours d’essai gratuit pour les propriétaires.'
              : 'تسجيل فـ 30 ثانية غير بنمرة التليفون. مجاني لأصحاب الأوراش، و3 أيام تجربة مجانية لملاك الآليات وقطع الغيار.'}
          </p>

          {/* Dual CTA */}
          <div className="w-full max-w-2xl mx-auto">
            <DualCtaRow centered={true} />
          </div>

          {/* Direct WhatsApp Assistance Line */}
          <div className="mt-8 pt-8 border-t border-slate-800 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-300">
            <a
              href="https://wa.me/212661889900"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-emerald-400 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {lang === 'fr'
                  ? 'WhatsApp Direct : +212 6 61 88 99 00'
                  : 'واتساب الدعم الفني: 00 99 88 661 (212+)'}
              </span>
            </a>
            <span className="hidden sm:inline text-slate-600" aria-hidden="true">·</span>
            <div className="inline-flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary shrink-0" />
              <span dir="ltr" className="font-mono latin-nums">
                +212 (0) 522 98 44 20
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCtaBand;
