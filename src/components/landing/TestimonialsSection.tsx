import React from 'react';
import { motion } from 'framer-motion';
import { Quote, Star, ShieldCheck, MapPin, Building2 } from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

// Sample Moroccan contractor testimonials for social proof
export const TestimonialsSection: React.FC = () => {
  const { lang } = useLanguage();

  const testimonials = [
    {
      nameAr: 'عبد الرحيم التازي',
      nameFr: 'Abdelrahim Tazi',
      city: 'الدار البيضاء',
      cityFr: 'Casablanca',
      companyTypeAr: 'مقاولة أشغال الحفر والهدم',
      companyTypeFr: 'Terrassement & Démolition',
      quoteAr: 'منذ بدأت استعمال JADIJCB تخلصت تماماً من مشكلة تضارب مواعيد الجرافات والحفارات. المؤقت الزمني جعلنا نعرف مسبقاً موعد خروج كل آلية، وجاءتنا طلبات كراء من شركات كبرى في برشيد والنواصر لم نكن نصل إليها من قبل.',
      quoteFr: 'Depuis que nous utilisons JADIJCB, finis les chevauchements de planning sur nos pelleteuses. Le compte à rebours nous permet d\'anticiper les disponibilités et nous avons décroché des contrats avec des promoteurs à Bouskoura.',
      fleet: '4 حفارات + 2 جرافات JCB',
      fleetFr: '4 Pelles + 2 Tractopelles JCB',
    },
    {
      nameAr: 'يوسف بناني',
      nameFr: 'Youssef Bennani',
      city: 'طنجة',
      cityFr: 'Tanger',
      companyTypeAr: 'كراء الآليات الثقيلة لمشاريع الشمال',
      companyTypeFr: 'Location d\'engins lourds & grues',
      quoteAr: 'أفضل ما في المنصة هو وصولات التسليم وعقود الكراء المنظمة التي تضمن حقوقنا عند تسليم الآلية لسائقي الورش. الدفع عبر وفاكاش والتحويل البنكي عملي جداً وفريق الدعم بالواتساب يجيب في دقائق.',
      quoteFr: 'Le point fort est sans conteste la génération des bons de mise à disposition et contrats conformes. Le règlement par virement RIB est fluide et le support WhatsApp répond dans le quart d\'heure.',
      fleet: '3 رافعات + 5 شاحنات Benne',
      fleetFr: '3 Grues + 5 Camions Bennes',
    },
    {
      nameAr: 'عمر المرابطي',
      nameFr: 'Omar El Mourabit',
      city: 'مراكش',
      cityFr: 'Marrakech',
      companyTypeAr: 'مقاولة البنية التحتية والمسالك القروية',
      companyTypeFr: 'Infrastructures & Pistes rurales',
      quoteAr: 'صفحة الويب المخصصة لشركتنا ساعدتنا كثيراً، أرسل الرابط مباشرة للمقاولين عبر واتساب ويرون كامل الأسطول والأسعار اليومية بالدرهم. تجربة الـ 3 أيام المجانية جعلتني أتأكد من فائدتها قبل الدفع.',
      quoteFr: 'La vitrine personnalisée à notre nom est un atout commercial énorme. J\'envoie le lien WhatsApp à mes clients et ils voient nos bulldozers disponibles. L\'essai gratuit de 3 jours m\'a tout de suite convaincu.',
      fleet: 'بلدوزرات + مداحل اهتزازية',
      fleetFr: 'Bulldozers + Compacteurs',
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-white border-b border-steel-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-dark bg-primary-100 px-3 py-1 rounded-full">
            {lang === 'fr' ? 'Retours d\'expérience' : 'شهادات من الميدان'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3 leading-tight">
            {lang === 'fr'
              ? 'Ce que disent les entrepreneurs marocains de JADIJCB'
              : 'ماذا يقول أصحاب المعدات والمقاولون المغاربة عن تجربتهم؟'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Des dizaines de gestionnaires de flotte maximisent leur taux d\'occupation chaque mois.'
              : 'عشرات مدراء وملاك أساطيل الآليات يشغلون معداتهم بنجاح عبر ربوع المملكة.'}
          </p>
        </div>

        {/* 3 Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {testimonials.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              className="p-6 sm:p-8 rounded-2xl bg-surface border border-steel-200/90 shadow-soft flex flex-col justify-between text-start relative"
            >
              <div>
                {/* Quote Icon & Stars */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1 text-primary">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary" />
                    ))}
                  </div>
                  <Quote className="w-8 h-8 text-steel-300 stroke-[1.5]" />
                </div>

                {/* Quote Text */}
                <p className="text-xs sm:text-sm text-steel-700 leading-relaxed italic">
                  "{lang === 'fr' ? item.quoteFr : item.quoteAr}"
                </p>
              </div>

              {/* Author Lockup */}
              <div className="pt-6 mt-6 border-t border-steel-200/80">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-ink">
                    {lang === 'fr' ? item.nameFr : item.nameAr}
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>{lang === 'fr' ? 'Vérifié' : 'موثق'}</span>
                  </span>
                </div>
                <div className="text-[11px] text-steel-500 mt-1 flex flex-col gap-0.5">
                  <span className="flex items-center gap-1 font-medium">
                    <Building2 className="w-3 h-3 text-steel-400" />
                    <span>{lang === 'fr' ? item.companyTypeFr : item.companyTypeAr}</span>
                  </span>
                  <span className="flex items-center gap-1 text-steel-400">
                    <MapPin className="w-3 h-3 text-primary-dark" />
                    <span>{lang === 'fr' ? item.cityFr : item.city}</span>
                    <span>·</span>
                    <span>{lang === 'fr' ? item.fleetFr : item.fleet}</span>
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Section Ending Dual CTA */}
        <DualCtaRow centered={true} className="mt-14" />
      </div>
    </section>
  );
};

export default TestimonialsSection;
