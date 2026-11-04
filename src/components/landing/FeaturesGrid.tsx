import React from 'react';
import { motion } from 'framer-motion';
import { 
  Truck, 
  Clock, 
  Tag, 
  Wrench, 
  MessageSquare, 
  Globe, 
  BarChart3, 
  Languages 
} from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const FeaturesGrid: React.FC = () => {
  const { lang } = useLanguage();

  const features = [
    {
      titleAr: 'إدارة متكاملة لأسطول الآليات',
      titleFr: 'Gestion centralisée du parc matériel',
      descAr: 'تتبع حالة كل جرافة، شاحنة أو حفارة (متوفرة، مؤجرة، أو في الصيانة) بنقرة واحدة.',
      descFr: 'Suivez le statut de chaque engin (disponible, en mission, en maintenance) en temps réel.',
      icon: Truck,
    },
    {
      titleAr: 'تأجير مع مؤقت زمني تنازلي',
      titleFr: 'Locations avec compte à rebours précis',
      descAr: 'حساب دقيق للأيام والساعات المتبقية في كل ورش مع تنبيهات قبل موعد انتهاء العقد.',
      descFr: 'Chronométrez la durée exacte restante sur chaque chantier et anticipez la prochaine mobilisation.',
      icon: Clock,
    },
    {
      titleAr: 'سوق بيع الآليات والمعدات',
      titleFr: 'Vente d\'engins neufs et d\'occasion',
      descAr: 'انشر إعلانات بيع آلياتك مع المواصفات الفنية وساعات العمل والصور للوصول للمشترين.',
      descFr: 'Publiez vos annonces de vente avec fiche technique complète, photos et heures au compteur.',
      icon: Tag,
    },
    {
      titleAr: 'مستودع قطع الغيار والملحقات',
      titleFr: 'Catalogue des pièces de rechange BTP',
      descAr: 'فلاتر، خراطيم هيدروليكية، جنازير وأسنان الدلو متوفرة للشحن المباشر لأي ورش بالمغرب.',
      descFr: 'Filtres, chenilles, dents de godet et composants hydrauliques livrables sur site.',
      icon: Wrench,
    },
    {
      titleAr: 'مراسلة وتنسيق ميداني فوري',
      titleFr: 'Messagerie & coordination de chantier',
      descAr: 'تواصل مباشر وسريع بين صاحب الآلية والمقاول لتحديد إحداثيات الورش وطرق الوصول.',
      descFr: 'Échangez directement avec le responsable chantier pour fixer l\'accès et la logistique porte-char.',
      icon: MessageSquare,
    },
    {
      titleAr: 'صفحة إلكترونية مخصصة لشركتك',
      titleFr: 'Vitrine web dédiée (Storefront)',
      descAr: 'احصل على رابط خاص باسم شركتك (jadijcb.ma/storefront/nom) لمشاركته عبر واتساب.',
      descFr: 'Une page web professionnelle à votre nom partageable en un clic avec vos clients.',
      icon: Globe,
    },
    {
      titleAr: 'لوحة تحكم وتقارير مالية بالدرهم',
      titleFr: 'Tableau de bord & suivi financier',
      descAr: 'متابعة فورية للمداخيل المحققة، الفواتير المعلقة، ونسبة استغلال كل آلية طيلة الشهر.',
      descFr: 'Visualisez vos rentrées en Dirhams, le taux d\'occupation de votre matériel et les devis validés.',
      icon: BarChart3,
    },
    {
      titleAr: 'ثنائي اللغة بالكامل (عربي / فرنسي)',
      titleFr: '100% Bilingue Arabe & Français',
      descAr: 'تجربة استخدام مصممة باللغة العربية أولاً من اليمين لليسار، مع دعم كامل للفرنسية.',
      descFr: 'Une plateforme fluide en arabe (RTL natif) et en français selon la préférence de vos équipes.',
      icon: Languages,
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-white border-b border-steel-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-dark bg-primary-100 px-3 py-1 rounded-full">
            {lang === 'fr' ? 'Fonctionnalités avancées' : 'خصائص تقنية مصممة لمهنتك'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3 leading-tight">
            {lang === 'fr'
              ? 'Tout ce dont vous avez besoin pour rentabiliser votre matériel'
              : 'كل ما تحتاجه لرقمنة وتطوير نشاط تأجير وبيع الآليات'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Une plateforme complète qui remplace les carnets manuels et vous connecte aux chantiers du Royaume.'
              : 'منصة متكاملة تغنيك عن الدفاتر التقليدية وتفتح أمامك فرص عمل جديدة في كل المدن المغربية.'}
          </p>
        </div>

        {/* 8 Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, idx) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="p-6 rounded-2xl bg-surface border border-steel-200/90 shadow-soft hover:shadow-elevated transition-all flex flex-col justify-between text-start group hover:border-primary/50"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-white border border-steel-200 text-ink group-hover:bg-primary group-hover:text-ink transition-colors flex items-center justify-center mb-4 shadow-sm">
                    <Icon className="w-6 h-6 stroke-[2]" />
                  </div>
                  <h3 className="text-base font-bold text-ink mb-2">
                    {lang === 'fr' ? f.titleFr : f.titleAr}
                  </h3>
                  <p className="text-xs text-steel-600 leading-relaxed">
                    {lang === 'fr' ? f.descFr : f.descAr}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Ending CTA Row */}
        <DualCtaRow centered={true} className="mt-14" />
      </div>
    </section>
  );
};

export default FeaturesGrid;
