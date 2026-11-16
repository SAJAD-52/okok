import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  PlusCircle,
  CheckCircle2,
  MapPin,
  Radio,
  Truck,
} from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const HowItWorksSection: React.FC = () => {
  const { lang } = useLanguage();
  const [roleTab, setRoleTab] = useState<'owner' | 'contractor'>('owner');

  const ownerSteps = [
    {
      num: '01',
      titleAr: 'سجل في 30 ثانية برقم هاتفك أو واتساب',
      titleFr: 'Inscrivez-vous en 30s avec votre téléphone',
      descAr:
        'بدون بريد إلكتروني أو أوراق معقدة وبدون بطاقة بنكية. تنطلق تجربتك المجانية لـ 3 أيام فوراً.',
      descFr:
        'Sans paperasse ni carte bancaire. Votre essai gratuit de 72h démarre immédiatement avec votre numéro marocain.',
      icon: MessageCircle,
    },
    {
      num: '02',
      titleAr: 'أضف آلياتك أو قطع الغيار وحدد أسعارك',
      titleFr: 'Publiez vos engins ou pièces et vos tarifs',
      descAr:
        'ارفع الصور، المدينة، السعر بالساعة أو اليوم أو سعر البيع، وحدد توفر السائق والتوصيل بـ Porte-Char.',
      descFr:
        'Ajoutez photos, ville, tarif horaire/jour ou prix de vente, option chauffeur et livraison porte-char.',
      icon: PlusCircle,
    },
    {
      num: '03',
      titleAr: 'استقبل طلبات الأوراش واربح بدون عمولة',
      titleFr: 'Recevez des demandes qualifiées à 0% commission',
      descAr:
        'تفاعل مع تنبيهات الرادار القريبة وتواصل مباشرة مع أصحاب الأوراش عبر الدردشة أو واتساب بعقود موثقة.',
      descFr:
        'Répondez aux alertes radar locales, échangez en direct et sécurisez vos locations par contrat conforme.',
      icon: CheckCircle2,
    },
  ];

  const contractorSteps = [
    {
      num: '01',
      titleAr: 'افتح حساب زبون مجاناً في 30 ثانية',
      titleFr: 'Créez votre compte client gratuit en 30s',
      descAr:
        'سواء كنت مقاولة، فلاحاً، مهنياً أو فرداً، التسجيل سريع برقم الهاتف ومجاني بالكامل في جميع مدن المغرب.',
      descFr:
        'Entreprise, agriculteur, artisan ou particulier : inscription express par téléphone et accès 100% gratuit.',
      icon: MessageCircle,
    },
    {
      num: '02',
      titleAr: 'أضف موقع عملك أو ابحث في الرادار والسوق',
      titleFr: 'Ajoutez votre site ou explorez le Radar GPS',
      descAr:
        'حدد موقع ضيعتك، بقعتك الأرضية أو ورشك، واعثر على أقرب JCB أو حفارة أو أرسل طلباً جماعياً للملاك القريبين.',
      descFr:
        'Repérez les engins et pièces les plus proches de votre ferme, terrain ou chantier et lancez une alerte directe.',
      icon: MapPin,
    },
    {
      num: '03',
      titleAr: 'اتفق مباشرة مع المالك وتابع الآلية حتى موقعك',
      titleFr: 'Confirmez en direct & suivez la mise à disposition',
      descAr:
        'تواصل بدون وسطاء عبر الدردشة أو واتساب، وتابع المدة والحجوزات مباشرة من هاتفك.',
      descFr:
        'Échangez sans intermédiaire, validez les conditions et suivez votre location directement depuis votre mobile.',
      icon: Radio,
    },
  ];

  const steps = roleTab === 'owner' ? ownerSteps : contractorSteps;

  return (
    <section className="py-14 sm:py-20 lg:py-24 bg-surface border-b border-steel-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-primary-dark">
            {lang === 'fr' ? 'Démarrage rapide en 30 secondes' : 'البدء السريع في 3 خطوات'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-2.5 leading-tight text-balance">
            {lang === 'fr'
              ? 'Comment ça marche sur JADIJCB ?'
              : 'كيف تبدأ سواء كنت مالك آليات أو زبوناً؟'}
          </h2>
          <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed">
            {lang === 'fr'
              ? 'Un parcours ultra-rapide pensé pour le téléphone et le bureau, sans perte de temps.'
              : 'مسار سريع وبسيط يشتغل بسلاسة على الهاتف والحاسوب لإتمام الحجز أو استقبال الطلبات في دقائق.'}
          </p>

          {/* Role Toggle */}
          <div className="mt-7 flex justify-center">
            <div className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1.5 p-1.5 bg-white rounded-xl border border-steel-200 shadow-sm w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setRoleTab('owner')}
                className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  roleTab === 'owner'
                    ? 'bg-primary text-ink shadow-sm'
                    : 'text-steel-700 hover:text-ink hover:bg-steel-50'
                }`}
              >
                <Truck className="w-4 h-4 shrink-0" />
                <span>{lang === 'fr' ? 'Je loue / vends mes engins' : 'أنا مالك آليات / قطع غيار'}</span>
              </button>
              <button
                type="button"
                onClick={() => setRoleTab('contractor')}
                className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  roleTab === 'contractor'
                    ? 'bg-primary text-ink shadow-sm'
                    : 'text-steel-700 hover:text-ink hover:bg-steel-50'
                }`}
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{lang === 'fr' ? 'Je cherche un engin (Client)' : 'أبحث عن آلية (مقاولة، فلاح، فرد...)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Steps with Connecting Line */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Subtle Horizontal Desktop Connecting Line */}
          <div className="hidden md:block absolute top-1/3 start-1/6 end-1/6 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent z-0 pointer-events-none" />

          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={`${roleTab}-${idx}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="relative z-10 p-6 sm:p-7 rounded-2xl bg-white border border-steel-200/90 shadow-soft text-start flex flex-col justify-between"
              >
                <div>
                  {/* Step Number + Icon Badge */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-xl bg-primary text-ink flex items-center justify-center font-bold shadow-sm shrink-0">
                      <Icon className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <span className="text-3xl font-black latin-nums text-steel-300">
                      {s.num}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-ink mb-2 leading-snug">
                    {lang === 'fr' ? s.titleFr : s.titleAr}
                  </h3>
                  <p className="text-xs sm:text-sm text-steel-600 leading-relaxed">
                    {lang === 'fr' ? s.descFr : s.descAr}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Section Ending Dual CTA */}
        <DualCtaRow centered={true} className="mt-10 sm:mt-14" />
      </div>
    </section>
  );
};

export default HowItWorksSection;
