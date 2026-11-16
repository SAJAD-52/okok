import React from 'react';
import { motion } from 'framer-motion';
import {
  XCircle,
  CheckCircle2,
  PhoneOff,
  CalendarClock,
  FileSpreadsheet,
  FileCheck2,
  SearchX,
  Radio,
  Wrench,
  Truck,
} from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const ProblemsSolutionsSection: React.FC = () => {
  const { lang } = useLanguage();

  const pairs = [
    {
      audienceAr: 'للمقاولات، الفلاحين والأفراد',
      audienceFr: 'Pour entreprises, agriculteurs & particuliers',
      problemTitleAr: 'تأخر الأشغال بسبب البحث عن آلية قريبة',
      problemTitleFr: 'Travaux bloqués faute d’engin disponible à proximité',
      problemDescAr:
        'إضاعة ساعات في الاتصالات للبحث عن جرافة أو حفارة قريبة من ضيعتك أو بقعتك أو ورشك دون معرفة السعر أو توفر السائق.',
      problemDescFr:
        'Des heures perdues au téléphone pour trouver une pelle ou tractopelle libre près de votre site, ferme ou terrain sans tarif clair.',
      problemIcon: SearchX,

      solutionTitleAr: 'رادار المواقع وطلب عاجل يصل لأقرب الملاك',
      solutionTitleFr: 'Radar GPS & diffusion d’alerte aux loueurs proches',
      solutionDescAr:
        'شاهد أقرب الآليات لموقع عملك بالكيلومتر على الخريطة أو أرسل طلباً فورياً يصل لكل الملاك في محيط 30 كلم.',
      solutionDescFr:
        'Localisez les engins disponibles au kilomètre près ou envoyez une alerte immédiate aux propriétaires dans un rayon de 30 km.',
      solutionIcon: Radio,
    },
    {
      audienceAr: 'لأصحاب الأوراش والصيانة',
      audienceFr: 'Pour les chantiers & maintenance',
      problemTitleAr: 'توقف الورش عند تعطل الآلية أو نقص قطع الغيار',
      problemTitleFr: 'Arrêt de chantier lors d’une panne mécanique',
      problemDescAr:
        'صعوبة العثور السريع على فلاتر، خراطيم هيدروليك أو أسنان الجرافات الأصلية وشحنها لموقع الورش.',
      problemDescFr:
        'Difficulté à trouver rapidement des filtres, flexibles hydrauliques ou dents de godet avec livraison sur site.',
      problemIcon: Wrench,

      solutionTitleAr: 'مستودع قطع الغيار مع شحن مباشر للورش',
      solutionTitleFr: 'Catalogue pièces de rechange livrées sur chantier',
      solutionDescAr:
        'اطلب قطع الغيار المناسبة لآليات JCB وCAT وKomatsu مباشرة من الموردين المعتمدين في منطقتك.',
      solutionDescFr:
        'Commandez vos pièces compatibles JCB, CAT et Komatsu directement auprès des fournisseurs vérifiés.',
      solutionIcon: Truck,
    },
    {
      audienceAr: 'لملاك الآليات والمؤجرين',
      audienceFr: 'Pour les propriétaires d’engins',
      problemTitleAr: 'حجوزات الهاتف الشفهية وتضارب مواعيد الآليات',
      problemTitleFr: 'Réservations verbales oubliées & conflits de planning',
      problemDescAr:
        'مكالمات غير مسجلة، نسيان تاريخ انتهاء الكراء في الورش، وضياع فرص تشغيل الآلية في أوراش أخرى.',
      problemDescFr:
        'Des accords verbaux par téléphone, des retards de restitution et des engins promis à deux chantiers en même temps.',
      problemIcon: PhoneOff,

      solutionTitleAr: 'مؤقت تنازلي ذكي ومنع تلقائي لتضارب المواعيد',
      solutionTitleFr: 'Planning intelligent avec compte à rebours en direct',
      solutionDescAr:
        'لوحة تحكم تعرض لك كل آلية مؤجرة، موقع الورش، والوقت المتبقي بالدقيقة مع تنبيهات الاسترجاع.',
      solutionDescFr:
        'Visualisez chaque machine louée, son chantier et le temps restant exact avec alertes automatiques de fin de mission.',
      solutionIcon: CalendarClock,
    },
    {
      audienceAr: 'لملاك الآليات والشركات',
      audienceFr: 'Pour les loueurs & fournisseurs',
      problemTitleAr: 'صعوبة استخلاص المستحقات وغياب العقود الرسمية',
      problemTitleFr: 'Retards de paiement & absence de contrats B2B écrits',
      problemDescAr:
        'خلافات حول ساعات العمل أو الوقود عند انتهاء الورش بسبب غياب وصولات تسليم وعقود موثقة.',
      problemDescFr:
        'Litiges sur le carburant ou les heures travaillées faute de bon de livraison signé et contrat écrit.',
      problemIcon: FileSpreadsheet,

      solutionTitleAr: 'عقود كراء رقمية برقم ICE ومتجر خاص بشركتك',
      solutionTitleFr: 'Contrats conformes ICE & vitrine dédiée à votre nom',
      solutionDescAr:
        'توليد تلقائي لعقود الكراء ووصولات التسليم وحفظ سجل الزبائن والمصاريف، مع رابط خاص لأسطولك.',
      solutionDescFr:
        'Génération instantanée de contrats et bons de mise à disposition avec ICE, suivi financier et vitrine web dédiée.',
      solutionIcon: FileCheck2,
    },
  ];

  return (
    <section className="py-14 sm:py-20 lg:py-24 bg-surface border-b border-steel-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-primary-dark">
            {lang === 'fr' ? 'La réalité du terrain au Maroc' : 'من واقع الميدان والأشغال بالمغرب'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-2.5 leading-tight text-balance">
            {lang === 'fr'
              ? 'Fini les travaux bloqués, les engins à l’arrêt et les litiges'
              : 'وداعاً لتعطل الأشغال، توقف الآليات في المستودع، وفوضى المواعيد'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Que vous soyez entreprise, agriculteur, artisan ou particulier, JADIJCB simplifie votre quotidien et celui des propriétaires de parcs.'
              : 'حلول عملية مصممة لكل زبون (مقاولة، فلاح، مهني أو فرد) لإيجاد الآلية المناسبة بسرعة، ولملاك المعدات لمضاعفة مداخيلهم.'}
          </p>
        </div>

        {/* 4 Pain Points vs Solution Cards (2x2 on Desktop, 1 col on Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {pairs.map((item, idx) => {
            const ProblemIcon = item.problemIcon;
            const SolutionIcon = item.solutionIcon;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: idx * 0.08 }}
                className="rounded-2xl bg-white border border-steel-200 shadow-soft overflow-hidden flex flex-col justify-between"
              >
                {/* Problem Half */}
                <div className="p-5 sm:p-6 bg-red-50/40 border-b border-steel-200 text-start">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 text-danger font-bold text-xs uppercase tracking-wider">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>{lang === 'fr' ? 'Le problème habituel' : 'التحدي اليومي'}</span>
                    </div>
                    <span className="text-[11px] font-bold text-steel-600">
                      {lang === 'fr' ? item.audienceFr : item.audienceAr}
                    </span>
                  </div>
                  <div className="flex items-start gap-3 mt-2">
                    <div className="p-2 rounded-lg bg-red-100 text-danger shrink-0 mt-0.5">
                      <ProblemIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-ink leading-snug">
                        {lang === 'fr' ? item.problemTitleFr : item.problemTitleAr}
                      </h3>
                      <p className="text-xs sm:text-sm text-steel-600 mt-1.5 leading-relaxed">
                        {lang === 'fr' ? item.problemDescFr : item.problemDescAr}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Solution Half */}
                <div className="p-5 sm:p-6 bg-emerald-50/35 text-start flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs uppercase tracking-wider mb-2.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{lang === 'fr' ? 'La solution JADIJCB' : 'الحل مع JADIJCB'}</span>
                    </div>
                    <div className="flex items-start gap-3 mt-2">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                        <SolutionIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-ink leading-snug">
                          {lang === 'fr' ? item.solutionTitleFr : item.solutionTitleAr}
                        </h4>
                        <p className="text-xs sm:text-sm text-steel-600 mt-1.5 leading-relaxed">
                          {lang === 'fr' ? item.solutionDescFr : item.solutionDescAr}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Section Ending CTA Row */}
        <DualCtaRow centered={true} className="mt-10 sm:mt-12" />
      </div>
    </section>
  );
};

export default ProblemsSolutionsSection;
