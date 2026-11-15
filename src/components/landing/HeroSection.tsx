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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content Column */}
        <div className="text-center max-w-4xl mx-auto flex flex-col items-center">
          {/* Unboxed Clean Kicker */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-bold text-primary mb-4 sm:mb-5"
          >
            <span>
              {lang === 'fr'
                ? 'Réseau B2B Maroc · 40 villes · Engins & Pièces'
                : 'شبكة B2B بالمغرب · 40 مدينة · كراء وبيع الآليات وقطع الغيار'}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="text-2xl sm:text-4xl lg:text-[3.1rem] font-black tracking-tight text-white leading-[1.25] sm:leading-[1.2] text-balance mb-5"
          >
            {lang === 'fr' ? (
              <>
                La 1ère plateforme marocaine qui réunit{' '}
                <span className="text-primary underline decoration-primary/40 decoration-4 underline-offset-8">
                  chantiers, propriétaires d&apos;engins BTP
                </span>{' '}
                et pièces de rechange
              </>
            ) : (
              <>
                أول منصة مغربية تجمع بين أصحاب الأوراش وملاك{' '}
                <span className="text-primary underline decoration-primary/40 decoration-4 underline-offset-8">
                  آليات الأشغال العمومية وقطع الغيار
                </span>
              </>
            )}
          </motion.h1>

          {/* Subheadline in Moroccan Darija (addressed to both owners & clients, expressing speed) */}
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="text-sm sm:text-lg text-slate-200 max-w-3xl leading-relaxed mb-6 px-1"
          >
            {lang === 'fr'
              ? 'Vous gérez un chantier à la recherche d’un engin immédiat ou vous possédez du matériel BTP et des pièces ? Inscrivez-vous par téléphone en 30 secondes, sans paperasse, et trouvez ou louez instantanément.'
              : 'عندك ورش وبغيتي تكري ولا تشري آلية فالحين، ولا عندك ماتريال وقطع الغيار وبغيتي تخدمهم؟ تسجّل غير بنمرة التليفون والواتساب فـ 30 ثانية، بلا أوراق معقدة، وخدم أسطولك ولا لقى أقرب آلية لورشك في البلاصة!'}
          </motion.p>

          {/* Dual CTA */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.24 }}
            className="w-full max-w-2xl"
          >
            <DualCtaRow centered={true} />
          </motion.div>

          {/* Trust Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 pt-6 text-xs sm:text-sm text-slate-300 font-medium"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Inscription en 30s par téléphone' : 'تسجيل فـ 30 ثانية برقم الهاتف'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Gratuit pour les chantiers' : 'مجاني 100% لأصحاب الأوراش'}</span>
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
                <span>{lang === 'fr' ? 'Espace Chantier & Radar GPS' : 'فضاء أصحاب الأوراش (رادار الأوراش)'}</span>
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
