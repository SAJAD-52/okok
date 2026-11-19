import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Compass,
  Radar,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import heroExcavatorImg from '../../assets/images/hero_excavator_1795030081800.jpg';
import heroDumpTruckImg from '../../assets/images/hero_dump_truck_1795030081385.jpg';

export type PillarKey = 'clients' | 'owners' | 'drivers' | 'parts';

interface HeroSectionProps {
  onSelectPillar?: (pillar: PillarKey) => void;
  activePillar?: PillarKey | null;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onSelectPillar,
  activePillar,
}) => {
  const { lang, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [excavatorImgFailed, setExcavatorImgFailed] = useState(false);
  const [truckImgFailed, setTruckImgFailed] = useState(false);

  const handleScrollToSection = (pillar: PillarKey, sectionId: string) => {
    onSelectPillar?.(pillar);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative bg-ink text-white overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-14 lg:pb-20 border-b border-steel-800">
      {/* Architectural Blueprint Grid + Warm Gold Ambient Glow */}
      <div className="absolute inset-0 bg-industrial-grid opacity-30 pointer-events-none" />
      <div className="absolute top-1/3 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] sm:w-[760px] h-[340px] bg-primary/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 start-0 end-0 h-20 bg-gradient-to-t from-ink to-transparent pointer-events-none" />

      {/* Left Flanking Excavator Backdrop */}
      {!excavatorImgFailed && (
        <div className="hidden md:block absolute top-4 left-0 w-[300px] lg:w-[440px] xl:w-[520px] h-[270px] lg:h-[360px] pointer-events-none opacity-45 lg:opacity-60 select-none [mask-image:radial-gradient(ellipse_at_center,black_38%,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_38%,transparent_75%)]">
          <img
            src={heroExcavatorImg}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            onError={() => setExcavatorImgFailed(true)}
            className="w-full h-full object-cover object-center -scale-x-100 mix-blend-lighten contrast-110"
          />
        </div>
      )}

      {/* Right Flanking Dump Truck Backdrop */}
      {!truckImgFailed && (
        <div className="hidden md:block absolute top-4 right-0 w-[300px] lg:w-[440px] xl:w-[520px] h-[270px] lg:h-[360px] pointer-events-none opacity-45 lg:opacity-60 select-none [mask-image:radial-gradient(ellipse_at_center,black_38%,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_38%,transparent_75%)]">
          <img
            src={heroDumpTruckImg}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            onError={() => setTruckImgFailed(true)}
            className="w-full h-full object-cover object-center -scale-x-100 mix-blend-lighten contrast-110"
          />
        </div>
      )}

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-5xl mx-auto flex flex-col items-center">
          {/* Top Golden Kicker + Curved Arc */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center mb-4 w-full max-w-xl"
          >
            <span className="font-display text-lg sm:text-2xl lg:text-[1.95rem] font-black text-primary tracking-tight leading-snug">
              {lang === 'fr'
                ? "Tout l'univers des engins lourds... réuni ici."
                : 'كل عالم الآليات الثقيلة... يجتمع هنا.'}
            </span>
            <svg
              viewBox="0 0 500 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-56 sm:w-80 h-3.5 mt-1.5 text-primary"
              aria-hidden="true"
            >
              <path
                d="M10 14C150 2 350 2 490 14"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>

          {/* Main Poster Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-[1.65rem] sm:text-4xl lg:text-[2.9rem] font-black tracking-tight text-white leading-[1.42] sm:leading-[1.32] text-balance max-w-4xl"
          >
            {lang === 'fr' ? (
              <>
                <span className="block">La 1ère plateforme marocaine qui réunit</span>
                <span className="block">clients, loueurs d&apos;engins, chauffeurs</span>
                <span className="block text-primary mt-1">
                  et fournisseurs de pièces, au même endroit.
                </span>
              </>
            ) : (
              <>
                <span className="block">أول منصة مغربية تجمع</span>
                <span className="block">الزبائن وملاك الآليات والسائقين</span>
                <span className="block text-primary mt-0.5">
                  وموردي قطع الغيار، في مكان واحد.
                </span>
              </>
            )}
          </motion.h1>

          {/* Bottom Curved Golden Arc under Headline */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0.88 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl flex justify-center mt-3 mb-6 sm:mb-7"
          >
            <svg
              viewBox="0 0 600 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-64 sm:w-[460px] h-3.5 text-primary"
              aria-hidden="true"
            >
              <path
                d="M12 14C180 2 420 2 588 14"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>

          {/* 4-Pillar Interactive Scroll Navigation Frame */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-4xl"
          >
            <p className="text-xs sm:text-sm text-slate-300 font-medium mb-3">
              {lang === 'fr'
                ? 'Choisissez votre profil pour découvrir vos fonctionnalités dédiées :'
                : 'اضغط على فئتك لاكتشاف الميزات المخصصة لك في المنصة:'}
            </p>

            <div className="rounded-2xl border-2 border-primary bg-[#090F1D]/90 backdrop-blur-md shadow-[0_0_36px_rgba(255,180,0,0.14)] overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4">
                {/* 1. Clients Button -> #section-clients */}
                <button
                  type="button"
                  onClick={() => handleScrollToSection('clients', 'section-clients')}
                  aria-label={lang === 'fr' ? 'Découvrir les avantages Clients' : 'عرض ميزات الزبائن'}
                  className={`group relative flex flex-col items-center justify-center gap-2 py-5 px-3 transition-all cursor-pointer border-b border-e md:border-b-0 md:border-e-0 border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                    activePillar === 'clients'
                      ? 'bg-primary/15'
                      : 'hover:bg-primary/10 active:scale-[0.99]'
                  }`}
                >
                  <div className="h-11 flex items-center justify-center text-primary group-hover:-translate-y-0.5 transition-transform duration-150">
                    <svg viewBox="0 0 64 48" className="w-12 h-10 fill-current" aria-hidden="true">
                      <circle cx="32" cy="14" r="8" />
                      <path d="M18 39c0-7.2 6.3-13 14-13s14 5.8 14 13v2H18v-2z" />
                      <circle cx="14" cy="18" r="5.5" />
                      <path d="M4 39c0-5.2 4.3-9.5 9.8-9.8 1.5 0 3 .4 4.2 1-2.5 2.4-4 5.8-4 9.5v1.3H4V39z" />
                      <circle cx="50" cy="18" r="5.5" />
                      <path d="M60 39c0-5.2-4.3-9.5-9.8-9.8-1.5 0-3 .4-4.2 1 2.5 2.4 4 5.8 4 9.5v1.3H60V39z" />
                    </svg>
                  </div>
                  <span className="font-display text-sm sm:text-base font-black text-white group-hover:text-primary transition-colors whitespace-nowrap">
                    {lang === 'fr' ? 'Clients' : 'الزبائن'}
                  </span>
                  <span className="text-[11px] text-slate-400 group-hover:text-primary/90 flex items-center gap-1 whitespace-nowrap">
                    <span>{lang === 'fr' ? 'Voir les avantages' : 'عرض الميزات'}</span>
                    <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  </span>
                </button>

                {/* 2. Machinery Owners Button -> #section-owners */}
                <button
                  type="button"
                  onClick={() => handleScrollToSection('owners', 'section-owners')}
                  aria-label={lang === 'fr' ? "Découvrir les avantages Loueurs d'engins" : 'عرض ميزات مالكي الآليات'}
                  className={`group relative flex flex-col items-center justify-center gap-2 py-5 px-3 transition-all cursor-pointer border-b md:border-b-0 md:border-s border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                    activePillar === 'owners'
                      ? 'bg-primary/15'
                      : 'hover:bg-primary/10 active:scale-[0.99]'
                  }`}
                >
                  <div className="h-11 flex items-center justify-center text-primary group-hover:-translate-y-0.5 transition-transform duration-150">
                    <svg viewBox="0 0 64 48" className="w-14 h-10 fill-current" aria-hidden="true">
                      <rect x="6" y="34" width="32" height="8" rx="4" />
                      <circle cx="11" cy="38" r="2.2" fill="#090F1D" />
                      <circle cx="22" cy="38" r="2.2" fill="#090F1D" />
                      <circle cx="33" cy="38" r="2.2" fill="#090F1D" />
                      <path d="M10 32h22v-9c0-1.6-1.3-3-3-3h-8l-3 5H10v7z" />
                      <rect x="20" y="22" width="8" height="6" rx="1" fill="#090F1D" />
                      <path d="M31 24L43 9l5 2-9 14 7 6-4 3-11-10z" />
                      <path d="M47 11l9 13-3 5c-2.5 1-6-.5-7.5-3l3-4-4-7 2.5-4z" />
                    </svg>
                  </div>
                  <span className="font-display text-sm sm:text-base font-black text-white group-hover:text-primary transition-colors whitespace-nowrap">
                    {lang === 'fr' ? "Loueurs d'engins" : 'مالكو الآليات'}
                  </span>
                  <span className="text-[11px] text-slate-400 group-hover:text-primary/90 flex items-center gap-1 whitespace-nowrap">
                    <span>{lang === 'fr' ? 'Voir les avantages' : 'عرض الميزات'}</span>
                    <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  </span>
                </button>

                {/* 3. Drivers Button -> #section-drivers */}
                <button
                  type="button"
                  onClick={() => handleScrollToSection('drivers', 'section-drivers')}
                  aria-label={lang === 'fr' ? 'Découvrir les avantages Chauffeurs' : 'عرض ميزات السائقين'}
                  className={`group relative flex flex-col items-center justify-center gap-2 py-5 px-3 transition-all cursor-pointer border-e md:border-e-0 md:border-s border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                    activePillar === 'drivers'
                      ? 'bg-primary/15'
                      : 'hover:bg-primary/10 active:scale-[0.99]'
                  }`}
                >
                  <div className="h-11 flex items-center justify-center text-primary group-hover:-translate-y-0.5 transition-transform duration-150">
                    <svg viewBox="0 0 64 48" className="w-12 h-10 fill-current" aria-hidden="true">
                      <path d="M21 17c0-6.2 4.9-11 11-11s11 4.8 11 11H21z" />
                      <rect x="17" y="16" width="30" height="3.5" rx="1.7" />
                      <rect x="30" y="5" width="4" height="5" rx="1.5" />
                      <circle cx="32" cy="24" r="5.5" />
                      <path d="M18 42c0-6.6 6.3-11.5 14-11.5s14 4.9 14 11.5v2H18v-2z" />
                    </svg>
                  </div>
                  <span className="font-display text-sm sm:text-base font-black text-white group-hover:text-primary transition-colors whitespace-nowrap">
                    {lang === 'fr' ? 'Chauffeurs' : 'السائقون'}
                  </span>
                  <span className="text-[11px] text-slate-400 group-hover:text-primary/90 flex items-center gap-1 whitespace-nowrap">
                    <span>{lang === 'fr' ? 'Voir les avantages' : 'عرض الميزات'}</span>
                    <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  </span>
                </button>

                {/* 4. Spare Parts Suppliers Button -> #section-parts */}
                <button
                  type="button"
                  onClick={() => handleScrollToSection('parts', 'section-parts')}
                  aria-label={lang === 'fr' ? 'Découvrir les avantages Fournisseurs de pièces' : 'عرض ميزات موردي قطع الغيار'}
                  className={`group relative flex flex-col items-center justify-center gap-2 py-5 px-3 transition-all cursor-pointer md:border-s border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                    activePillar === 'parts'
                      ? 'bg-primary/15'
                      : 'hover:bg-primary/10 active:scale-[0.99]'
                  }`}
                >
                  <div className="h-11 flex items-center justify-center text-primary group-hover:-translate-y-0.5 transition-transform duration-150">
                    <svg viewBox="0 0 64 48" className="w-12 h-10" fill="none" aria-hidden="true">
                      <path
                        d="M32 6l3.2 4.2 5-.9 1.2 5 4.9 1.5-1 5 3.8 3.2-3 4.2 1.8 4.7-4.8 1.9-.3 5.1-5-.6-3.1 4-4.2-2.8-4.2 2.8-3.1-4-5 .6-.3-5.1-4.8-1.9 1.8-4.7-3-4.2 3.8-3.2-1-5 4.9-1.5 1.2-5 5 .9L32 6z"
                        className="fill-current"
                      />
                      <circle cx="32" cy="25" r="10" fill="#090F1D" />
                      <path
                        d="M27.5 29.5l7.2-7.2c-.5-1.5 0-3.2 1.2-4.3 1.1-1 2.7-1.2 4-.5l-2.3 2.3 1.6 1.6 2.3-2.3c.7 1.3.5 2.9-.5 4-1.1 1.2-2.8 1.7-4.3 1.2l-7.2 7.2c-.8.8-2 .8-2.8 0-.7-.8-.7-2 .8-2.8z"
                        className="fill-current"
                      />
                    </svg>
                  </div>
                  <span className="font-display text-sm sm:text-base font-black text-white group-hover:text-primary transition-colors text-center leading-tight whitespace-nowrap">
                    {lang === 'fr' ? 'Fournisseurs pièces' : 'موردو قطع الغيار'}
                  </span>
                  <span className="text-[11px] text-slate-400 group-hover:text-primary/90 flex items-center gap-1 whitespace-nowrap">
                    <span>{lang === 'fr' ? 'Voir les avantages' : 'عرض الميزات'}</span>
                    <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  </span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Primary Action + Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-7 w-full max-w-2xl"
          >
            <Link
              to="/auth?mode=signup"
              className="min-h-[48px] px-7 py-3 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-ink font-black text-sm sm:text-base shadow-yellow-glow transition-all flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span>
                {lang === 'fr' ? 'Créer mon compte en 30 secondes' : 'ابدأ التسجيل الآن في 30 ثانية'}
              </span>
              <ArrowIcon className="w-4 h-4 shrink-0" />
            </Link>

            <Link
              to="/marketplace"
              className="min-h-[48px] px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Compass className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Explorer le marché' : 'تصفح سوق الآليات'}</span>
            </Link>

            <Link
              to="/tenders"
              className="min-h-[48px] px-5 py-3 rounded-xl bg-slate-900/70 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Radar className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Radar Marchés Publics' : 'رادار الصفقات'}</span>
            </Link>
          </motion.div>

          {/* Clean Unboxed Trust Line */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.32 }}
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-5 text-xs sm:text-sm text-slate-300 font-medium"
          >
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Gratuit pour clients & chauffeurs' : 'مجاني للزبناء والسائقين'}</span>
            </span>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? '3 jours gratuits pour les loueurs' : '3 أيام تجربة مجانية لملاك الآليات'}</span>
            </span>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? '0% de commission' : '0% عمولة على المعاملات'}</span>
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
