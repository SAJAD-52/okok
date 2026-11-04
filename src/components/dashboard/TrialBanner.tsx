import React from 'react';
import { Clock, AlertTriangle, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import { useLanguage } from '../../hooks/useLanguage';
import { Button } from '../ui/Button';

interface TrialBannerProps {
  onOpenPaymentModal: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ onOpenPaymentModal }) => {
  const { isTrial, isUrgent, formattedCountdown, isLocked, isActive } = useSubscription();
  const { t, isRTL } = useLanguage();

  // Don't render banner if subscription is fully active or already locked (SoftLockModal handles lock)
  if (isActive || isLocked || !isTrial) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Subscription Trial Status"
      className={`w-full py-2.5 px-4 sm:px-6 transition-colors shadow-sm border-b ${
        isUrgent
          ? 'bg-danger text-white border-red-700 animate-pulse'
          : 'bg-primary-500/15 text-ink border-primary/40 bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-start">
        {/* Left Side Info */}
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isUrgent ? 'bg-white/20 text-white' : 'bg-primary text-ink'
            }`}
          >
            {isUrgent ? (
              <AlertTriangle className="w-4 h-4 animate-bounce" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold leading-tight">
                {isUrgent ? t('trial.banner_urgent') : t('trial.banner_active')}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isUrgent
                    ? 'bg-white text-danger'
                    : 'bg-ink text-primary'
                }`}
              >
                72h Trial
              </span>
            </div>

            <div className="text-[11px] opacity-90 mt-0.5 flex items-center gap-1.5 font-medium">
              <span>{t('trial.remaining_time')}</span>
              <span
                className={`font-mono font-black text-xs tracking-wider px-1.5 py-0.5 rounded ${
                  isUrgent ? 'bg-red-950/40 text-yellow-300' : 'bg-ink text-primary'
                }`}
              >
                {formattedCountdown}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="w-full sm:w-auto flex justify-end">
          <Button
            type="button"
            variant={isUrgent ? 'primary' : 'dark'}
            size="sm"
            onClick={onOpenPaymentModal}
            className={`w-full sm:w-auto font-extrabold text-xs shadow-md ${
              isUrgent ? 'text-ink bg-white hover:bg-neutral-100' : ''
            }`}
            rightIcon={
              isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
            }
          >
            {t('trial.activate_btn')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;
