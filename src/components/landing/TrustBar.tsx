import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  MessageCircle, 
  MapPin, 
  Languages, 
  Truck, 
  Building2, 
  Users 
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

export const TrustBar: React.FC = () => {
  const { lang } = useLanguage();

  const stats = [
    {
      value: '540+',
      labelAr: 'آلية ثقيلة مسجلة',
      labelFr: 'Engins lourds référencés',
      icon: Truck,
    },
    {
      value: '40',
      labelAr: 'مدينة مغربية مغطاة',
      labelFr: 'Villes marocaines couvertes',
      icon: MapPin,
    },
    {
      value: '180+',
      labelAr: 'مالك ومقاول معتمد',
      labelFr: 'Propriétaires et loueurs vérifiés',
      icon: Users,
    },
    {
      value: '99%',
      labelAr: 'نسبة التزام بالمواعيد',
      labelFr: 'Taux de ponctualité sur chantier',
      icon: Building2,
    },
  ];

  const badges = [
    {
      titleAr: 'بيانات سحابية آمنة',
      titleFr: 'Données chiffrées & sécurisées',
      descAr: 'حفظ مستمر لعقودك وحساباتك',
      descFr: 'Sauvegarde continue de vos contrats',
      icon: ShieldCheck,
    },
    {
      titleAr: 'دعم فوري عبر واتساب',
      titleFr: 'Support WhatsApp dédié 7j/7',
      descAr: 'مرافقة مباشرة في الورش والميدان',
      descFr: 'Assistance directe pour vos urgences',
      icon: MessageCircle,
    },
    {
      titleAr: 'تغطية لكافة جهات المغرب',
      titleFr: 'Réseau 100% national marocain',
      descAr: 'من طنجة إلى الداخلة',
      descFr: 'De Tanger jusqu\'à Dakhla',
      icon: MapPin,
    },
    {
      titleAr: 'منصة ثنائية اللغة',
      titleFr: 'Plateforme bilingue FR / AR',
      descAr: 'عربية فصحى وفرنسية معتمدة',
      descFr: 'Arabe et français pour tous vos chantiers',
      icon: Languages,
    },
  ];

  return (
    <section className="bg-steel-900 border-b border-steel-800 text-white py-12 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: KPI Counters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-10 border-b border-steel-800"
        >
          {stats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="flex flex-col items-center sm:items-start text-center sm:text-start"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 rounded-lg bg-steel-800 text-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-3xl sm:text-4xl font-extrabold text-white latin-nums tracking-tight font-sans">
                    {s.value}
                  </span>
                </div>
                <span className="text-xs sm:text-sm text-steel-400 font-medium">
                  {lang === 'fr' ? s.labelFr : s.labelAr}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* Row 2: 4 Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-10"
        >
          {badges.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-steel-800/40 border border-steel-800 text-start"
              >
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {lang === 'fr' ? b.titleFr : b.titleAr}
                  </h4>
                  <p className="text-xs text-steel-400 mt-0.5">
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
