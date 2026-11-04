import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const FaqSection: React.FC = () => {
  const { lang } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      qAr: 'كيف يعمل التجريب المجاني لمدة 3 أيام (72 ساعة)؟',
      qFr: 'Comment fonctionne l\'essai gratuit de 3 jours (72h) ?',
      aAr: 'بمجرد تسجيل حسابك برقم هاتفك أو واتسابك، يُفعّل حسابك فوراً بكافة الصلاحيات: يمكنك إضافة آلياتك، تجربة المؤقت الزمني، مشاركة صفحة شركتك، واستقبال طلبات الكراء بدون دفع درهم واحد وبدون الحاجة لإدخال أي بطاقة بنكية.',
      aFr: 'Dès votre inscription avec votre numéro marocain, votre accès complet est activé sans carte bancaire : publiez vos engins, testez le compte à rebours, partagez votre vitrine et recevez des demandes de devis sans frais pendant 72 heures.',
    },
    {
      qAr: 'كيف يتم تسديد الاشتراك بعد نهاية التجربة المجانية؟',
      qFr: 'Comment s\'effectue le règlement de l\'abonnement (RIB / Wafacash) ?',
      aAr: 'نوفر طرق سداد محلية وسهلة: يمكنك القيام بتحويل بنكي (Virement RIB) إلى حساب شركتنا البنكي (التجاري وفا بنك أو البنك الشعبي أو CIH) أو التوجه لأقرب وكالة وفاكاش. ترفع صورة الوصل داخل لوحة التحكم، ويتم تمديد اشتراكك فوراً بعد التحقق.',
      aFr: 'Vous réglez en toute simplicité par virement bancaire RIB vers nos comptes (Attijariwafa, BCP, CIH) ou par dépôt en espèces dans n\'importe quelle agence Wafacash. Téléchargez la photo du reçu dans votre espace et votre compte est prolongé immédiatement.',
    },
    {
      qAr: 'ماذا يحدث لآلياتي ومعلوماتي إذا انتهى اشتراكي؟',
      qFr: 'Que deviennent mes annonces et données si mon abonnement expire ?',
      aAr: 'نطبق نظام الإغلاق المرن (Soft Lock): لا يتم حذف أي آلية أو عقد أو محادثة نهائياً من قاعدة بياناتنا! تظل آلياتك المنشورة مرئية للزبائن في محركات البحث وفي السوق، لكن للتعديل أو إضافة آليات جديدة يكفيك تجديد الاشتراك دون أي فقدان للبيانات.',
      aFr: 'Vos données ne sont jamais supprimées (principe du Soft Lock) ! Vos engins restent indexés et visibles par les clients pour vous apporter des contacts. Pour ajouter de nouvelles machines ou modifier vos tarifs, il vous suffit de renouveler votre mois.',
    },
    {
      qAr: 'هل أحتاج لبريد إلكتروني وبطاقة بنكية دولية للتسجيل؟',
      qFr: 'Ai-je besoin d\'une adresse email ou carte bancaire internationale ?',
      aAr: 'لا، أبداً. صممنا المنصة لتناسب أصحاب ومقاولي الآليات المغاربة: يكفيك رقم هاتف مغربي صالح للتسجيل والتواصل عبر واتساب.',
      aFr: 'Absolument pas. Un simple numéro de téléphone mobile marocain suffit pour créer votre compte, vous connecter et recevoir vos alertes chantiers par WhatsApp.',
    },
    {
      qAr: 'هل يمكنني بيع قطع الغيار ومستلزمات الصيانة بجانب الآليات؟',
      qFr: 'Puis-je vendre des pièces de rechange et accessoires BTP ?',
      aAr: 'نعم بكل تأكيد. تتوفر المنصة على قسم خاص لقطع الغيار (فلاتر، مضخات هيدروليكية، جنازير، وأسنان الجرافات) يمكن لموزعي القطع وملاك الورش عرضها للبيع مع خيارات الشحن لجميع المدن.',
      aFr: 'Oui tout à fait. La plateforme dispose d\'un catalogue dédié aux pièces détachées (filtres, pompes hydrauliques, chenilles, dents de godet) livrables directement sur les chantiers dans tout le Maroc.',
    },
    {
      qAr: 'هل المنصة متوفرة باللغتين العربية والفرنسية؟',
      qFr: 'La plateforme est-elle disponible en arabe et en français ?',
      aAr: 'نعم، المنصة مبنية بتصميم عربي أصيل من اليمين إلى اليسار (RTL) لراحة المقاولين المغاربة، مع إمكانية التبديل الفوري بنقرة واحدة إلى اللغة الفرنسية مع الاحتفاظ بنفس الدقة وسهولة الاستخدام.',
      aFr: 'Oui, JADIJCB est nativement bilingue avec bascule instantanée Arabe (RTL)/Français (LTR) adaptée aux habitudes des conducteurs de travaux et chefs d\'entreprise marocains.',
    },
    {
      qAr: 'كيف أحصل على المساعدة والدعم الفني عند وجود طارئ؟',
      qFr: 'Comment contacter l\'assistance technique en cas d\'urgence sur chantier ?',
      aAr: 'فريق الدعم الفني المغربي لـ JADIJCB متاح طيلة أيام الأسبوع عبر واتساب والهاتف المباشر (+212 522 98 44 20) لمساعدتك في نشر إعلاناتك، تفعيل اشتراكك، أو ضبط عقودك.',
      aFr: 'Notre équipe support marocaine est disponible 7 jours sur 7 par WhatsApp direct et par téléphone (+212 522 98 44 20) pour vous accompagner sur le terrain.',
    },
  ];

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-16 sm:py-24 bg-surface border-b border-steel-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-dark bg-primary-100 px-3 py-1 rounded-full">
            {lang === 'fr' ? 'Foire Aux Questions' : 'الأسئلة الشائعة'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3 leading-tight">
            {lang === 'fr'
              ? 'Toutes les réponses à vos questions sur JADIJCB'
              : 'كل ما تحتاج لمعرفته حول الاشتراك وتسيير آلياتك'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Transparence totale pour les professionnels et loueurs d\'engins au Maroc.'
              : 'إجابات واضحة وشفافة لتبدأ عملك وأنت مطمئن البال.'}
          </p>
        </div>

        {/* 7 Accordion Items */}
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
                  className="w-full min-h-[52px] p-5 sm:p-6 flex items-center justify-between gap-4 text-start font-bold text-sm sm:text-base text-ink hover:text-primary-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-expanded={isOpen}
                >
                  <span className="leading-snug">
                    {lang === 'fr' ? faq.qFr : faq.qAr}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg bg-steel-100 text-steel-700 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-primary/20 text-ink' : ''
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
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-steel-600 leading-relaxed border-t border-steel-100">
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
        <DualCtaRow centered={true} className="mt-14" />
      </div>
    </section>
  );
};

export default FaqSection;
