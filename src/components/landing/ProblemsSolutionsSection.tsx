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
  Compass 
} from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const ProblemsSolutionsSection: React.FC = () => {
  const { lang } = useLanguage();

  const pairs = [
    {
      problemTitleAr: 'حجوزات الهاتف الشفهية وضياع المواعيد',
      problemTitleFr: 'Réservations au téléphone oubliées & conflits d\'agenda',
      problemDescAr: 'مكالمات شفهية دون تسجيل دقيق، تضارب في مواعيد الأوراش، ونسيان تاريخ استرجاع الآلية.',
      problemDescFr: 'Des accords verbaux par téléphone, des retards de restitution et des engins promis à deux chantiers en même temps.',
      problemIcon: PhoneOff,

      solutionTitleAr: 'جدول رقمي ذكي مع مؤقت تنازلي دقيق',
      solutionTitleFr: 'Planning centralisé avec compte à rebours précis',
      solutionDescAr: 'لوحة تفاعلية تبين لك أي آلة مؤجرة، أين توجد، والوقت المتبقي بدقة متناهية لتفادي أي فراغ في الأسطول.',
      solutionDescFr: 'Visualisez en temps réel chaque machine louée, son chantier d\'affectation et le temps restant avant disponibilité.',
      solutionIcon: CalendarClock,
    },
    {
      problemTitleAr: 'تأخر مستحقات الكراء وغياب العقود المكتوبة',
      problemTitleFr: 'Retards de paiement & litiges sans contrat B2B écrit',
      problemDescAr: 'صعوبة استخلاص المبالغ عند انتهاء الأشغال بسبب غياب وصولات تسليم وتوافق مسبق على شروط الوقود والمشغل.',
      problemDescFr: 'Difficulté à recouvrer les factures sans bon de livraison signé ni accord préalable sur le carburant et l\'opérateur.',
      problemIcon: FileSpreadsheet,

      solutionTitleAr: 'عقود كراء رقمية مطابقة لمدونة التجارة المغربية',
      solutionTitleFr: 'Bons de mise à disposition conformes au droit marocain',
      solutionDescAr: 'توليد تلقائي لملخصات الكراء، شروط التأمين، وسندات التسليم مع رقم ICE لحماية حقوق الطرفين قانونياً.',
      solutionDescFr: 'Génération instantanée de bons de commande et procès-verbaux mentionnant l\'ICE et les clauses légales de protection.',
      solutionIcon: FileCheck2,
    },
    {
      problemTitleAr: 'آليات معطلة في المستودع بدون زبائن',
      problemTitleFr: 'Engins immobilisés au dépôt par manque de visibilité',
      problemDescAr: 'الاعتماد على المعارف المحلية فقط بينما تطلب أوراش المدن المجاورة نفس الآليات بأسعار ممتازة.',
      problemDescFr: 'Dépendance au bouche-à-oreille local pendant que des chantiers voisins cherchent vos pelles et bulldozers.',
      problemIcon: SearchX,

      solutionTitleAr: 'سوق B2B وطني مع صفحة مخصصة لشركتك',
      solutionTitleFr: 'Visibilité nationale et vitrine web dédiée',
      solutionDescAr: 'عرض آلياتك أمام آلاف الشركات والمقاولين في 40 مدينة مغربية مع رابط مباشر باسم شركتك.',
      solutionDescFr: 'Exposez votre parc devant des milliers de promoteurs BTP au Maroc avec une vitrine à votre nom partageable sur WhatsApp.',
      solutionIcon: Compass,
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-surface border-b border-steel-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-dark bg-primary-100 px-3 py-1 rounded-full">
            {lang === 'fr' ? 'La réalité du terrain' : 'من واقع أوراش البناء بالمغرب'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3 leading-tight">
            {lang === 'fr'
              ? 'Fini les pertes de temps et les litiges sur vos engins lourds'
              : 'وداعاً للفوضى في مواعيد الآليات وصعوبات استخلاص مستحقات الكراء'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Voyez comment JADIJCB transforme le quotidien des loueurs et entrepreneurs de travaux publics.'
              : 'كيف تحول JADIJCB التحديات اليومية لأصحاب المعدات إلى أرباح مستقرة وأسطول دائم التشغيل.'}
          </p>
        </div>

        {/* 3 Pain Points vs Solution Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {pairs.map((item, idx) => {
            const ProblemIcon = item.problemIcon;
            const SolutionIcon = item.solutionIcon;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="rounded-2xl bg-white border border-steel-200 shadow-soft overflow-hidden flex flex-col justify-between"
              >
                {/* Problem Half */}
                <div className="p-6 bg-red-50/40 border-b border-steel-200 text-start">
                  <div className="flex items-center gap-2 text-danger font-bold text-xs uppercase tracking-wider mb-2">
                    <XCircle className="w-4 h-4" />
                    <span>{lang === 'fr' ? 'Le problème habituel' : 'المشكل الشائع'}</span>
                  </div>
                  <div className="flex items-start gap-3 mt-2">
                    <div className="p-2 rounded-lg bg-red-100 text-danger shrink-0 mt-0.5">
                      <ProblemIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-ink leading-snug">
                        {lang === 'fr' ? item.problemTitleFr : item.problemTitleAr}
                      </h3>
                      <p className="text-xs text-steel-600 mt-1.5 leading-relaxed">
                        {lang === 'fr' ? item.problemDescFr : item.problemDescAr}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Solution Half */}
                <div className="p-6 bg-emerald-50/30 text-start flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider mb-2">
                      <CheckCircle2 className="w-4 h-4" />
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
                        <p className="text-xs text-steel-600 mt-1.5 leading-relaxed">
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
        <DualCtaRow centered={true} className="mt-12" />
      </div>
    </section>
  );
};

export default ProblemsSolutionsSection;
