// ============================================================================
// JADIJCB: Post-Registration Next Steps Modal for Clients
// Gives newly registered clients 2 clear sections:
// 1) Add a work location (farm, plot, site) -> /entreprise/projects?addSite=1
// 2) Browse Equipment Marketplace (/marketplace) OR Open Dashboard (/entreprise)
// ============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Store,
  LayoutDashboard,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { getClientSegmentOption } from '../../data/clientSegments';

interface ClientNextStepsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClientNextStepsModal: React.FC<ClientNextStepsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();

  if (!isOpen) return null;

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const segmentMeta = getClientSegmentOption(profile?.client_segment);
  const greetingName =
    profile?.company_name?.trim() ||
    profile?.full_name?.trim() ||
    (lang === 'fr' ? segmentMeta.labelFr : segmentMeta.labelAr);

  const handleGoTo = async (path: string) => {
    await updateProfile({ onboarding_completed: true });
    onClose();
    navigate(path);
  };

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/75 backdrop-blur-sm overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 24 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="relative bg-white border border-steel-200 rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl text-start overflow-hidden z-10 max-h-[92dvh] overflow-y-auto"
        >
          {/* Top Accent Strip */}
          <div className="absolute top-0 start-0 end-0 h-1.5 bg-gradient-to-r from-primary via-amber-400 to-primary" />
          <div className="sm:hidden w-10 h-1 bg-steel-300 rounded-full mx-auto mb-3" />

          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-primary/20 text-ink text-[11px] font-black mb-1">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>{lang === 'fr' ? segmentMeta.labelFr : segmentMeta.labelAr}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-ink leading-snug">
                {lang === 'fr'
                  ? `Bienvenue, ${greetingName} !`
                  : `مرحباً بك في JADIJCB، ${greetingName}!`}
              </h2>
              <p className="text-xs text-steel-600 mt-1 leading-relaxed">
                {lang === 'fr'
                  ? 'Votre compte client est prêt gratuitement. Choisissez votre prochaine étape :'
                  : 'تم حفظ بياناتك وحسابك جاهز مجاناً بالكامل. اختر خطوتك التالية الآن:'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Section 1: Add Work Location */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border-2 border-primary/50 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-ink flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-black text-primary-dark uppercase block">
                    {lang === 'fr' ? 'Section 1 · Localisation sur carte' : 'القسم الأول · تحديد موقع العمل'}
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-ink mt-0.5">
                    {lang === 'fr'
                      ? 'Ajouter un lieu de travail (chantier, ferme ou terrain)'
                      : 'إضافة موقع للعمل (ضيعة، بقعة أرضية، أو ورش)'}
                  </h3>
                  <p className="text-xs text-steel-600 mt-1 leading-relaxed">
                    {lang === 'fr'
                      ? 'Placez votre terrain sur la carte pour trouver immédiatement les engins disponibles les plus proches.'
                      : 'حدد مكان أشغالك على الخريطة ليصلك أقرب السائقين والآليات المتوفرة بالمسافة الدقيقة.'}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => handleGoTo('/entreprise/projects?addSite=1')}
                leftIcon={<PlusCircle className="w-4 h-4" />}
                rightIcon={<ArrowIcon className="w-4 h-4" />}
                className="w-full justify-center font-black text-xs sm:text-sm min-h-[48px] shadow-sm"
              >
                {lang === 'fr' ? 'Ajouter un lieu de travail' : 'إضافة موقع للعمل الآن'}
              </Button>
            </div>

            {/* Section 2: Marketplace OR Dashboard */}
            <div className="p-4 sm:p-5 rounded-2xl bg-steel-50 border border-steel-200 space-y-3">
              <div>
                <span className="text-[11px] font-black text-steel-500 uppercase block">
                  {lang === 'fr' ? 'Section 2 · Navigation directe' : 'القسم الثاني · التصفح أو لوحة التحكم'}
                </span>
                <h3 className="text-sm font-black text-ink mt-0.5">
                  {lang === 'fr'
                    ? 'Accéder directement aux engins ou à votre espace'
                    : 'اختر الدخول مباشرة لسوق الآليات أو لوحة التحكم'}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="dark"
                  size="md"
                  onClick={() => handleGoTo('/marketplace')}
                  leftIcon={<Store className="w-4 h-4 text-primary" />}
                  className="w-full justify-center font-black text-xs min-h-[48px]"
                >
                  {lang === 'fr' ? 'Entrer au marché des engins' : 'الدخول لسوق الآليات'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => handleGoTo('/entreprise')}
                  leftIcon={<LayoutDashboard className="w-4 h-4 text-primary-dark" />}
                  className="w-full justify-center font-black text-xs min-h-[48px] bg-white border-steel-300"
                >
                  {lang === 'fr' ? 'Accéder au tableau de bord' : 'الدخول للوحة التحكم'}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ClientNextStepsModal;
