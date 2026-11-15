import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Truck,
  Clock,
  Tag,
  Wrench,
  MessageSquare,
  Globe,
  BarChart3,
  Languages,
  MapPin,
  Radio,
  BellRing,
  FileCheck2,
} from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

type AudienceFilter = 'all' | 'contractor' | 'owner';

export const FeaturesGrid: React.FC = () => {
  const { lang } = useLanguage();
  const [filter, setFilter] = useState<AudienceFilter>('all');

  const features = [
    {
      audience: 'contractor' as const,
      roleAr: 'لأصحاب الأوراش',
      roleFr: 'Chantiers',
      titleAr: 'رادار الأوراش الجغرافي (GPS Radar)',
      titleFr: 'Radar GPS des engins à proximité',
      descAr:
        'حدد موقع ورشك على الخريطة وشاهد أقرب الجرافات والحفارات والشاحنات المتوفرة مرتبة حسب المسافة بالكيلومتر.',
      descFr:
        'Localisez votre chantier sur la carte et repérez les engins disponibles classés par distance en km.',
      icon: MapPin,
    },
    {
      audience: 'contractor' as const,
      roleAr: 'لأصحاب الأوراش',
      roleFr: 'Chantiers',
      titleAr: 'إرسال طلب عاجل لكل الملاك القريبين',
      titleFr: 'Diffusion d’alerte urgente aux loueurs',
      descAr:
        'لا تضيع وقتك في الاتصال بواحد تلو الآخر: أرسل مواصفات الآلية المطلوبة ليصل تنبيه فوري لكل الملاك في محيط ورشك.',
      descFr:
        'Envoyez votre besoin en un clic : tous les propriétaires dans la zone reçoivent une notification instantanée.',
      icon: Radio,
    },
    {
      audience: 'owner' as const,
      roleAr: 'لملاك الآليات',
      roleFr: 'Propriétaires',
      titleAr: 'تنبيهات الفرص والصفقات القريبة',
      titleFr: 'Alertes opportunités en temps réel',
      descAr:
        'توصل بإشعارات صوتية وفورية كلما أطلق مقاول أو صاحب ورش طلباً لآلية متوفرة في أسطولك واقبل العرض بنقرة.',
      descFr:
        'Recevez des alertes sonores et push dès qu’un chantier voisin recherche un engin de votre parc.',
      icon: BellRing,
    },
    {
      audience: 'owner' as const,
      roleAr: 'لملاك الآليات',
      roleFr: 'Propriétaires',
      titleAr: 'إدارة متكاملة لأسطول الآليات',
      titleFr: 'Gestion centralisée du parc matériel',
      descAr:
        'تتبع حالة كل جرافة، شاحنة أو حفارة (متوفرة، قيد العمل، أو في الصيانة) وحدد الأسعار بالساعة أو اليوم والأسبوع.',
      descFr:
        'Suivez le statut de chaque engin (disponible, en mission, maintenance) et vos tarifs horaire/jour/semaine.',
      icon: Truck,
    },
    {
      audience: 'owner' as const,
      roleAr: 'لملاك الآليات',
      roleFr: 'Propriétaires',
      titleAr: 'مؤقت تنازلي ذكي ومنع تضارب الحجوزات',
      titleFr: 'Compte à rebours & zéro conflit d’agenda',
      descAr:
        'حساب دقيق للأيام والساعات المتبقية لكل آلية في الورش مع تنبيهات قبل انتهاء العقد وتمديد الكراء بسهولة.',
      descFr:
        'Chronométrez chaque location active, évitez les doubles réservations et gérez les prolongations en un clic.',
      icon: Clock,
    },
    {
      audience: 'all' as const,
      roleAr: 'للجميع',
      roleFr: 'Tous',
      titleAr: 'سوق كراء وبيع الآليات الثقيلة',
      titleFr: 'Marketplace location & vente d’engins',
      descAr:
        'استعرض أو انشر آليات الكراء والبيع مع المواصفات التقنية، ساعات العمل، خيار السائق المعتمد، الوقود والتوصيل بـ Porte-Char.',
      descFr:
        'Louez ou achetez avec fiches techniques, heures compteur, options chauffeur, carburant et transport porte-char.',
      icon: Tag,
    },
    {
      audience: 'all' as const,
      roleAr: 'للجميع',
      roleFr: 'Tous',
      titleAr: 'مستودع قطع الغيار والملحقات',
      titleFr: 'Catalogue des pièces de rechange BTP',
      descAr:
        'فلاتر، مضخات وخراطيم هيدروليكية، جنازير وأسنان الدلو متوفرة للشحن السريع مباشرة نحو الورش في كل المدن.',
      descFr:
        'Filtres, pompes hydrauliques, chenilles et dents de godet disponibles avec expédition rapide sur chantier.',
      icon: Wrench,
    },
    {
      audience: 'owner' as const,
      roleAr: 'لملاك الآليات',
      roleFr: 'Propriétaires',
      titleAr: 'متجر إلكتروني خاص بشركتك + QR Code',
      titleFr: 'Vitrine web dédiée + QR Code',
      descAr:
        'احصل على رابط احترافي باسم شركتك (jadijcb.ma/s/nom) لعرض أسطولك ومشاركته فوراً عبر واتساب.',
      descFr:
        'Obtenez votre page professionnelle personnalisée et partagez tout votre catalogue par WhatsApp ou QR Code.',
      icon: Globe,
    },
    {
      audience: 'owner' as const,
      roleAr: 'لملاك الآليات',
      roleFr: 'Propriétaires',
      titleAr: 'عقود ICE، وصولات تسليم وتقارير مالية',
      titleFr: 'Contrats ICE, reçus & suivi financier MAD',
      descAr:
        'توليد عقود الكراء ووصولات التسليم، تتبع المداخيل والمصاريف والديون بالدرهم، وإدارة قاعدة بيانات الزبائن.',
      descFr:
        'Générez vos bons et contrats avec ICE, suivez encaissements et dépenses en MAD et gérez vos clients BTP.',
      icon: FileCheck2,
    },
    {
      audience: 'all' as const,
      roleAr: 'للجميع',
      roleFr: 'Tous',
      titleAr: 'مراسلة فورية وربط بواتساب (0% عمولة)',
      titleFr: 'Messagerie directe & WhatsApp (0% comm.)',
      descAr:
        'تواصل مباشر بين صاحب الورش ومالك الآلية لتحديد موقع الحفر وسعر الكراء دون أي اقتطاع أو وسيط.',
      descFr:
        'Échangez directement sur l’app ou via WhatsApp pour caler la logistique et les tarifs sans aucune commission.',
      icon: MessageSquare,
    },
    {
      audience: 'owner' as const,
      roleAr: 'لملاك الآليات',
      roleFr: 'Propriétaires',
      titleAr: 'إحصائيات ونسبة استغلال الأسطول',
      titleFr: 'Analytique de rentabilité par engin',
      descAr:
        'اعرف الآليات الأكثر ربحاً، مصاريف الصيانة والوقود، ونسبة التشغيل الشهرية لاتخاذ قرارات استثمارية دقيقة.',
      descFr:
        'Suivez la rentabilité nette par machine, les coûts de maintenance et le taux d’utilisation mensuel.',
      icon: BarChart3,
    },
    {
      audience: 'all' as const,
      roleAr: 'للجميع',
      roleFr: 'Tous',
      titleAr: 'ثنائي اللغة (عربي / فرنسي) وتطبيق سريع',
      titleFr: 'Bilingue AR / FR & PWA Mobile rapide',
      descAr:
        'واجهة عربية RTL أو فرنسية LTR تشتغل بسرعة على الهاتف والحاسوب مع إمكانية التثبيت كتطبيق على الهاتف.',
      descFr:
        'Interface fluide Arabe (RTL) et Français (LTR), installable en application mobile PWA sur téléphone et PC.',
      icon: Languages,
    },
  ];

  const visibleFeatures =
    filter === 'all'
      ? features
      : features.filter((f) => f.audience === filter || f.audience === 'all');

  const tabs: { id: AudienceFilter; labelAr: string; labelFr: string }[] = [
    { id: 'all', labelAr: 'جميع المزايا (12)', labelFr: 'Toutes les fonctionnalités (12)' },
    { id: 'contractor', labelAr: 'لأصحاب الأوراش والمقاولات', labelFr: 'Pour les chantiers' },
    { id: 'owner', labelAr: 'لملاك الآليات والموردين', labelFr: 'Pour les propriétaires' },
  ];

  return (
    <section id="features" className="py-14 sm:py-20 lg:py-24 bg-white border-b border-steel-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-primary-dark">
            {lang === 'fr' ? 'Écosystème complet JADIJCB' : 'منظومة متكاملة لجميع أطراف الورش'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-2.5 leading-tight text-balance">
            {lang === 'fr'
              ? 'Toutes les fonctionnalités pour les chantiers, les loueurs et les pièces'
              : 'كل المزايا التي يحتاجها صاحب الورش ومالك الآليات في مكان واحد'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Filtrez selon votre profil pour découvrir comment JADIJCB accélère votre activité au Maroc.'
              : 'اختر صفتك لتتعرف على الأدوات المخصصة لك سواء كنت تبحث عن آليات لورشك أو تدير أسطولاً للكراء والبيع.'}
          </p>

          {/* Interactive Audience Filter Segmented Control */}
          <div className="mt-7 flex justify-center">
            <div className="inline-flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 p-1.5 bg-steel-100 rounded-xl border border-steel-200 w-full sm:w-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`flex-1 sm:flex-initial min-h-[40px] px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                    filter === tab.id
                      ? 'bg-ink text-primary shadow-sm'
                      : 'text-steel-700 hover:text-ink hover:bg-white/70'
                  }`}
                >
                  {lang === 'fr' ? tab.labelFr : tab.labelAr}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {visibleFeatures.map((f, idx) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.titleFr}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: Math.min(idx * 0.04, 0.25) }}
                className="p-5 sm:p-6 rounded-2xl bg-surface border border-steel-200/90 shadow-soft hover:shadow-elevated transition-all flex flex-col justify-between text-start group hover:border-primary/60"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-white border border-steel-200 text-ink group-hover:bg-primary group-hover:border-primary transition-colors flex items-center justify-center shadow-sm shrink-0">
                      <Icon className="w-5 h-5 stroke-[2]" />
                    </div>
                    <span className="text-[11px] font-bold text-steel-500">
                      {lang === 'fr' ? f.roleFr : f.roleAr}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-ink mb-2 leading-snug">
                    {lang === 'fr' ? f.titleFr : f.titleAr}
                  </h3>
                  <p className="text-xs sm:text-sm text-steel-600 leading-relaxed">
                    {lang === 'fr' ? f.descFr : f.descAr}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Ending CTA Row */}
        <DualCtaRow centered={true} className="mt-12 sm:mt-14" />
      </div>
    </section>
  );
};

export default FeaturesGrid;
