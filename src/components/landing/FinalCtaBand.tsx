import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';
import { platformSettingsStore } from '../../lib/platformSettings';

export const FinalCtaBand: React.FC = () => {
  const { lang } = useLanguage();
  const [waNumber, setWaNumber] = useState<string>(() => platformSettingsStore.getSettings().whatsapp_number || '');

  useEffect(() => {
    const sync = () => setWaNumber(platformSettingsStore.getSettings().whatsapp_number || '');
    window.addEventListener('jadijcb_settings_updated', sync);
    platformSettingsStore.pullFromRemote().then((s) => setWaNumber(s.whatsapp_number || ''));
    return () => window.removeEventListener('jadijcb_settings_updated', sync);
  }, []);

  const cleanWa = waNumber.replace(/\D/g, '');

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

          {/* Direct WhatsApp Assistance Line (only rendered when configured by admin) */}
          {cleanWa.length >= 9 && (
            <div className="mt-8 pt-8 border-t border-slate-800 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-300">
              <a
                href={`https://wa.me/${cleanWa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-emerald-400 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span dir="ltr" className="font-mono latin-nums">
                  WhatsApp : {waNumber}
                </span>
              </a>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCtaBand;
