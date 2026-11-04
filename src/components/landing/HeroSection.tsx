import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  Bell, 
  ShieldCheck, 
  ChevronRight, 
  Wrench, 
  Truck, 
  Calendar 
} from 'lucide-react';
import { DualCtaRow } from './DualCtaRow';
import { useLanguage } from '../../hooks/useLanguage';

export const HeroSection: React.FC = () => {
  const { lang } = useLanguage();
  const [seconds, setSeconds] = useState(42);

  // Subtle countdown tick for visual life in mockup
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 59));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative bg-ink text-white overflow-hidden pt-10 pb-20 lg:pt-16 lg:pb-28 border-b border-steel-800">
      {/* Ambient Grid Pattern & Safety Yellow Glow */}
      <div className="absolute inset-0 bg-industrial-grid opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-primary/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 start-0 end-0 h-24 bg-gradient-to-t from-ink to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content Column */}
        <div className="text-center max-w-4xl mx-auto flex flex-col items-center">
          {/* Top Trust Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-steel-900/90 border border-steel-700/80 text-xs font-semibold text-primary mb-6 shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>
              {lang === 'fr'
                ? 'Place de marché B2B & Logiciel de gestion d\'engins au Maroc'
                : 'المنصة الأولى لإدارة وتأجير آليات الأشغال العمومية بالمغرب'}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.15] text-balance mb-6"
          >
            {lang === 'fr' ? (
              <>
                Gérez votre parc, louez, vendez et trouvez vos{' '}
                <span className="text-primary underline decoration-primary/40 decoration-4 underline-offset-8">
                  pièces de chantier
                </span>{' '}
                en toute sérénité
              </>
            ) : (
              <>
                إدارة أسطولك، كراء وبيع الآلات، و{' '}
                <span className="text-primary underline decoration-primary/40 decoration-4 underline-offset-8">
                  قطع الغيار
                </span>{' '}
                بكل احترافية
              </>
            )}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-steel-300 max-w-2xl leading-relaxed mb-8"
          >
            {lang === 'fr'
              ? 'La solution digitale pensée pour les entrepreneurs marocains : réservations automatisées avec compte à rebours, contrats certifiés, vitrine dédiée et réseau national de 40 villes.'
              : 'الحل الرقمي المصمم للمقاولين وأصحاب المعدات بالمغرب: تتبع فترات الكراء بمؤقت زمني دقيق، عقود رقمية معتمدة، صفحة خاصة بشركتك، وتغطية تمتد لـ 40 مدينة مغربية.'}
          </motion.p>

          {/* Dual CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-full"
          >
            <DualCtaRow centered={true} />
          </motion.div>

          {/* Trust Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 pt-6 text-xs sm:text-sm text-steel-400 font-medium"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Essai gratuit 3 jours' : 'تجربة مجانية 3 أيام'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Sans carte bancaire' : 'بدون بطاقة بنكية'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Inscription avec n° téléphone' : 'بدون بريد إلكتروني معقد'}</span>
            </div>
          </motion.div>
        </div>

        {/* CSS-Built Dashboard Mockup with Floating Interactive Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-14 sm:mt-20 relative max-w-5xl mx-auto"
        >
          {/* Main Dashboard Window Container */}
          <div className="relative rounded-2xl sm:rounded-3xl bg-ink-card border border-steel-700/80 p-3 sm:p-6 shadow-2xl overflow-hidden">
            {/* Top Window Bar */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-steel-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-steel-500 ms-2 hidden sm:inline">
                  app.jadijcb.ma/dashboard
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  {lang === 'fr' ? 'Abonnement Actif · 72h Essai' : 'اشتراك نشط · تجربة 72 ساعة'}
                </span>
              </div>
            </div>

            {/* Simulated Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Stat 1: Revenue in MAD */}
              <div className="p-4 rounded-xl bg-steel-900/60 border border-steel-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-steel-400 font-medium">
                    {lang === 'fr' ? 'Revenus du mois (MAD)' : 'مداخيل الكراء الشهرية'}
                  </span>
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-black text-white latin-nums tracking-tight font-sans">
                    148 500 <span className="text-xs font-normal text-primary">MAD</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 mt-1 inline-block">
                    {lang === 'fr' ? '+24% vs mois dernier' : '+24% مقارنة بالشهر الماضي'}
                  </span>
                </div>
              </div>

              {/* Stat 2: Active fleet */}
              <div className="p-4 rounded-xl bg-steel-900/60 border border-steel-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-steel-400 font-medium">
                    {lang === 'fr' ? 'Engins en mission active' : 'آليات قيد التشغيل بالورش'}
                  </span>
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <Truck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-black text-white latin-nums tracking-tight font-sans">
                    8 / 11 <span className="text-xs font-normal text-steel-400">{lang === 'fr' ? 'actifs' : 'نشطة'}</span>
                  </div>
                  <span className="text-[11px] text-primary mt-1 inline-block">
                    {lang === 'fr' ? 'Taux d\'utilisation : 73%' : 'نسبة تشغيل الأسطول: 73%'}
                  </span>
                </div>
              </div>

              {/* Stat 3: Direct Inquiries */}
              <div className="p-4 rounded-xl bg-steel-900/60 border border-steel-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-steel-400 font-medium">
                    {lang === 'fr' ? 'Demandes de devis' : 'طلبات الكراء المباشرة'}
                  </span>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl sm:text-3xl font-black text-white latin-nums tracking-tight font-sans">
                    14 <span className="text-xs font-normal text-steel-400">{lang === 'fr' ? 'nouvelles' : 'جديدة'}</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 mt-1 inline-block">
                    {lang === 'fr' ? '3 confirmées aujourd\'hui' : '3 مؤكدة اليوم عبر واتساب'}
                  </span>
                </div>
              </div>
            </div>

            {/* Simulated Live Rental Row */}
            <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-steel-900/80 border border-steel-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="text-start">
                  <div className="text-sm font-bold text-white">
                    JCB 3CX Eco · {lang === 'fr' ? 'Chantier Tramway Casablanca' : 'ورش الترامواي الدار البيضاء'}
                  </div>
                  <div className="text-xs text-steel-400 flex items-center gap-2 mt-0.5">
                    <span>{lang === 'fr' ? 'Client: Travaux Océan SARL' : 'العميل: مقاولة أوشن'}</span>
                    <span>·</span>
                    <span className="text-primary font-mono latin-nums">1 800 MAD / {lang === 'fr' ? 'jour' : 'يوم'}</span>
                  </div>
                </div>
              </div>

              {/* Countdown badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink border border-steel-700 text-xs text-primary font-mono font-bold latin-nums self-end sm:self-auto">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>04d 18h 32m {seconds}s</span>
              </div>
            </div>
          </div>

          {/* Floating Card 1: Revenue Surge (Top-Start) */}
          <motion.div
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute -top-6 start-2 sm:-start-6 hidden sm:flex items-center gap-3 p-3.5 rounded-2xl bg-steel-900/95 border border-primary/40 shadow-xl backdrop-blur-md text-start z-10"
          >
            <div className="w-9 h-9 rounded-xl bg-primary text-ink flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-steel-400 tracking-wider">
                {lang === 'fr' ? 'Virement RIB Validé' : 'تحويل بنكي مؤكد'}
              </div>
              <div className="text-sm font-extrabold text-white latin-nums font-sans">
                +42 000 MAD
              </div>
            </div>
          </motion.div>

          {/* Floating Card 2: New WhatsApp Request (Bottom-End) */}
          <motion.div
            animate={{
              y: [0, 8, 0],
            }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.5,
            }}
            className="absolute -bottom-6 end-2 sm:-end-6 hidden sm:flex items-center gap-3 p-3.5 rounded-2xl bg-steel-900/95 border border-emerald-500/40 shadow-xl backdrop-blur-md text-start z-10"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                {lang === 'fr' ? 'Nouveau Devis BTP' : 'طلب كراء جديد'}
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
