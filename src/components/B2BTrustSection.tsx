import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Clock, FileCheck2, Truck, Wrench, CheckCircle } from 'lucide-react';

export const B2BTrustSection: React.FC = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: Clock,
      titleKey: 'b2b_trust.feature1_title',
      descKey: 'b2b_trust.feature1_desc',
    },
    {
      icon: ShieldCheck,
      titleKey: 'b2b_trust.feature2_title',
      descKey: 'b2b_trust.feature2_desc',
    },
    {
      icon: Truck,
      titleKey: 'b2b_trust.feature3_title',
      descKey: 'b2b_trust.feature3_desc',
    },
    {
      icon: FileCheck2,
      titleKey: 'b2b_trust.feature4_title',
      descKey: 'b2b_trust.feature4_desc',
    },
  ];

  return (
    <section className="py-14 sm:py-20 bg-ink text-white relative overflow-hidden border-t border-steel/60">
      {/* Background hazard line accent */}
      <div className="absolute top-0 inset-x-0 h-1 bg-hazard-stripes opacity-70" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-steel/80 border border-primary/30 text-primary text-xs font-bold mb-3 shadow-soft">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span>{t('b2b_trust.badge')}</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
            {t('b2b_trust.title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="p-6 rounded-2xl bg-steel/40 border border-steel-light/30 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-ink transition-colors">
                  <Icon className="w-6 h-6 stroke-[2.2]" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mb-2">
                  {t(f.titleKey)}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {t(f.descKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
