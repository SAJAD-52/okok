import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, PlusCircle, CheckCircle2 } from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const HowItWorksSection: React.FC = () => {
  const { lang } = useLanguage();

  const steps = [
    {
      num: '01',
      titleAr: 'سجل في 30 ثانية برقم واتسابك',
      titleFr: 'Inscrivez-vous en 30s avec votre WhatsApp',
      descAr: 'بدون إجراءات معقدة ولا حاجة لبريد إلكتروني أو بطاقة بنكية. تبدأ تجربتك المجانية لمدة 3 أيام فوراً.',
      descFr: 'Sans paperasse ni carte bancaire. Votre essai gratuit de 72h démarre immédiatement avec votre numéro marocain.',
      icon: MessageCircle,
    },
    {
      num: '02',
      titleAr: 'أضف آلياتك وحدد أسعارك وشروطك',
      titleFr: 'Ajoutez vos engins, tarifs et conditions',
      descAr: 'صور الآلية، المدينة، السعر بالساعة أو اليوم، وتوفر السائق المعتمد والتوصيل إلى الورش بـ Porte-Char.',
      descFr: 'Téléchargez les photos, fixez le tarif journalier ou horaire, l\'option chauffeur et la livraison par porte-char.',
      icon: PlusCircle,
    },
    {
      num: '03',
      titleAr: 'استقبل طلبات الكراء وابدأ الربح',
      titleFr: 'Recevez des demandes qualifiées & encaissez',
      descAr: 'يتواصل معك المقاولون مباشرة عبر واتساب والموقع مع عقود رقمية موثقة تضمن حقوقك كاملة.',
      descFr: 'Les entreprises vous contactent directement. Validez la réservation et sécurisez votre contrat de location.',
      icon: CheckCircle2,
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-surface border-b border-steel-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-dark bg-primary-100 px-3 py-1 rounded-full">
            {lang === 'fr' ? 'Démarrage rapide' : 'ثلاث خطوات بسيطة'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3 leading-tight">
            {lang === 'fr'
              ? 'Comment commencer à rentabiliser vos engins en 3 étapes ?'
              : 'كيف تبدأ في تشغيل أسطولك وتحقيق أرباح مستمرة؟'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Le processus le plus simple et rapide au Maroc pour les professionnels du BTP.'
              : 'أبسط وأسرع مسار رقمي للمقاولين وأصحاب المعدات الثقيلة في المغرب.'}
          </p>
        </div>

        {/* 3 Steps with Connecting Line */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-6">
          {/* Subtle Horizontal Desktop Connecting Line */}
          <div className="hidden md:block absolute top-1/3 start-1/6 end-1/6 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent z-0 pointer-events-none" />

          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="relative z-10 p-6 sm:p-8 rounded-2xl bg-white border border-steel-200/90 shadow-soft text-start flex flex-col justify-between"
              >
                <div>
                  {/* Step Number + Icon Badge */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-primary text-ink flex items-center justify-center font-bold shadow-sm">
                      <Icon className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <span className="text-3xl font-black font-sans latin-nums text-steel-300">
                      {s.num}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-ink mb-2">
                    {lang === 'fr' ? s.titleFr : s.titleAr}
                  </h3>
                  <p className="text-xs sm:text-sm text-steel-600 leading-relaxed">
                    {lang === 'fr' ? s.descFr : s.descAr}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Section Ending Dual CTA */}
        <DualCtaRow centered={true} className="mt-14" />
      </div>
    </section>
  );
};

export default HowItWorksSection;
