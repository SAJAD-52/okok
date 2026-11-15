import React from 'react';
import { motion } from 'framer-motion';
import { Quote, Star, ShieldCheck, MapPin, Building2 } from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const TestimonialsSection: React.FC = () => {
  const { lang } = useLanguage();

  const testimonials = [
    {
      nameAr: 'عبد الرحيم التازي',
      nameFr: 'Abdelrahim Tazi',
      city: 'الدار البيضاء',
      cityFr: 'Casablanca',
      companyTypeAr: 'مالك آليات وأشغال الحفر',
      companyTypeFr: 'Propriétaire · Terrassement & Démolition',
      quoteAr:
        'منذ بدأت استعمال JADIJCB تخلصت تماماً من مشكلة تضارب مواعيد الجرافات والحفارات. المؤقت الزمني جعلنا نعرف مسبقاً موعد خروج كل آلية، وجاءتنا طلبات كراء من شركات كبرى في برشيد والنواصر.',
      quoteFr:
        'Depuis que nous utilisons JADIJCB, finis les chevauchements de planning sur nos pelleteuses. Le compte à rebours nous permet d’anticiper les disponibilités et nous recevons des demandes à Bouskoura et Berrechid.',
      fleet: '4 حفارات + 2 جرافات JCB',
      fleetFr: '4 Pelles + 2 Tractopelles JCB',
    },
    {
      nameAr: 'يوسف بناني',
      nameFr: 'Youssef Bennani',
      city: 'طنجة',
      cityFr: 'Tanger',
      companyTypeAr: 'صاحب ورش ومقاول أشغال عمومية',
      companyTypeFr: 'Conducteur de travaux BTP',
      quoteAr:
        'في ورش طنجة احتجنا لحفارة وقطع غيار بشكل مستعجل؛ أرسلنا طلباً عبر رادار الأوراش وفي أقل من 15 دقيقة توصلنا بعروض الملاك القريبين مع وضوح تام حول السائق والوقود والتوصيل.',
      quoteFr:
        'Sur un chantier à Tanger, nous avions besoin en urgence d’une pelle et de pièces hydrauliques. Via le Radar, des loueurs à moins de 10 km nous ont répondu en 15 minutes avec tarif clair.',
      fleet: 'مشاريع الطرق والبنية التحتية',
      fleetFr: 'Chantiers VRD & Infrastructures',
    },
    {
      nameAr: 'عمر المرابطي',
      nameFr: 'Omar El Mourabit',
      city: 'مراكش',
      cityFr: 'Marrakech',
      companyTypeAr: 'كراء الآليات الثقيلة وقطع الغيار',
      companyTypeFr: 'Loueur d’engins & pièces de rechange',
      quoteAr:
        'صفحة الويب المخصصة لشركتنا ساعدتنا كثيراً، أرسل الرابط مباشرة للمقاولين عبر واتساب ويرون كامل الأسطول والأسعار اليومية بالدرهم. التسجيل لم يأخذ حتى دقيقة واحدة.',
      quoteFr:
        'La vitrine personnalisée à notre nom est un vrai plus. J’envoie le lien WhatsApp aux clients et ils voient nos engins disponibles en Dirhams. L’inscription a pris moins d’une minute.',
      fleet: 'بلدوزرات + مداحل اهتزازية',
      fleetFr: 'Bulldozers + Compacteurs',
    },
  ];

  return (
    <section className="py-14 sm:py-20 lg:py-24 bg-white border-b border-steel-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-primary-dark">
            {lang === 'fr' ? 'Retours d’expérience terrain' : 'شهادات من الميدان'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-2.5 leading-tight text-balance">
            {lang === 'fr'
              ? 'Ce que disent propriétaires d’engins et chefs de chantier'
              : 'ماذا يقول أصحاب الأوراش وملاك المعدات المغاربة عن المنصة؟'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Des gestionnaires de flotte et entreprises BTP accélèrent leurs chantiers chaque jour au Maroc.'
              : 'مقاولون وملاك أساطيل يعتمدون يومياً على JADIJCB لتسريع أشغالهم في مختلف جهات المملكة.'}
          </p>
        </div>

        {/* 3 Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {testimonials.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: idx * 0.1 }}
              className="p-6 sm:p-7 rounded-2xl bg-surface border border-steel-200/90 shadow-soft flex flex-col justify-between text-start relative"
            >
              <div>
                {/* Quote Icon & Stars */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1 text-primary">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary" />
                    ))}
                  </div>
                  <Quote className="w-7 h-7 text-steel-300 stroke-[1.5]" />
                </div>

                {/* Quote Text */}
                <p className="text-xs sm:text-sm text-steel-700 leading-relaxed">
                  &ldquo;{lang === 'fr' ? item.quoteFr : item.quoteAr}&rdquo;
                </p>
              </div>

              {/* Author Lockup */}
              <div className="pt-5 mt-6 border-t border-steel-200/80">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-ink">
                    {lang === 'fr' ? item.nameFr : item.nameAr}
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{lang === 'fr' ? 'Vérifié' : 'موثق'}</span>
                  </span>
                </div>
                <div className="text-[11px] text-steel-500 mt-1.5 flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 font-medium text-steel-600">
                    <Building2 className="w-3.5 h-3.5 text-steel-400 shrink-0" />
                    <span>{lang === 'fr' ? item.companyTypeFr : item.companyTypeAr}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-steel-500">
                    <MapPin className="w-3.5 h-3.5 text-primary-dark shrink-0" />
                    <span>{lang === 'fr' ? item.cityFr : item.city}</span>
                    <span aria-hidden="true">·</span>
                    <span>{lang === 'fr' ? item.fleetFr : item.fleet}</span>
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Section Ending Dual CTA */}
        <DualCtaRow centered={true} className="mt-10 sm:mt-14" />
      </div>
    </section>
  );
};

export default TestimonialsSection;
