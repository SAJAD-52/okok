import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Boxes,
  CheckCircle2,
  Compass,
  FileCheck2,
  HardHat,
  LayoutDashboard,
  MapPin,
  MapPinned,
  PackageSearch,
  PauseCircle,
  QrCode,
  Radar,
  ShieldCheck,
  Store,
  Truck,
  UserCheck,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { PillarKey } from './HeroSection';
import { OwnerPhoneShowcase } from './OwnerPhoneShowcase';
import heroExcavatorImg from '../../assets/images/hero_excavator_1795030081800.jpg';
import heroDumpTruckImg from '../../assets/images/hero_dump_truck_1795030081385.jpg';
import marrakechRadarImg from '../../assets/images/marrakech_radar_map_ui_1795124219885.jpg';

interface PillarShowcaseSectionsProps {
  activePillar?: PillarKey | null;
}

interface SignupStripProps {
  promptAr: string;
  promptFr: string;
  ctaAr: string;
  ctaFr: string;
  variant: 'light' | 'dark';
}

const SignupCtaStrip: React.FC<SignupStripProps> = ({
  promptAr,
  promptFr,
  ctaAr,
  ctaFr,
  variant,
}) => {
  const { lang, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const isDark = variant === 'dark';

  return (
    <div
      className={`border-y ${
        isDark
          ? 'bg-[#080E1A] border-slate-800 text-white'
          : 'bg-white border-steel-200 text-ink'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p
          className={`text-sm sm:text-base font-bold text-center sm:text-start ${
            isDark ? 'text-slate-200' : 'text-steel-800'
          }`}
        >
          {lang === 'fr' ? promptFr : promptAr}
        </p>

        <Link
          to="/auth?mode=signup"
          className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-ink font-black text-xs sm:text-sm shadow-sm hover:shadow-yellow-glow transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span>{lang === 'fr' ? ctaFr : ctaAr}</span>
          <ArrowIcon className="w-4 h-4 shrink-0" />
        </Link>
      </div>
    </div>
  );
};

export const PillarShowcaseSections: React.FC<PillarShowcaseSectionsProps> = ({
  activePillar,
}) => {
  const { lang, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [clientsImgErr, setClientsImgErr] = useState(false);
  const [ownerImgErr, setOwnerImgErr] = useState(false);
  const [partsImgErr, setPartsImgErr] = useState(false);

  return (
    <div className="flex flex-col">
      {/* =====================================================================
          01 · CLIENTS (CONTRACTORS, FARMERS, SITE OWNERS)
      ===================================================================== */}
      <section
        id="section-clients"
        className={`relative scroll-mt-20 py-14 sm:py-20 bg-surface text-ink overflow-hidden transition-shadow ${
          activePillar === 'clients' ? 'ring-2 ring-inset ring-primary/50' : ''
        }`}
      >
        {/* Radar & Topographic Backdrop */}
        <div
          className="absolute -top-24 -end-24 w-[460px] h-[460px] rounded-full border border-primary/20 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -top-8 -end-8 w-[300px] h-[300px] rounded-full border border-steel-300/60 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute top-0 start-0 w-full h-full opacity-35 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 20%, rgba(255,180,0,0.10), transparent 45%)',
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Content Column */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 flex flex-col justify-center text-start"
            >
              <div className="text-xs sm:text-sm font-extrabold text-primary-dark mb-2">
                {lang === 'fr'
                  ? '01 · Clients, Entreprises & Porteurs de Projets'
                  : '01 · الزبائن، المقاولات، الفلاحون وأصحاب المشاريع'}
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-black text-ink leading-tight text-balance">
                {lang === 'fr'
                  ? "Trouvez l'engin le plus proche de votre chantier en quelques minutes"
                  : 'اعثر على أقرب آلية لورشك في دقائق وبأفضل ثمن بدون عمولة'}
              </h2>
              <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed max-w-2xl">
                {lang === 'fr'
                  ? 'Consultez la disponibilité en direct sur la carte GPS, diffusez un besoin urgent aux loueurs voisins et protégez votre budget en cas de panne.'
                  : 'تصفح الآليات المتاحة حول ورشك على خريطة GPS، أرسل طلب بحث لجميع الملاك القريبين، وتابع مصاريفك وحماية العداد من هاتفك.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">
                {[
                  {
                    icon: MapPin,
                    titleAr: 'بحث في الخريطة GPS',
                    titleFr: 'Recherche sur carte GPS',
                    descAr: 'اكتشف الحفارات والجرافات والشاحنات القريبة من ورشك مع المسافة والتواصل المباشر.',
                    descFr: 'Repérez les machines disponibles autour de votre chantier avec distance exacte.',
                  },
                  {
                    icon: Radar,
                    titleAr: 'إرسال طلب للبحث في المنصة',
                    titleFr: 'Envoyer une demande sur la plateforme',
                    descAr: 'طلب واحد يصل في الحين لكل مالك مناسب في مدينتك لتقارن الأثمنة وتختار الأنسب.',
                    descFr: 'Un seul envoi alerte tous les propriétaires qualifiés de votre zone.',
                  },
                  {
                    icon: PauseCircle,
                    titleAr: 'إدارة للكراء مع المالك',
                    titleFr: 'Gestion de location avec le loueur',
                    descAr: 'محادثة مباشرة مع المالك في المنصة وتوليد عقد كراء وفواتير وإمكانية إشعاره بالأعطاب وتعليق الكراء إلى حين الإصلاح كي تحفظ ساعات الكراء.',
                    descFr: 'Discussion directe avec le loueur, génération de contrat et factures, signalement des pannes et suspension du décompte jusqu’à réparation pour préserver vos heures.',
                  },
                  {
                    icon: ShieldCheck,
                    titleAr: 'مجاني 100% وعقود موثقة',
                    titleFr: '100% gratuit & contrats clairs',
                    descAr: 'أسعار شفافة بالساعة واليوم والشهر، طلب التمديد عبر المنصة، وعقود وفواتير رسمية.',
                    descFr: 'Tarifs transparents, prolongation en ligne et documents B2B conformes.',
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white border border-steel-200 shadow-soft flex items-start gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-ink text-primary flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-ink leading-snug">
                          {lang === 'fr' ? item.titleFr : item.titleAr}
                        </h3>
                        <p className="text-xs text-steel-600 mt-1 leading-relaxed">
                          {lang === 'fr' ? item.descFr : item.descAr}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Visual Preview Card with Generated Marrakech GPS Radar + 3D Machine Showcase */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 flex"
            >
              <div className="w-full rounded-2xl bg-ink text-white border border-steel-800 p-4 sm:p-5 shadow-elevated flex flex-col justify-between text-start">
                <div>
                  <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
                    <div>
                      <span className="text-xs text-primary font-bold block">
                        {lang === 'fr' ? 'Carte GPS · Exemple Marrakech' : 'خريطة GPS مباشرة · مثال مراكش'}
                      </span>
                      <span className="text-sm sm:text-base font-black text-white">
                        {lang === 'fr'
                          ? 'Chantier entouré d’engins disponibles'
                          : 'ورشك محاط بالآليات المتاحة للكراء'}
                      </span>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Compass className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Generated 4:3 Marrakech Map & 3D JCB Showcase */}
                  <div className="relative mt-4 aspect-[4/3] rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900">
                    {!clientsImgErr ? (
                      <img
                        src={marrakechRadarImg}
                        alt={
                          lang === 'fr'
                            ? 'Interface carte GPS de Marrakech montrant le chantier et un engin JCB 3CX Eco en 3D disponible à la location'
                            : 'واجهة خريطة GPS مراكش تظهر ورش الزبون والآليات القريبة مع مجسم ثلاثي الأبعاد لآلية JCB 3CX Eco متاحة للكراء'
                        }
                        referrerPolicy="no-referrer"
                        onError={() => setClientsImgErr(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#0B1220] via-[#131F36] to-[#0B1220] flex flex-col items-center justify-center p-6 text-center">
                        <MapPin className="w-10 h-10 text-primary mb-2" />
                        <span className="text-sm font-black text-white">
                          {lang === 'fr' ? 'Carte GPS Marrakech · JCB 3CX Eco' : 'خريطة مراكش · JCB 3CX Eco'}
                        </span>
                        <span className="text-xs text-primary font-mono latin-nums mt-1">
                          1 800 MAD / {lang === 'fr' ? 'jour' : 'يوم'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {lang === 'fr' ? '0 MAD · Gratuit pour les clients' : '0 د.م · مجاني 100% للزبناء'}
                    </span>
                  </div>
                  <Link
                    to="/marketplace"
                    className="text-xs font-bold text-primary hover:underline whitespace-nowrap inline-flex items-center gap-1"
                  >
                    <span>{lang === 'fr' ? 'Ouvrir le marché' : 'تصفح السوق'}</span>
                    <ArrowIcon className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <SignupCtaStrip
        variant="light"
        promptAr="عندك ورش بناء، أشغال فلاحية أو مشروع وتبحث عن آلية موثوقة؟"
        promptFr="Vous avez un chantier ou un projet agricole et cherchez un engin fiable ?"
        ctaAr="سجل كزبون مجانا الآن"
        ctaFr="Créer un compte client gratuit"
      />

      {/* =====================================================================
          02 · MACHINERY OWNERS & FLEET RENTALS
      ===================================================================== */}
      <section
        id="section-owners"
        className={`relative scroll-mt-20 py-14 sm:py-20 bg-ink text-white overflow-hidden transition-shadow ${
          activePillar === 'owners' ? 'ring-2 ring-inset ring-primary/60' : ''
        }`}
      >
        <div className="absolute inset-0 bg-industrial-grid opacity-25 pointer-events-none" />
        <div
          className="absolute top-1/2 start-1/4 -translate-y-1/2 w-[480px] h-[320px] bg-primary/10 rounded-full blur-[130px] pointer-events-none"
          aria-hidden="true"
        />
        {!ownerImgErr && (
          <div className="hidden lg:block absolute bottom-0 start-0 w-[440px] h-[280px] opacity-20 pointer-events-none select-none [mask-image:radial-gradient(ellipse_at_bottom_left,black_30%,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_at_bottom_left,black_30%,transparent_75%)]">
            <img
              src={heroExcavatorImg}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              onError={() => setOwnerImgErr(true)}
              className="w-full h-full object-cover mix-blend-lighten"
            />
          </div>
        )}

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Visual Owner Mobile Dashboard & Incoming Rental Popups Card (Full Arabic) */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 order-2 lg:order-1 flex"
            >
              <OwnerPhoneShowcase />
            </motion.div>

            {/* Content Column */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 order-1 lg:order-2 flex flex-col justify-center text-start"
            >
              <div className="text-xs sm:text-sm font-extrabold text-primary mb-2">
                {lang === 'fr'
                  ? "02 · Propriétaires & Loueurs d'Engins"
                  : '02 · مالكو الآليات، الجرافات والشاحنات'}
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-black text-white leading-tight text-balance">
                {lang === 'fr'
                  ? 'Des clients vous recherchent, recevez des alertes directes et recrutez des chauffeurs prêts à démarrer'
                  : 'زبناء يبحثون عنك، تصلك إشعارات مباشرة من الباحثين عن آلياتك، وسائقون ينتظرون أن ترسل لهم'}
              </h2>
              <p className="text-sm sm:text-base text-slate-300 mt-3 leading-relaxed max-w-2xl">
                {lang === 'fr'
                  ? 'Recevez les demandes de chantiers voisins, accédez aux marchés publics attribués et émettez vos contrats et factures en un clic.'
                  : 'توصل بطلبات الأوراش القريبة، استكشف الشركات الفائزة بالصفقات العمومية، وأصدر عقودك وفواتيرك بضغطة زر.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">
                {[
                  {
                    icon: LayoutDashboard,
                    titleAr: 'لوحة تحكم شاملة للأعمال',
                    titleFr: 'Tableau de bord complet',
                    descAr: 'تظهر كل شيء في مكان واحد: طلبات الكراء، الزبناء، رقم المعاملات، المصاريف والأرباح الصافية.',
                    descFr: 'Centralisez demandes de location, clients, chiffre d’affaires, dépenses et bénéfices nets.',
                  },
                  {
                    icon: MapPinned,
                    titleAr: 'استعراض الأسطول على الخريطة',
                    titleFr: 'Affichage de la flotte sur carte',
                    descAr: 'اعرض آلياتك المتاحة على خريطة المغرب التفاعلية ليراها الزبناء القريبون منك ويتواصلوا معك مباشرة.',
                    descFr: 'Positionnez vos engins disponibles sur la carte interactive pour capter les chantiers voisins.',
                  },
                  {
                    icon: QrCode,
                    titleAr: 'متجر إلكتروني خاص + QR Code',
                    titleFr: 'Vitrine dédiée + QR Code',
                    descAr: 'رابط احترافي باسم مقاولتك لعرض أسطولك والأسعار ومشاركته مع الزبناء عبر واتساب.',
                    descFr: 'Page web à votre nom pour partager votre flotte et vos tarifs sur WhatsApp.',
                  },
                  {
                    icon: Radar,
                    titleAr: 'رادار الصفقات العمومية المغربية',
                    titleFr: 'Radar des marchés publics',
                    descAr: 'تصفح يومي لصفقات الأشغال العمومية الفائزة وأرقام وهواتف الشركات لتأجير آلياتك لها.',
                    descFr: 'Repérez les entreprises gagnantes de marchés BTP et leurs coordonnées.',
                  },
                  {
                    icon: PackageSearch,
                    titleAr: 'مئات موردي قطع الغيار',
                    titleFr: 'Des centaines de fournisseurs de pièces',
                    descAr: 'أطلق حملة مباشرة للبحث عن قطع الغيار في المنصة تصل إشعارات مباشرة بمواصفاتك في حسابات الموردين.',
                    descFr: 'Lancez une demande directe de pièces de rechange : les fournisseurs reçoivent instantanément vos spécifications dans leur espace.',
                  },
                  {
                    icon: Wallet,
                    titleAr: 'المداخيل، العقود وتوظيف السائقين',
                    titleFr: 'Finances, contrats & chauffeurs',
                    descAr: 'توليد العقود والفواتير، تتبع الديون والمصاريف، عداد انتهاء الكراء، وأرشيف الزبناء مع توظيف سائقين محترفين.',
                    descFr: 'Contrats et factures, suivi des impayés, fin de location, archive clients et recrutement chauffeurs.',
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white leading-snug">
                          {lang === 'fr' ? item.titleFr : item.titleAr}
                        </h3>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          {lang === 'fr' ? item.descFr : item.descAr}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <SignupCtaStrip
        variant="dark"
        promptAr="عندك آلية أو أسطول وتريد تشغيله بدون عمولة مع 3 أيام تجربة مجانية؟"
        promptFr="Propriétaire d'engins ? Activez votre essai gratuit de 3 jours sans carte bancaire."
        ctaAr="سجل آلياتك الآن (3 أيام مجانا)"
        ctaFr="Inscrire mes engins (3j gratuits)"
      />

      {/* =====================================================================
          03 · PROFESSIONAL DRIVERS / OPERATORS
      ===================================================================== */}
      <section
        id="section-drivers"
        className={`relative scroll-mt-20 py-14 sm:py-20 bg-white text-ink overflow-hidden transition-shadow ${
          activePillar === 'drivers' ? 'ring-2 ring-inset ring-primary/50' : ''
        }`}
      >
        {/* Subtle Safety Diagonal Texture Reflector */}
        <div
          className="absolute top-0 end-0 w-44 sm:w-64 h-full bg-hazard-subtle opacity-25 pointer-events-none [mask-image:linear-gradient(to_left,black,transparent)] [-webkit-mask-image:linear-gradient(to_left,black,transparent)]"
          aria-hidden="true"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Content Column */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 flex flex-col justify-center text-start"
            >
              <div className="text-xs sm:text-sm font-extrabold text-primary-dark mb-2">
                {lang === 'fr'
                  ? '03 · Conducteurs & Chauffeurs Professionnels'
                  : '03 · السائقون المحترفون ومشغلو الآليات الثقيلة'}
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-black text-ink leading-tight text-balance">
                {lang === 'fr'
                  ? 'Recevez des offres de chantier en direct et signez votre contrat'
                  : 'توصل بعروض عمل فورية في مدينتك ووثق اتفاقك بعقد رقمي'}
              </h2>
              <p className="text-sm sm:text-base text-steel-600 mt-3 leading-relaxed max-w-2xl">
                {lang === 'fr'
                  ? 'Inscrivez gratuitement vos engins maîtrisés et soyez alerté dès qu’un propriétaire cherche un chauffeur près de chez vous.'
                  : 'سجل أصناف الآليات التي تتقن قيادتها وسنوات خبرتك مجانا، واستقبل تنبيهات صوتية فورية عند احتياج المالكين لسائق.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">
                {[
                  {
                    icon: Bell,
                    titleAr: 'إشعارات عروض عمل فورية',
                    titleFr: 'Alertes emploi en temps réel',
                    descAr: 'تنبيه مباشر على هاتفك فور بحث أي مالك عن سائق للآلية التي تقودها في منطقتك.',
                    descFr: 'Notification sonore immédiate dès qu’un loueur cherche votre spécialité.',
                  },
                  {
                    icon: FileCheck2,
                    titleAr: 'تفاوض مباشر وعقد عمل PDF',
                    titleFr: 'Négociation & Contrat PDF',
                    descAr: 'الاتفاق على الأجرة والمدة ومقر الورش مباشرة في المحادثة وتوليد عقد عمل رسمي.',
                    descFr: 'Accord clair sur le salaire et la durée avec contrat PDF prêt à imprimer.',
                  },
                  {
                    icon: UserCheck,
                    titleAr: 'حالة توفر تلقائية أثناء العمل',
                    titleFr: 'Statut automatique en mission',
                    descAr: 'تتحول حالتك إلى «في مهمة عمل» طيلة العقد وتعود «متاح للعمل» بشكل تلقائي عند الانتهاء.',
                    descFr: 'Votre profil passe en « En mission » durant le contrat puis redevient libre.',
                  },
                  {
                    icon: HardHat,
                    titleAr: 'ملف مهني مجاني بدون وسطاء',
                    titleFr: 'Profil pro 100% gratuit',
                    descAr: 'تقديم طلبات العمل والتواصل مع مالكي الآليات في جميع المدن المغربية بالمجان بالكامل.',
                    descFr: 'Postulez librement et échangez directement avec les propriétaires d’engins.',
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-surface border border-steel-200 shadow-soft flex items-start gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-ink text-primary flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-ink leading-snug">
                          {lang === 'fr' ? item.titleFr : item.titleAr}
                        </h3>
                        <p className="text-xs text-steel-600 mt-1 leading-relaxed">
                          {lang === 'fr' ? item.descFr : item.descAr}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Visual Driver Offer Card */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 flex"
            >
              <div className="w-full rounded-2xl bg-ink text-white border border-steel-800 p-6 shadow-elevated flex flex-col justify-between text-start">
                <div>
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div>
                      <span className="text-xs text-primary font-bold block">
                        {lang === 'fr' ? 'Espace Conducteur JADIJCB' : 'بوابة السائق المحترف'}
                      </span>
                      <span className="text-base font-black text-white">
                        {lang === 'fr' ? 'Offre de chantier reçue' : 'عرض عمل عاجل على هاتفك'}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <HardHat className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-5 p-4 rounded-xl bg-slate-900 border border-primary/35 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-black text-white">
                          {lang === 'fr'
                            ? 'Conducteur Pelle Hydraulique (Pelle)'
                            : 'مطلوب سائق حفارة هيدروليكية (Pelle)'}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {lang === 'fr'
                            ? 'Casablanca · Durée : 1 mois · Logement inclus'
                            : 'الدار البيضاء · المدة: شهر واحد · السكن والأكل مشمول'}
                        </div>
                      </div>
                      <span className="text-sm font-black text-primary font-mono latin-nums shrink-0">
                        450 MAD/{lang === 'fr' ? 'j' : 'يوم'}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
                      <span>{lang === 'fr' ? 'Contrat PDF numérique inclus' : 'عقد عمل PDF موثق بين الطرفين'}</span>
                      <span className="text-emerald-400 font-bold">
                        {lang === 'fr' ? 'Accord direct' : 'اتفاق مباشر'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{lang === 'fr' ? 'Inscription 100% gratuite' : 'التسجيل مجاني 100% للسائقين'}</span>
                  </span>
                  <span className="text-slate-400">
                    {lang === 'fr' ? 'Toutes villes' : 'جميع المدن'}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <SignupCtaStrip
        variant="light"
        promptAr="هل أنت سائق جرافة، حفارة، رافعة أو شاحنة ثقيلة وتبحث عن فرص عمل دائمة؟"
        promptFr="Chauffeur d'engins qualifié ? Recevez les opportunités de votre ville gratuitement."
        ctaAr="سجل حساب سائق مجانا الآن"
        ctaFr="Créer mon profil conducteur"
      />

      {/* =====================================================================
          04 · SPARE PARTS SUPPLIERS (COMING SUITE · EARLY ACCESS)
      ===================================================================== */}
      <section
        id="section-parts"
        className={`relative scroll-mt-20 py-14 sm:py-20 bg-[#0F172A] text-white overflow-hidden transition-shadow ${
          activePillar === 'parts' ? 'ring-2 ring-inset ring-primary/60' : ''
        }`}
      >
        <div className="absolute inset-0 bg-industrial-grid opacity-25 pointer-events-none" />
        <div
          className="absolute top-1/3 end-1/4 w-[460px] h-[300px] bg-primary/10 rounded-full blur-[130px] pointer-events-none"
          aria-hidden="true"
        />
        {!partsImgErr && (
          <div className="hidden lg:block absolute bottom-0 end-0 w-[440px] h-[280px] opacity-20 pointer-events-none select-none [mask-image:radial-gradient(ellipse_at_bottom_right,black_30%,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_at_bottom_right,black_30%,transparent_75%)]">
            <img
              src={heroDumpTruckImg}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              onError={() => setPartsImgErr(true)}
              className="w-full h-full object-cover mix-blend-lighten"
            />
          </div>
        )}

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Visual Supplier Command Card */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 order-2 lg:order-1 flex"
            >
              <div className="w-full rounded-2xl bg-ink border border-primary/35 p-6 shadow-2xl flex flex-col justify-between text-start">
                <div>
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div>
                      <span className="text-xs text-primary font-bold block">
                        {lang === 'fr'
                          ? 'Espace Fournisseur · Bientôt disponible'
                          : 'فضاء موردي قطع الغيار · قريبا في المنصة'}
                      </span>
                      <span className="text-base font-black text-white">
                        {lang === 'fr'
                          ? 'Stock, demandes urgentes & contrats de vente'
                          : 'طلبات القطع الفورية، المخزون والمبيعات'}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Wrench className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Instant Owner Part Alert Simulation */}
                  <div className="mt-5 p-3.5 rounded-xl bg-slate-900 border border-primary/35">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-primary font-bold flex items-center gap-1.5">
                        <PackageSearch className="w-4 h-4 shrink-0" />
                        <span>
                          {lang === 'fr' ? 'Demande urgente reçue' : 'إشعار بحث فوري من مالك آلية'}
                        </span>
                      </span>
                      <span className="text-slate-400">
                        {lang === 'fr' ? 'À l’instant' : 'الآن'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white mt-2">
                      {lang === 'fr'
                        ? 'Kit filtres & flexibles hydrauliques JCB 3CX'
                        : 'طقم فلاتر وخراطيم هيدروليك JCB 3CX · مراكش'}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {lang === 'fr'
                        ? 'Proposez votre prix et délai de livraison en direct.'
                        : 'أرسل ثمنك وتوفر القطعة لصاحب الآلية في الحين.'}
                    </div>
                  </div>

                  {/* Inventory & Sales Metrics */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">
                        {lang === 'fr' ? 'Articles en stock' : 'القطع في المخزون'}
                      </span>
                      <div className="text-lg font-black text-white font-mono latin-nums mt-1">
                        340 <span className="text-xs text-slate-400">{lang === 'fr' ? 'réf.' : 'صنف'}</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">
                        {lang === 'fr' ? 'Bénéfice net suivi' : 'صافي الأرباح المسجل'}
                      </span>
                      <div className="text-lg font-black text-emerald-400 font-mono latin-nums mt-1">
                        +28 400 <span className="text-xs">MAD</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <span className="text-primary font-semibold">
                    {lang === 'fr' ? 'Pré-inscription ouverte' : 'التسجيل المبكر مفتوح للمحلات والموردين'}
                  </span>
                  <span className="text-slate-400">
                    {lang === 'fr' ? 'Contrats & Vitrine inclus' : 'متجر + عقود بيع'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Content Column */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 order-1 lg:order-2 flex flex-col justify-center text-start"
            >
              <div className="text-xs sm:text-sm font-extrabold text-primary mb-2">
                {lang === 'fr'
                  ? '04 · Fournisseurs de Pièces de Rechange · Suite à venir'
                  : '04 · موردو قطع الغيار والمعدات · مزايا قادمة في المنصة'}
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-black text-white leading-tight text-balance">
                {lang === 'fr'
                  ? 'Un marché ouvert face aux propriétaires et chantiers, avec alertes en direct'
                  : 'سوق مفتوح من المالكين والزبناء مع إشعارات فورية لطلبات قطع الغيار'}
              </h2>
              <p className="text-sm sm:text-base text-slate-300 mt-3 leading-relaxed max-w-2xl">
                {lang === 'fr'
                  ? 'Préparez l’ouverture de votre espace fournisseur : recevez les demandes de pièces en temps réel, créez votre boutique et pilotez stock et bénéfices.'
                  : 'منظومة متكاملة نجهزها لمحلات وموزعي قطع الغيار لربطهم مباشرة بمالكي الآليات المتوقفين في الأوراش وإدارة مبيعاتهم من مكان واحد.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">
                {[
                  {
                    icon: Truck,
                    titleAr: 'سوق مفتوح من المالكين والزبناء',
                    titleFr: 'Marché ouvert B2B ciblé',
                    descAr: 'اعرض قطع الغيار، الفلاتر، الخراطيم، الزيوت والجنازير أمام الباحثين عنها كل يوم.',
                    descFr: 'Connectez votre catalogue aux loueurs d’engins et chantiers qui recherchent vos pièces.',
                  },
                  {
                    icon: Bell,
                    titleAr: 'إشعارات فورية في حينها',
                    titleFr: 'Alertes demandes en direct',
                    descAr: 'تتوصل بإشعار فوري بمجرد بحث أي مالك آلية عن قطعة غيار محددة لتجيب بالثمن والتوصيل.',
                    descFr: 'Recevez une alerte instantanée lorsqu’un propriétaire recherche une référence précise.',
                  },
                  {
                    icon: Store,
                    titleAr: 'متجر خاص وتوليد عقود البيع',
                    titleFr: 'Boutique dédiée & Contrats de vente',
                    descAr: 'صمم متجرك الخاص داخل المنصة مع إمكانية توليد عقود بيع وفواتير احترافية لزبنائك.',
                    descFr: 'Créez votre boutique en ligne et émettez factures et contrats de vente depuis la plateforme.',
                  },
                  {
                    icon: Boxes,
                    titleAr: 'لوحة تحكم المخزون والمبيعات والأرباح',
                    titleFr: 'Gestion stock, ventes & bénéfices',
                    descAr: 'إدارة شاملة للمخزون، تسجيل المبيعات اليومية، حساب الأرباح الصافية، وتنبيهات النفاد والمزيد.',
                    descFr: 'Tableau complet de suivi des stocks, ventes quotidiennes, marges nettes et réassort.',
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-ink/85 border border-slate-800 flex items-start gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white leading-snug">
                          {lang === 'fr' ? item.titleFr : item.titleAr}
                        </h3>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          {lang === 'fr' ? item.descFr : item.descAr}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          FINAL CONCISE CONVERSION & PRICING SUMMARY
      ===================================================================== */}
      <section className="relative py-12 sm:py-16 bg-ink text-white border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-black text-white text-balance">
            {lang === 'fr'
              ? 'Prêt à rejoindre la plateforme marocaine des engins lourds ?'
              : 'انضم الآن إلى أول منصة تجمع كل منظومة الآليات الثقيلة بالمغرب'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed max-w-3xl mx-auto">
            {lang === 'fr'
              ? 'Gratuit pour les clients et les chauffeurs · 3 jours d’essai gratuit pour les loueurs (puis 290 MAD/mois par RIB ou Wafacash) · 0% de commission.'
              : 'مجاني 100% للزبناء والسائقين · 3 أيام تجربة مجانية لملاك الآليات (ثم 290 د.م/شهر عبر RIB أو وفاكاش) · 0% عمولة.'}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-7">
            <Link
              to="/auth?mode=signup"
              className="min-h-[48px] px-8 py-3 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-ink font-black text-sm sm:text-base shadow-yellow-glow transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span>
                {lang === 'fr' ? 'Créer mon compte maintenant' : 'سجل حسابك الآن مجانا'}
              </span>
              <ArrowIcon className="w-4 h-4 shrink-0" />
            </Link>

            <Link
              to="/marketplace"
              className="min-h-[48px] px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 font-bold text-sm transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Compass className="w-4 h-4 text-primary shrink-0" />
              <span>{lang === 'fr' ? 'Consulter les engins disponibles' : 'تصفح الآليات المتاحة'}</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PillarShowcaseSections;
