import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  TrendingUp,
  Clock,
  Bell,
  Wrench,
  Truck,
  Calendar,
  MapPin,
  Radio,
  ShieldCheck,
  Navigation,
} from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';
import heroExcavatorImg from '../../assets/images/hero_excavator_1795030081800.jpg';
import heroDumpTruckImg from '../../assets/images/hero_dump_truck_1795030081385.jpg';

export const HeroSection: React.FC = () => {
  const { lang } = useLanguage();
  const [seconds, setSeconds] = useState(42);
  const [activeView, setActiveView] = useState<'owner' | 'contractor'>('owner');

  // Subtle countdown tick for visual life in mockup
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 59));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative bg-ink text-white overflow-hidden pt-8 pb-14 sm:pt-12 sm:pb-20 lg:pt-16 lg:pb-24 border-b border-steel-800">
      {/* Ambient Grid Pattern & Safety Yellow Glow */}
      <div className="absolute inset-0 bg-industrial-grid opacity-30 pointer-events-none" />
      <div className="absolute top-1/4 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[720px] h-[340px] bg-primary/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 start-0 end-0 h-20 bg-gradient-to-t from-ink to-transparent pointer-events-none" />

      {/* Ambient Machinery Flanking Backgrounds (Excavator & Dump Truck blended into bg-ink) */}
      <div className="hidden md:block absolute top-6 left-0 w-[300px] lg:w-[430px] xl:w-[500px] h-[250px] lg:h-[340px] pointer-events-none opacity-45 lg:opacity-55 select-none [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_74%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_74%)]">
        <img
          src={heroExcavatorImg}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center -scale-x-100 mix-blend-lighten contrast-110"
        />
      </div>
      <div className="hidden md:block absolute top-6 right-0 w-[300px] lg:w-[430px] xl:w-[500px] h-[250px] lg:h-[340px] pointer-events-none opacity-45 lg:opacity-55 select-none [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_74%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_74%)]">
        <img
          src={heroDumpTruckImg}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center -scale-x-100 mix-blend-lighten contrast-110"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content Column */}
        <div className="text-center max-w-5xl mx-auto flex flex-col items-center">
          {/* Top Golden Kicker + Curved Arc */}
          <motion.div
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center mb-4 sm:mb-5 w-full max-w-xl"
          >
            <span className="font-display text-lg sm:text-2xl lg:text-[2rem] font-black text-primary tracking-tight leading-snug">
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
            initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-2xl sm:text-4xl lg:text-[2.85rem] font-black tracking-tight text-white leading-[1.45] sm:leading-[1.35] text-balance max-w-4xl"
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
            initial={{ opacity: 0, scaleX: 0.85 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.55, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl flex justify-center mt-3 mb-6"
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

          {/* 4-Role Golden Framed Showcase Bar (Clients · Owners · Drivers · Spare Parts) */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-4xl rounded-2xl border-2 border-primary bg-[#0B1120]/85 backdrop-blur-md shadow-[0_0_32px_rgba(255,180,0,0.12)] mb-6 overflow-hidden"
          >
            <div className="grid grid-cols-2 md:grid-cols-4">
              {/* 1. Clients */}
              <Link
                to="/marketplace"
                className="group flex flex-col items-center justify-center gap-2 py-4 px-3 hover:bg-primary/10 transition-colors border-b border-e md:border-b-0 md:border-e-0 border-primary/35"
              >
                <div className="h-11 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <svg viewBox="0 0 64 48" className="w-12 h-10 fill-current" aria-hidden="true">
                    <circle cx="32" cy="14" r="8" />
                    <path d="M18 39c0-7.2 6.3-13 14-13s14 5.8 14 13v2H18v-2z" />
                    <circle cx="14" cy="18" r="5.5" />
                    <path d="M4 39c0-5.2 4.3-9.5 9.8-9.8 1.5 0 3 .4 4.2 1-2.5 2.4-4 5.8-4 9.5v1.3H4V39z" />
                    <circle cx="50" cy="18" r="5.5" />
                    <path d="M60 39c0-5.2-4.3-9.5-9.8-9.8-1.5 0-3 .4-4.2 1 2.5 2.4 4 5.8 4 9.5v1.3H60V39z" />
                  </svg>
                </div>
                <span className="font-display text-sm sm:text-base font-black text-white group-hover:text-primary transition-colors">
                  {lang === 'fr' ? 'Clients' : 'الزبائن'}
                </span>
              </Link>

              {/* 2. Machinery Owners */}
              <Link
                to="/auth?mode=signup"
                className="group flex flex-col items-center justify-center gap-2 py-4 px-3 hover:bg-primary/10 transition-colors border-b md:border-b-0 md:border-s border-primary/35"
              >
                <div className="h-11 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <svg viewBox="0 0 64 48" className="w-14 h-10 fill-current" aria-hidden="true">
                    <rect x="6" y="34" width="32" height="8" rx="4" />
                    <circle cx="11" cy="38" r="2.2" fill="#0B1120" />
                    <circle cx="22" cy="38" r="2.2" fill="#0B1120" />
                    <circle cx="33" cy="38" r="2.2" fill="#0B1120" />
                    <path d="M10 32h22v-9c0-1.6-1.3-3-3-3h-8l-3 5H10v7z" />
                    <rect x="20" y="22" width="8" height="6" rx="1" fill="#0B1120" />
                    <path d="M31 24L43 9l5 2-9 14 7 6-4 3-11-10z" />
                    <path d="M47 11l9 13-3 5c-2.5 1-6-.5-7.5-3l3-4-4-7 2.5-4z" />
                  </svg>
                </div>
                <span className="font-display text-sm sm:text-base font-black text-white group-hover:text-primary transition-colors">
                  {lang === 'fr' ? "Loueurs d'engins" : 'مالكو الآليات'}
                </span>
              </Link>

              {/* 3. Drivers / Operators */}
              <Link
                to="/auth?mode=signup"
                className="group flex flex-col items-center justify-center gap-2 py-4 px-3 hover:bg-primary/10 transition-colors border-e md:border-e-0 md:border-s border-primary/35"
              >
                <div className="h-11 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <svg viewBox="0 0 64 48" className="w-12 h-10 fill-current" aria-hidden="true">
                    <path d="M21 17c0-6.2 4.9-11 11-11s11 4.8 11 11H21z" />
                    <rect x="17" y="16" width="30" height="3.5" rx="1.7" />
                    <rect x="30" y="5" width="4" height="5" rx="1.5" />
                    <circle cx="32" cy="24" r="5.5" />
                    <path d="M18 42c0-6.6 6.3-11.5 14-11.5s14 4.9 14 11.5v2H18v-2z" />
                  </svg>
                </div>
                <span className="font-display text-sm sm:text-base font-black text-white group-hover:text-primary transition-colors">
                  {lang === 'fr' ? 'Chauffeurs' : 'السائقون'}
                </span>
              </Link>

              {/* 4. Spare Parts Suppliers */}
              <Link
                to="/marketplace?section=spare_parts"
                className="group flex flex-col items-center justify-center gap-2 py-4 px-3 hover:bg-primary/10 transition-colors md:border-s border-primary/35"
              >
                <div className="h-11 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <svg viewBox="0 0 64 48" className="w-12 h-10" fill="none" aria-hidden="true">
                    <path
                      d="M32 6l3.2 4.2 5-.9 1.2 5 4.9 1.5-1 5 3.8 3.2-3 4.2 1.8 4.7-4.8 1.9-.3 5.1-5-.6-3.1 4-4.2-2.8-4.2 2.8-3.1-4-5 .6-.3-5.1-4.8-1.9 1.8-4.7-3-4.2 3.8-3.2-1-5 4.9-1.5 1.2-5 5 .9L32 6z"
                      className="fill-current"
                    />
                    <circle cx="32" cy="25" r="10" fill="#0B1120" />
                    <path
                      d="M27.5 29.5l7.2-7.2c-.5-1.5 0-3.2 1.2-4.3 1.1-1 2.7-1.2 4-.5l-2.3 2.3 1.6 1.6 2.3-2.3c.7 1.3.5 2.9-.5 4-1.1 1.2-2.8 1.7-4.3 1.2l-7.2 7.2c-.8.8-2 .8-2.8 0-.7-.8-.7-2 .8-2.8z"
                      className="fill-current"
                    />
                  </svg>
                </div>
                <span className="font-display text-sm sm:text-base font-black text-white group-hover:text-primary transition-colors text-center leading-tight">
                  {lang === 'fr' ? 'Fournisseurs de pièces' : 'موردو قطع الغيار'}
                </span>
              </Link>
            </div>
          </motion.div>

          {/* Copy Block + Highlighted Yellow Driver Question Pill */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl mx-auto space-y-3 mb-5 px-1"
          >
            <p className="text-sm sm:text-lg text-slate-100 leading-[1.85] font-bold">
              {lang === 'fr' ? (
                <>
                  Entreprise, professionnel ou particulier avec un terrain pour louer ou acheter un engin, ou vous avez du matériel{' '}
                  <span className="text-primary font-black">et des pièces de rechange ?</span>
                </>
              ) : (
                <>
                  سواء كنت مقاولة، مهنياً أو صاحب بقعة أرضية وبغيتي تكري، ولا تشري آلية فالحين، ولا عندك ماتريال{' '}
                  <span className="text-primary font-black">وقطع الغيار ؟</span>
                </>
              )}
            </p>

            <div>
              <span className="inline-flex items-center justify-center px-5 sm:px-7 py-2 rounded-full bg-primary text-ink font-black text-sm sm:text-lg shadow-yellow-glow">
                {lang === 'fr'
                  ? "Ou vous êtes chauffeur à la recherche d'un chantier ?"
                  : 'ولا انت شيفور كتقلب على خدمة ؟'}
              </span>
            </div>

            <p className="text-sm sm:text-lg text-slate-200 font-bold leading-relaxed">
              {lang === 'fr'
                ? 'Inscrivez-vous par téléphone en 30 secondes, sans paperasse, et trouvez la machine la plus proche de votre site !'
                : (
                  <>
                    تسجّل بنمرة التليفون فـ 30 ثانية، بلا أوراق معقدة، ولقى أقرب آلية لموقعك{' '}
                    <span className="text-primary font-black">في البلاصة!</span>
                  </>
                )}
            </p>
          </motion.div>

          {/* Dual CTA */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl"
          >
            <DualCtaRow centered={true} />
          </motion.div>

          {/* Trust Row with Staggered Reveal */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 pt-6 text-xs sm:text-sm text-slate-300 font-medium"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Inscription en 30s par téléphone' : 'تسجيل فـ 30 ثانية برقم الهاتف'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Gratuit pour tous les clients' : 'مجاني 100% لجميع الزبناء'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? '3 jours gratuits pour les loueurs' : '3 أيام تجربة مجانية لملاك الآليات'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? '0% de commission' : '0% عمولة على المعاملات'}</span>
            </div>
          </motion.div>
        </div>

        {/* Interactive Dual-Workspace Preview Window */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.32 }}
          className="mt-10 sm:mt-16 relative max-w-5xl mx-auto"
        >
          {/* Interactive Role Switcher Tabs above Preview */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1.5 p-1.5 rounded-2xl bg-[#0F172A] border border-slate-700/90 shadow-lg w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveView('owner')}
                className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  activeView === 'owner'
                    ? 'bg-primary text-ink shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Truck className="w-4 h-4 shrink-0" />
                <span>{lang === 'fr' ? 'Espace Propriétaire & Loueur' : 'فضاء ملاك الآليات والموردين'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('contractor')}
                className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  activeView === 'contractor'
                    ? 'bg-primary text-ink shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Radio className="w-4 h-4 shrink-0" />
                <span>{lang === 'fr' ? 'Espace Client & Radar GPS' : 'فضاء الزبون (مقاولة، فلاح، فرد...)'}</span>
              </button>
            </div>
          </div>

          {/* Main Window Container */}
          <div className="relative rounded-2xl sm:rounded-3xl bg-[#0F172A] border border-slate-700/80 p-3.5 sm:p-6 shadow-2xl overflow-hidden">
            {/* Top Window Bar */}
            <div className="flex items-center justify-between gap-3 pb-3.5 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-slate-400 ms-2 hidden sm:inline">
                  {activeView === 'owner' ? 'app.jadijcb.ma/owner' : 'app.jadijcb.ma/entreprise/map'}
                </span>
              </div>
              <div className="text-[11px] sm:text-xs px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/25 truncate">
                {activeView === 'owner'
                  ? lang === 'fr'
                    ? 'Abonnement Actif · 72h Essai'
                    : 'اشتراك نشط · تجربة 72 ساعة'
                  : lang === 'fr'
                  ? 'Radar Actif · 14 engins à proximité'
                  : 'رادار مباشر · 14 آلية قريبة من ورشك'}
              </div>
            </div>

            {activeView === 'owner' ? (
              <>
                {/* Owner Dashboard Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {/* Stat 1 */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between text-start">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300 font-medium">
                        {lang === 'fr' ? 'Revenus du mois (MAD)' : 'مداخيل الكراء الشهرية'}
                      </span>
                      <div className="p-1.5 rounded-lg bg-primary/15 text-primary shrink-0">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl sm:text-3xl font-black text-white latin-nums tracking-tight">
                        148 500 <span className="text-xs font-semibold text-primary">MAD</span>
                      </div>
                      <span className="text-[11px] text-emerald-400 mt-1 inline-block">
                        {lang === 'fr' ? '+24% vs mois dernier' : '+24% مقارنة بالشهر الماضي'}
                      </span>
                    </div>
                  </div>

                  {/* Stat 2 */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between text-start">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300 font-medium">
                        {lang === 'fr' ? 'Engins en mission active' : 'آليات قيد التشغيل بالورش'}
                      </span>
                      <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 shrink-0">
                        <Truck className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl sm:text-3xl font-black text-white latin-nums tracking-tight">
                        8 / 11 <span className="text-xs font-medium text-slate-400">{lang === 'fr' ? 'actifs' : 'نشطة'}</span>
                      </div>
                      <span className="text-[11px] text-primary mt-1 inline-block">
                        {lang === 'fr' ? 'Taux d\'utilisation : 73%' : 'نسبة تشغيل الأسطول: 73%'}
                      </span>
                    </div>
                  </div>

                  {/* Stat 3 */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between text-start">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300 font-medium">
                        {lang === 'fr' ? 'Alertes chantiers urgentes' : 'تنبيهات الأوراش القريبة'}
                      </span>
                      <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl sm:text-3xl font-black text-white latin-nums tracking-tight">
                        14 <span className="text-xs font-medium text-slate-400">{lang === 'fr' ? 'demandes' : 'طلب عاجل'}</span>
                      </div>
                      <span className="text-[11px] text-emerald-400 mt-1 inline-block">
                        {lang === 'fr' ? '3 confirmées aujourd\'hui' : '3 عقود مؤكدة اليوم عبر واتساب'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Rental Row */}
                <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div className="text-start">
                      <div className="text-sm font-bold text-white">
                        JCB 3CX Eco · {lang === 'fr' ? 'Chantier Tramway Casablanca' : 'ورش الترامواي الدار البيضاء'}
                      </div>
                      <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2 mt-0.5">
                        <span>{lang === 'fr' ? 'Client: Travaux Océan SARL' : 'المقاولة: أشغال المحيط SARL'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-primary font-mono latin-nums font-bold">1 800 MAD / {lang === 'fr' ? 'jour' : 'يوم'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Countdown badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink border border-slate-700 text-xs text-primary font-mono font-bold latin-nums self-start sm:self-auto">
                    <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>04d 18h 32m {String(seconds).padStart(2, '0')}s</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Contractor / Site Owner Radar Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {/* Nearby Machine 1 */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between text-start">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-primary font-bold flex items-center gap-1">
                        <Navigation className="w-3.5 h-3.5" />
                        <span className="latin-nums">2.8 km</span>
                      </span>
                      <span className="text-[11px] text-emerald-400 font-semibold">
                        {lang === 'fr' ? 'Disponible' : 'متوفرة الآن'}
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <div className="text-sm font-bold text-white">JCB 3CX Eco (2022)</div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {lang === 'fr' ? 'Avec chauffeur · Livraison Porte-Char' : 'مع سائق معتمد · توصيل للورش'}
                      </p>
                      <div className="mt-3 text-base font-black text-primary font-mono latin-nums">
                        1 800 MAD <span className="text-[11px] font-normal text-slate-400">/ {lang === 'fr' ? 'jour' : 'يوم'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Nearby Machine 2 */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between text-start">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-primary font-bold flex items-center gap-1">
                        <Navigation className="w-3.5 h-3.5" />
                        <span className="latin-nums">5.4 km</span>
                      </span>
                      <span className="text-[11px] text-emerald-400 font-semibold">
                        {lang === 'fr' ? 'Disponible' : 'متوفرة الآن'}
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <div className="text-sm font-bold text-white">Pelle CAT 320D (22T)</div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {lang === 'fr' ? 'Carburant inclus · Ligne BRH' : 'الوقود مشمول · مجهزة بمطرقة BRH'}
                      </p>
                      <div className="mt-3 text-base font-black text-primary font-mono latin-nums">
                        3 200 MAD <span className="text-[11px] font-normal text-slate-400">/ {lang === 'fr' ? 'jour' : 'يوم'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Spare Parts Express */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between text-start">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-amber-300 font-bold flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>{lang === 'fr' ? 'Pièces Express' : 'قطع غيار سريعة'}</span>
                      </span>
                      <span className="text-[11px] text-slate-300">
                        {lang === 'fr' ? 'En stock' : 'متوفرة'}
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <div className="text-sm font-bold text-white">
                        {lang === 'fr' ? 'Kit Filtres & Flexibles JCB' : 'طقم فلاتر وخراطيم هيدروليك JCB'}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {lang === 'fr' ? 'Expédition directe sur chantier' : 'إرسال مباشر لموقع الورش'}
                      </p>
                      <div className="mt-3 text-base font-black text-white font-mono latin-nums">
                        650 MAD
                      </div>
                    </div>
                  </div>
                </div>

                {/* Broadcast Action Row */}
                <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="text-start">
                      <div className="text-sm font-bold text-white">
                        {lang === 'fr'
                          ? 'Besoin urgent sur chantier ? Lancez une alerte radar'
                          : 'عندك طلب مستعجل في الورش؟ أرسل إشارة رادار للملاك القريبين'}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">
                        {lang === 'fr'
                          ? 'Les propriétaires dans un rayon de 30 km reçoivent votre demande instantanément.'
                          : 'جميع الملاك في دائرة 30 كلم يتوصلون بطلبك فوراً ويقترحون عليك أحسن سعر.'}
                      </div>
                    </div>
                  </div>

                  <Link
                    to="/marketplace"
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-ink text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors"
                  >
                    {lang === 'fr' ? 'Ouvrir le Radar' : 'فتح الرادار والسوق'}
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Floating Card 1 (Desktop lg+ only so zero clipping on mobile/tablet) */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-6 -start-4 hidden lg:flex items-center gap-3 p-3.5 rounded-2xl bg-[#0F172A]/95 border border-primary/40 shadow-xl backdrop-blur-md text-start z-10"
          >
            <div className="w-9 h-9 rounded-xl bg-primary text-ink flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {lang === 'fr' ? 'Contrat B2B ICE' : 'عقد كراء موثق ICE'}
              </div>
              <div className="text-sm font-extrabold text-white latin-nums">
                +42 000 MAD
              </div>
            </div>
          </motion.div>

          {/* Floating Card 2 (Desktop lg+ only) */}
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute -bottom-6 -end-4 hidden lg:flex items-center gap-3 p-3.5 rounded-2xl bg-[#0F172A]/95 border border-emerald-500/40 shadow-xl backdrop-blur-md text-start z-10"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                {lang === 'fr' ? 'Alerte Radar Chantier' : 'تنبيه طلب ورش قريب'}
              </div>
              <div className="text-xs font-bold text-white">
                {lang === 'fr' ? 'Pelle CAT 320D · Tanger Med' : 'حفارة CAT 320D · طنجة'}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
