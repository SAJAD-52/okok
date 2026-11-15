import React from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Building, HardHat } from 'lucide-react';
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
      ar: 'استقبال إشعارات الرادار الفورية لطلبات الأوراش القريبة منك',
      fr: 'Réception des alertes radar en direct pour les chantiers voisins',
    },
    {
      ar: 'صفحة إلكترونية خاصة باسم مقاولتك + QR Code لمشاركتها عبر واتساب',
      fr: 'Vitrine web dédiée à votre nom + QR Code partageable sur WhatsApp',
    },
    {
      ar: 'تواصل مباشر مع أصحاب الأوراش بدون أي عمولة أو اقتطاع (0%)',
      fr: 'Contact direct avec les chantiers : 0% de commission sur vos locations',
    },
    {
      ar: 'توليد وصولات التسليم وعقود الكراء برقم ICE مطابقة للقانون المغربي',
      fr: 'Modèles de contrats et bons de livraison avec ICE conformes au droit marocain',
    },
    {
      ar: 'مرافقة ودعم فني مغربي مخصص عبر واتساب طيلة أيام الأسبوع',
      fr: 'Support technique et accompagnement dédié 7j/7 via WhatsApp',
    },
  ];

  return (
    <section className="py-14 sm:py-20 lg:py-24 bg-surface border-b border-steel-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-primary-dark">
            {lang === 'fr' ? 'Tarification transparente' : 'تسعيرة واضحة للجميع'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-2.5 leading-tight text-balance">
            {lang === 'fr'
              ? 'Gratuit pour les chantiers · Tarif fixe sans commission pour les loueurs'
              : 'مجاني لأصحاب الأوراش · واشتراك ثابت بدون أي عمولة لملاك الآليات'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Profitez de 3 jours d’essai complet sans carte bancaire, puis réglez en toute simplicité par virement RIB ou Wafacash.'
              : 'ابدأ بتجربة مجانية كاملة لمدة 3 أيام بدون بطاقة بنكية، ثم سدد اشتراكك عبر تحويل بنكي RIB أو وكالات وفاكاش.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch max-w-5xl mx-auto">
          {/* Free Tier Card for Contractors / Site Owners */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-5 rounded-3xl bg-white border border-steel-200 shadow-soft p-6 sm:p-8 flex flex-col justify-between text-start"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-ink text-primary flex items-center justify-center shrink-0">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-ink">
                    {lang === 'fr' ? 'Pour les Chantiers & Entreprises' : 'لأصحاب الأوراش والمقاولات'}
                  </h3>
                  <p className="text-xs text-steel-500">
                    {lang === 'fr' ? 'Recherche, Radar GPS & Demandes' : 'البحث، الرادار وطلب الآليات'}
                  </p>
                </div>
              </div>

              <div className="py-5 border-y border-steel-200 mb-6">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-black text-ink latin-nums">0</span>
                  <span className="text-base font-bold text-steel-600">
                    {lang === 'fr' ? 'MAD · Gratuit à vie' : 'د.م · مجاني 100%'}
                  </span>
                </div>
                <span className="text-xs text-emerald-700 font-bold mt-1 block">
                  {lang === 'fr'
                    ? 'Aucune commission sur vos locations ou achats'
                    : 'بدون أي رسوم على البحث أو حجز الآليات'}
                </span>
              </div>

              <div className="space-y-3">
                {[
                  {
                    ar: 'الوصول الكامل لرادار الأوراش وخريطة الآليات القريبة',
                    fr: 'Accès illimité au Radar GPS des engins disponibles',
                  },
                  {
                    ar: 'إرسال طلبات عاجلة لجميع الملاك في محيط ورشك',
                    fr: 'Diffusion d’alertes urgentes aux propriétaires voisins',
                  },
                  {
                    ar: 'طلب وشراء قطع الغيار والمعدات مباشرة من الموردين',
                    fr: 'Commande directe de pièces de rechange BTP',
                  },
                  {
                    ar: 'مقارنة الأسعار وتمديد مدة الكراء ومتابعة أوراشك من الهاتف',
                    fr: 'Comparaison transparente, suivi & prolongation mobile',
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <span className="text-xs sm:text-sm text-steel-700 font-medium leading-relaxed">
                      {lang === 'fr' ? item.fr : item.ar}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Pro Plan Card for Machinery Owners & Suppliers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-7 rounded-3xl bg-white border-2 border-primary/70 shadow-elevated overflow-hidden text-start flex flex-col justify-between"
          >
            {/* Top highlight ribbon */}
            <div className="bg-primary text-ink px-5 py-2.5 text-center font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 fill-ink shrink-0" />
              <span>
                {lang === 'fr'
                  ? 'Offre de lancement : 3 jours d’essai gratuit activés immédiatement'
                  : 'عرض الإطلاق لملاك الآليات: 3 أيام تجربة مجانية فور التسجيل'}
              </span>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                {/* Price Header */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-6 border-b border-steel-200">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-ink">
                      {lang === 'fr' ? 'Abonnement Propriétaire Pro' : 'اشتراك ملاك الآليات والموردين'}
                    </h3>
                    <p className="text-xs text-steel-500 mt-1">
                      {lang === 'fr'
                        ? 'Pour propriétaires d’engins, loueurs et revendeurs de pièces'
                        : 'لأصحاب ومؤجري المعدات، الشاحنات، وموردي قطع الغيار'}
                    </p>
                  </div>

                  <div className="text-start sm:text-end">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-black text-ink latin-nums">
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
                <div className="py-6 space-y-3">
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
              </div>

              {/* Offline Payment Explanation Banner */}
              <div className="p-4 rounded-2xl bg-surface border border-steel-200 text-xs text-steel-700 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <Building className="w-4 h-4 text-primary-dark shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Paiement sécurisé et adapté au Maroc :'
                      : 'طرق دفع مغربية آمنة ومعتمدة:'}
                  </span>
                </div>
                <p className="leading-relaxed text-steel-600">
                  {lang === 'fr'
                    ? 'Réglez par virement bancaire RIB (Attijariwafa, BCP, CIH...) ou agence Wafacash. Envoyez la photo du reçu et votre compte est activé.'
                    : 'لا تحتاج لبطاقة بنكية دولية. سدد عبر تحويل بنكي RIB (التجاري وفا بنك، الشعبي، CIH...) أو عبر وفاكاش وارفع صورة الوصل.'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Section Ending Dual CTA */}
        <DualCtaRow centered={true} className="mt-10 sm:mt-12" />
      </div>
    </section>
  );
};

export default PricingSection;
