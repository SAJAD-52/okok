import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Sparkles, CheckCircle2, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();

  if (!isOpen) return null;

  const isContractor = profile?.role === 'client' || profile?.role === 'contractor';

  const handleGoToOnboarding = async () => {
    await updateProfile({ onboarding_completed: false });
    onClose();
    navigate('/app/onboarding');
  };

  const handleSkipToDashboard = async () => {
    await updateProfile({ onboarding_completed: true });
    onClose();
    navigate(isContractor ? '/entreprise' : '/app');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-sm">
        {/* Subtle decorative confetti floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(16)].map((_, i) => (
            <motion.div
              key={i}
              className={`absolute w-2.5 h-2.5 rounded-full ${
                i % 3 === 0
                  ? 'bg-primary'
                  : i % 3 === 1
                  ? 'bg-yellow-400'
                  : 'bg-white/70'
              }`}
              initial={{
                top: `${20 + (i * 5) % 60}%`,
                left: `${10 + (i * 6) % 80}%`,
                opacity: 0,
                scale: 0.5,
                y: 0,
              }}
              animate={{
                opacity: [0, 0.9, 0],
                scale: [0.5, 1.2, 0.8],
                y: [-20, 20, -10],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 3 + (i % 3),
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        {/* Modal Window with spring transition */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 25 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 24,
          }}
          className="relative bg-white border border-steel-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-center overflow-hidden z-10"
        >
          {/* Top Yellow Industrial Accent Strip */}
          <div className="absolute top-0 start-0 end-0 h-2 bg-gradient-to-r from-primary via-yellow-400 to-primary" />

          {/* Icon Badge */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/20 border-2 border-primary flex items-center justify-center text-ink mb-4 shadow-sm">
            <Sparkles className="w-8 h-8 text-ink" />
          </div>

          {/* Title & Subtitle */}
          <h2 className="text-xl sm:text-2xl font-extrabold text-ink mb-2">
            {t('welcome.title')}
          </h2>
          <p className="text-xs sm:text-sm text-steel-600 mb-6 max-w-md mx-auto leading-relaxed">
            {t('welcome.subtitle')}
          </p>

          {/* 72:00:00 Countdown Box */}
          <div className="bg-steel-900 text-white rounded-2xl p-5 mb-6 border border-steel-800 shadow-inner relative overflow-hidden">
            <div className="absolute -end-4 -bottom-4 w-20 h-20 bg-primary/10 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center justify-center gap-2 text-primary font-bold text-xs uppercase mb-1">
              <Clock className="w-4 h-4 animate-pulse" />
              <span>{t('welcome.trial_badge')}</span>
            </div>

            <div className="text-3xl sm:text-4xl font-extrabold text-primary font-mono tracking-widest my-2 select-none">
              72:00:00
            </div>

            <p className="text-[11px] text-steel-400 max-w-xs mx-auto leading-normal">
              {t('welcome.trial_desc')}
            </p>

            <div className="mt-3 pt-3 border-t border-steel-800/80 flex items-center justify-center gap-2 text-[11px] text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{t('landing.trust_item_3') || 'بدون بطاقة بنكية · صلاحيات كاملة'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleGoToOnboarding}
              className="flex-1 justify-center font-bold min-h-[48px]"
              rightIcon={
                isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />
              }
            >
              {t('welcome.btn_onboarding')}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={handleSkipToDashboard}
              className="text-steel-600 hover:text-ink text-xs min-h-[48px]"
            >
              {t('welcome.btn_dashboard')}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default WelcomeModal;
