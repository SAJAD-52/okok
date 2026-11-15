import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  MessageCircle,
  MapPin,
  Languages,
  Truck,
  Building2,
  Users,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

export const TrustBar: React.FC = () => {
  const { lang } = useLanguage();

  const stats = [
    {
      value: '540+',
      labelAr: 'آلية ثقيلة وقطعة غيار مسجلة',
      labelFr: 'Engins lourds & pièces référencés',
      icon: Truck,
    },
    {
      value: '40',
      labelAr: 'مدينة مغربية مغطاة بالرادار',
      labelFr: 'Villes marocaines couvertes',
      icon: MapPin,
    },
    {
      value: '180+',
      labelAr: 'مالك آليات ومقاول ورش معتمد',
      labelFr: 'Propriétaires et chantiers vérifiés',
      icon: Users,
    },
    {
      value: '99%',
      labelAr: 'نسبة الالتزام بمواعيد الورش',
      labelFr: 'Taux de ponctualité sur chantier',
      icon: Building2,
    },
  ];

  const badges = [
    {
      titleAr: 'بيانات وعقود سحابية آمنة',
      titleFr: 'Contrats & données sécurisées',
      descAr: 'حفظ مستمر لعقودك وفواتيرك برقم ICE',
      descFr: 'Sauvegarde continue de vos contrats B2B',
      icon: ShieldCheck,
    },
    {
      titleAr: 'ربط فوري عبر الدردشة وواتساب',
      titleFr: 'Contact direct & WhatsApp 7j/7',
      descAr: 'تواصل مباشر بين المالك وصاحب الورش بدون عمولة',
      descFr: 'Échange direct sans intermédiaire ni commission',
      icon: MessageCircle,
    },
    {
      titleAr: 'رادار يغطي كافة جهات المغرب',
      titleFr: 'Radar GPS sur tout le Royaume',
      descAr: 'من طنجة إلى الداخلة لتقريب الآلية للورش',
      descFr: 'De Tanger jusqu’à Dakhla en un clic',
      icon: MapPin,
    },
    {
      titleAr: 'منصة ثنائية اللغة وسريعة',
      titleFr: 'Bilingue FR / AR & Ultra Rapide',
      descAr: 'عربية وفرنسية تشتغل بسلاسة في الهاتف والحاسوب',
      descFr: 'Optimisée mobile & bureau sur tous chantiers',
      icon: Languages,
    },
  ];

  return (
    <section className="bg-[#0F172A] border-b border-slate-800 text-white py-10 sm:py-12 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: KPI Counters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 pb-8 sm:pb-10 border-b border-slate-800"
        >
          {stats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="flex flex-col items-center sm:items-start text-center sm:text-start"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-primary shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-2xl sm:text-4xl font-extrabold text-white latin-nums tracking-tight">
                    {s.value}
                  </span>
                </div>
                <span className="text-xs sm:text-sm text-slate-300 font-medium leading-snug">
                  {lang === 'fr' ? s.labelFr : s.labelAr}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* Row 2: 4 Trust Pillars */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 pt-8 sm:pt-10"
        >
          {badges.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 text-start"
              >
                <div className="p-2.5 rounded-xl bg-primary/15 text-primary shrink-0 mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white leading-snug">
                    {lang === 'fr' ? b.titleFr : b.titleAr}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {lang === 'fr' ? b.descFr : b.descAr}
                  </p>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default TrustBar;
