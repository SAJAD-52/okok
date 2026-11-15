import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const FaqSection: React.FC = () => {
  const { lang } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      qAr: 'هل استخدام المنصة ورادار الأوراش مجاني لأصحاب الأوراش والمقاولات؟',
      qFr: 'L’accès au Radar et à la recherche d’engins est-il gratuit pour les chantiers ?',
      aAr: 'نعم، مجاني 100% لأصحاب الأوراش والمقاولات! يمكنك التسجيل في 30 ثانية، تصفح الخريطة، إرسال طلبات عاجلة للملاك القريبين، وشراء قطع الغيار أو التواصل المباشر عبر واتساب بدون أي رسوم أو عمولة.',
      aFr: 'Oui, c’est 100% gratuit pour les chefs de chantier et entreprises BTP ! Inscrivez-vous en 30 secondes, consultez le Radar GPS, diffusez des demandes urgentes et contactez les propriétaires sans commission.',
    },
    {
      qAr: 'كيف يعمل التجريب المجاني لمدة 3 أيام (72 ساعة) لملاك الآليات؟',
      qFr: 'Comment fonctionne l’essai gratuit de 3 jours (72h) pour les propriétaires ?',
      aAr: 'بمجرد تسجيل حسابك برقم هاتفك أو واتسابك في 30 ثانية، يُفعّل حسابك فوراً بكافة الصلاحيات: أضف آلياتك، جرب المؤقت الزمني، استقبل تنبيهات الأوراش القريبة، وشارك متجر شركتك بدون بطاقة بنكية.',
      aFr: 'Dès votre inscription avec votre numéro marocain en 30s, votre accès complet est activé sans carte bancaire : publiez vos engins, recevez les alertes radar, testez le compte à rebours et partagez votre vitrine pendant 72 heures.',
    },
    {
      qAr: 'كيف يتم تسديد الاشتراك لملاك الآليات بعد نهاية التجربة المجانية؟',
      qFr: 'Comment s’effectue le règlement de l’abonnement (RIB / Wafacash) ?',
      aAr: 'نوفر طرق سداد محلية وسهلة: يمكنك القيام بتحويل بنكي (Virement RIB) أو التوجه لأقرب وكالة وفاكاش، ثم رفع صورة الوصل داخل لوحة التحكم ليتم تمديد اشتراكك مباشرة.',
      aFr: 'Vous réglez simplement par virement bancaire RIB (Attijariwafa, BCP, CIH) ou dépôt en agence Wafacash. Téléchargez la photo du reçu dans votre espace pour prolonger immédiatement votre abonnement.',
    },
    {
      qAr: 'ما هو رادار الأوراش وكيف يسرّع العثور على آلية؟',
      qFr: 'Comment fonctionne le Radar Chantiers (InDrive BTP) ?',
      aAr: 'رادار الأوراش يربط موقع الورش بأقرب الآليات المتوفرة على الخريطة. عند إرسال طلب عاجل، يتوصل كل الملاك في محيط الورش بتنبيه فوري في هواتفهم للرد عليك مباشرة.',
      aFr: 'Le Radar localise les engins disponibles les plus proches de votre chantier. En un clic, vous envoyez une alerte aux propriétaires situés dans le secteur pour obtenir une réponse immédiate.',
    },
    {
      qAr: 'ماذا يحدث لآلياتي ومعلوماتي إذا انتهى اشتراكي؟',
      qFr: 'Que deviennent mes annonces et données si mon abonnement expire ?',
      aAr: 'نطبق نظام الإغلاق المرن (Soft Lock): لا يتم حذف أي آلية أو عقد أو محادثة نهائياً من قاعدة البيانات. تظل آلياتك ظاهرة للزبائن، ويمكنك تجديد الاشتراك في أي وقت دون فقدان أي بيانات.',
      aFr: 'Vos données ne sont jamais supprimées (principe du Soft Lock). Vos machines et contrats restent sauvegardés, et vous retrouvez l’accès complet dès le renouvellement.',
    },
    {
      qAr: 'هل أحتاج لبريد إلكتروني أو بطاقة بنكية للتسجيل؟',
      qFr: 'Ai-je besoin d’une adresse email ou carte bancaire internationale ?',
      aAr: 'لا، أبداً. التسجيل سريع جداً برقم هاتفك المغربي فقط، سواء كنت صاحب ورش تبحث عن آلية أو مالكاً للآليات وقطع الغيار.',
      aFr: 'Absolument pas. Un simple numéro de téléphone mobile marocain suffit pour créer votre compte en 30 secondes et recevoir vos alertes.',
    },
    {
      qAr: 'هل يمكنني بيع قطع الغيار ومستلزمات الصيانة بجانب الآليات؟',
      qFr: 'Puis-je vendre des pièces de rechange et accessoires BTP ?',
      aAr: 'نعم بكل تأكيد. تتوفر المنصة على قسم خاص لقطع الغيار (فلاتر، مضخات هيدروليكية، جنازير، وأسنان الجرافات) مع خيارات الشحن المباشر لجميع الأوراش بالمغرب.',
      aFr: 'Oui tout à fait. La plateforme dispose d’un catalogue dédié aux pièces détachées (filtres, pompes hydrauliques, chenilles, dents de godet) livrables directement sur chantier dans tout le Maroc.',
    },
  ];

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-14 sm:py-20 lg:py-24 bg-surface border-b border-steel-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-primary-dark">
            {lang === 'fr' ? 'Foire Aux Questions' : 'الأسئلة الشائعة'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-2.5 leading-tight text-balance">
            {lang === 'fr'
              ? 'Toutes les réponses pour les chantiers et les propriétaires'
              : 'كل ما تحتاج معرفته لأصحاب الأوراش وملاك الآليات'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Transparence totale pour les professionnels et loueurs d’engins au Maroc.'
              : 'إجابات واضحة وشفافة لتبدأ التسجيل والعمل في ثوانٍ.'}
          </p>
        </div>

        {/* Accordion Items */}
        <div className="space-y-3.5 text-start">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-steel-200/90 shadow-soft overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(idx)}
                  className="w-full min-h-[52px] p-4 sm:p-6 flex items-center justify-between gap-4 text-start font-bold text-sm sm:text-base text-ink hover:text-primary-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-expanded={isOpen}
                >
                  <span className="leading-snug">
                    {lang === 'fr' ? faq.qFr : faq.qAr}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg bg-steel-100 text-steel-700 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-primary/25 text-ink' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-2 text-xs sm:text-sm text-steel-600 leading-relaxed border-t border-steel-100">
                        {lang === 'fr' ? faq.aFr : faq.aAr}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Section Ending Dual CTA */}
        <DualCtaRow centered={true} className="mt-10 sm:mt-14" />
      </div>
    </section>
  );
};

export default FaqSection;
