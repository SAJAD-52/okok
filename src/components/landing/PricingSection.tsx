import React from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Sparkles, 
  Building, 
  Receipt, 
  HelpCircle, 
  ShieldCheck 
} from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

// Configurable monthly subscription constant in MAD as requested
export const MONTHLY_PLAN_PRICE_MAD = 290;

export const PricingSection: React.FC = () => {
  const { lang } = useLanguage();

  const includedFeatures = [
    {
      ar: 'نشر وإدارة عدد غير محدود من الآليات والمعدات وقطع الغيار',
      fr: 'Annonces illimitées (pelles, JCB, camions, pièces de rechange)',
    },
    {
      ar: 'مؤقت تنازلي دقيق لتتبع فترات الكراء والأيام المتبقية في الورش',
      fr: 'Chronomètre & compte à rebours précis pour chaque location active',
    },
    {
      ar: 'صفحة إلكترونية خاصة باسم مقاولتك لمشاركتها مع الزبائن',
      fr: 'Vitrine web dédiée à votre nom (jadijcb.ma/storefront/votre-nom)',
    },
    {
      ar: 'تواصل مباشر مع المقاولين عبر واتساب بدون أي عمولة أو اقتطاع',
      fr: 'Contact direct WhatsApp avec les clients : 0% de commission',
    },
    {
      ar: 'توليد وصولات التسليم وعقود الكراء المطابقة للقانون التجاري المغربي',
      fr: 'Modèles de contrats et bons de livraison conformes au droit marocain',
    },
    {
      ar: 'ظهور معتمد بعلامة التوثيق B2B لزيادة ثقة الشركات الكبرى',
      fr: 'Badge de conformité B2B & vérification ICE pour rassurer les donneurs d\'ordre',
    },
    {
      ar: 'مرافقة ودعم فني مخصص عبر واتساب طيلة أيام الأسبوع',
      fr: 'Support technique et accompagnement dédié 7j/7 via WhatsApp',
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-surface border-b border-steel-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-dark bg-primary-100 px-3 py-1 rounded-full">
            {lang === 'fr' ? 'Tarification transparente' : 'تسعيرة واحدة واضحة وبسيطة'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3 leading-tight">
            {lang === 'fr'
              ? 'Un tarif unique et transparent, sans commissions cachées'
              : 'اشتراك شهري واضح بدون أي نسبة مئوية أو اقتطاعات من أرباحك'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Profitez de 3 jours d\'essai complet sans carte bancaire, puis réglez en toute simplicité par virement RIB ou Wafacash.'
              : 'ابدأ بتجربة مجانية كاملة لمدة 3 أيام، ثم سدد اشتراكك بكل سهولة عبر تحويل بنكي RIB أو وكالات وفاكاش.'}
          </p>
        </div>

        {/* Single Clear Plan Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto rounded-3xl bg-white border-2 border-primary/60 shadow-elevated overflow-hidden text-start relative"
        >
          {/* Top highlight ribbon */}
          <div className="bg-primary text-ink px-6 py-2.5 text-center font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 fill-ink" />
            <span>
              {lang === 'fr'
                ? 'Offre de lancement : 3 jours d\'essai gratuit activés immédiatement'
                : 'عرض الإطلاق: تجربة مجانية كاملة لـ 3 أيام تنطلق فور التسجيل'}
            </span>
          </div>

          <div className="p-6 sm:p-10">
            {/* Price Header */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-8 border-b border-steel-200">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-ink">
                  {lang === 'fr' ? 'Abonnement Professionnel BTP' : 'الاشتراك المهني الشامل'}
                </h3>
                <p className="text-xs text-steel-500 mt-1">
                  {lang === 'fr'
                    ? 'Pour propriétaires d\'engins, loueurs et revendeurs de pièces'
                    : 'لأصحاب ومؤجري المعدات، الشاحنات، وموردي قطع الغيار بالمغرب'}
                </p>
              </div>

              <div className="text-start sm:text-end">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-black text-ink font-sans latin-nums">
                    {MONTHLY_PLAN_PRICE_MAD}
                  </span>
                  <span className="text-base font-bold text-steel-600">
                    {lang === 'fr' ? 'MAD / mois' : 'د.م / شهرياً'}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-700 font-bold mt-0.5 block">
                  {lang === 'fr' ? 'Soit moins de 10 MAD par jour' : 'أقل من 10 دراهم في اليوم'}
                </span>
              </div>
            </div>

            {/* Checklist of Included Features */}
            <div className="py-8 space-y-3.5">
              <span className="text-xs font-bold uppercase text-steel-400 tracking-wider block mb-4">
                {lang === 'fr' ? 'Ce qui est inclus dans votre accès :' : 'جميع المزايا مشمولة في حسابك:'}
              </span>
              {includedFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs sm:text-sm text-steel-800 font-medium leading-relaxed">
                    {lang === 'fr' ? feat.fr : feat.ar}
                  </span>
                </div>
              ))}
            </div>

            {/* Offline Payment Explanation Banner */}
            <div className="p-4 rounded-2xl bg-surface border border-steel-200 text-xs text-steel-700 space-y-2">
              <div className="flex items-center gap-2 font-bold text-ink">
                <Building className="w-4 h-4 text-primary-dark" />
                <span>
                  {lang === 'fr'
                    ? 'Paiement sécurisé et adapté au Maroc :'
                    : 'طرق دفع مغربية آمنة ومعتمدة:'}
                </span>
              </div>
              <p className="leading-relaxed text-steel-600">
                {lang === 'fr'
                  ? 'Pas besoin de carte internationale. Réglez par virement bancaire RIB (Attijariwafa, BCP, CIH, etc.) ou dépôt en agence Wafacash. Téléchargez votre reçu et votre compte est renouvelé sous 30 minutes.'
                  : 'لا تحتاج لبطاقة بنكية دولية. يمكنك السداد عبر تحويل بنكي RIB (التجاري وفا بنك، البنك الشعبي، CIH، وغيرها) أو عبر أقرب وكالة وفاكاش. ترفع صورة الوصل ويتم تفعيل حسابك مباشرة.'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Section Ending Dual CTA */}
        <DualCtaRow centered={true} className="mt-12" />
      </div>
    </section>
  );
};

export default PricingSection;
