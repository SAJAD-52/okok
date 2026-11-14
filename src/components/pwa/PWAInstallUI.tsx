import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, MoreVertical, X, WifiOff, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useLanguage } from '../../hooks/useLanguage';

const BANNER_DISMISS_KEY = 'jadijcb_pwa_banner_dismissed_at';
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  isInstallable: boolean;
  onTriggerNativeInstall: () => void;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  isInstallable,
  onTriggerNativeInstall,
}) => {
  const { lang } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-ink/75 backdrop-blur-xs p-0 sm:p-4 text-start">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl border border-steel-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-modal-title"
      >
        {/* Black & Yellow Brand Header */}
        <div className="bg-ink text-white p-5 flex items-center justify-between border-b-2 border-primary">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="JADIJCB App Icon"
              className="w-12 h-12 rounded-2xl border border-primary/40 shadow-md shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 id="pwa-install-modal-title" className="text-base font-black tracking-tight text-white">
                  JADI<span className="text-primary">JCB</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-primary text-ink text-[10px] font-black">
                  APP
                </span>
              </div>
              <p className="text-xs font-bold text-primary mt-0.5">كلشي قريب ليك</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-steel-400 hover:text-white hover:bg-steel-800 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label={lang === 'fr' ? 'Fermer' : 'إغلاق'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-black text-ink">
              {isIOS
                ? lang === 'fr'
                  ? 'Installer JADIJCB sur votre iPhone / iPad'
                  : 'تثبيت تطبيق JADIJCB على هاتفك iPhone'
                : lang === 'fr'
                ? 'Télécharger l\'application JADIJCB sur votre téléphone'
                : 'تثبيت تطبيق JADIJCB على هاتفك في ثوانٍ'}
            </h4>
            <p className="text-xs text-steel-600 leading-relaxed">
              {lang === 'fr'
                ? 'Accès instantané au radar des engins, réservations et messagerie directement depuis votre écran d\'accueil.'
                : 'تصفح أقرب الآليات، تتبع حجوزاتك وتواصل مع المالكين مباشرة من شاشة هاتفك الرئيسية.'}
            </p>
          </div>

          {isInstallable ? (
            <button
              type="button"
              onClick={() => {
                onTriggerNativeInstall();
                onClose();
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-ink font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-transform active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Installer maintenant' : 'تثبيت التطبيق الآن'}</span>
            </button>
          ) : isIOS ? (
            <div className="space-y-2.5 bg-surface p-3.5 rounded-2xl border border-steel-200 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-ink text-primary flex items-center justify-center font-black shrink-0">
                  1
                </div>
                <p className="text-steel-800 leading-relaxed flex-1">
                  {lang === 'fr' ? (
                    <>
                      Appuyez sur le bouton <strong>Partager</strong> <Share className="w-3.5 h-3.5 inline text-primary-dark mx-0.5" /> dans la barre Safari.
                    </>
                  ) : (
                    <>
                      اضغط على زر <strong>المشاركة (Share)</strong> <Share className="w-3.5 h-3.5 inline text-primary-dark mx-0.5" /> في شريط متصفح Safari.
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-ink text-primary flex items-center justify-center font-black shrink-0">
                  2
                </div>
                <p className="text-steel-800 leading-relaxed flex-1">
                  {lang === 'fr' ? (
                    <>
                      Faites défiler et appuyez sur <strong>Sur l&apos;écran d&apos;accueil</strong> <PlusSquare className="w-3.5 h-3.5 inline text-primary-dark mx-0.5" />.
                    </>
                  ) : (
                    <>
                      مرر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية</strong> <PlusSquare className="w-3.5 h-3.5 inline text-primary-dark mx-0.5" />.
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-ink text-primary flex items-center justify-center font-black shrink-0">
                  3
                </div>
                <p className="text-steel-800 leading-relaxed flex-1">
                  {lang === 'fr' ? (
                    <>
                      Appuyez sur <strong>Ajouter</strong> pour afficher l&apos;icône <strong>JADIJCB</strong>.
                    </>
                  ) : (
                    <>
                      اضغط على <strong>إضافة (Ajouter)</strong> ليظهر تطبيق <strong>JADIJCB</strong> على هاتفك.
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 bg-surface p-3.5 rounded-2xl border border-steel-200 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-ink text-primary flex items-center justify-center font-black shrink-0">
                  1
                </div>
                <p className="text-steel-800 leading-relaxed flex-1">
                  {lang === 'fr' ? (
                    <>
                      Ouvrez le menu du navigateur <MoreVertical className="w-3.5 h-3.5 inline text-ink mx-0.5" /> en haut de l&apos;écran.
                    </>
                  ) : (
                    <>
                      افتح قائمة المتصفح <MoreVertical className="w-3.5 h-3.5 inline text-ink mx-0.5" /> في أعلى الشاشة.
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-ink text-primary flex items-center justify-center font-black shrink-0">
                  2
                </div>
                <p className="text-steel-800 leading-relaxed flex-1">
                  {lang === 'fr' ? (
                    <>
                      Choisissez <strong>Installer l&apos;application</strong> ou <strong>Ajouter à l&apos;écran d&apos;accueil</strong>.
                    </>
                  ) : (
                    <>
                      اختر <strong>تثبيت التطبيق</strong> أو <strong>إضافة إلى الشاشة الرئيسية</strong>.
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-700 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'fr'
                    ? 'Application légère, rapide et sans espace de stockage lourd.'
                    : 'تطبيق خفيف وسريع بشعار JADIJCB — كلشي قريب ليك'}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] py-2.5 rounded-xl bg-steel-100 hover:bg-steel-200 text-ink text-xs font-bold transition-colors cursor-pointer"
          >
            {lang === 'fr' ? 'Compris' : 'حسناً، فهمت'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PWAInstallButtonProps {
  variant?: 'header' | 'header-icon' | 'sidebar' | 'dark' | 'drawer';
  className?: string;
  onAfterClick?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
  onAfterClick,
}) => {
  const { lang } = useLanguage();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Never show install prompt if already running as installed standalone app
  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome !== 'accepted') {
        // Keep available if dismissed; call optional callback
      }
      onAfterClick?.();
      return;
    }
    setShowGuide(true);
  };

  const label = lang === 'fr' ? "Télécharger l'app" : 'تحميل التطبيق';

  return (
    <>
      {variant === 'header-icon' ? (
        <button
          type="button"
          onClick={handleClick}
          className={`p-2 rounded-xl bg-ink text-primary border border-primary/40 hover:bg-steel-900 min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:px-3 flex items-center justify-center gap-1.5 text-xs font-black shadow-xs transition-colors cursor-pointer shrink-0 ${className}`}
          title={`${label} — JADIJCB`}
          aria-label={label}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span className="hidden lg:inline whitespace-nowrap">{label}</span>
        </button>
      ) : variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleClick}
          className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/40 text-xs font-black text-primary transition-colors cursor-pointer w-full text-start ${className}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <span className="block truncate">{label}</span>
              <span className="block text-[10px] text-steel-300 font-semibold truncate">
                JADIJCB · كلشي قريب ليك
              </span>
            </div>
          </div>
          <Download className="w-3.5 h-3.5 shrink-0" />
        </button>
      ) : variant === 'dark' ? (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-steel-900 hover:bg-steel-800 border border-primary/50 text-white text-xs font-black shadow-sm transition-all cursor-pointer min-h-[44px] ${className}`}
        >
          <img src="/pwa-192x192.png" alt="JADIJCB" className="w-6 h-6 rounded-lg shrink-0" />
          <div className="text-start leading-tight">
            <span className="block text-primary">{label}</span>
            <span className="block text-[10px] text-steel-300 font-semibold">
              JADIJCB — كلشي قريب ليك
            </span>
          </div>
          <Download className="w-4 h-4 text-primary shrink-0 ms-1" />
        </button>
      ) : variant === 'drawer' ? (
        <button
          type="button"
          onClick={handleClick}
          className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-black bg-ink text-white border border-primary/40 hover:bg-steel-900 transition-colors text-start cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <img src="/pwa-192x192.png" alt="JADIJCB" className="w-8 h-8 rounded-xl shrink-0" />
            <div className="min-w-0">
              <span className="block text-white font-black">
                {label} · JADI<span className="text-primary">JCB</span>
              </span>
              <span className="block text-[10px] text-primary font-bold">كلشي قريب ليك</span>
            </div>
          </div>
          <Download className="w-4 h-4 text-primary shrink-0" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-ink hover:bg-steel-800 text-white border border-primary/40 text-xs font-black min-h-[40px] sm:min-h-[44px] shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${className}`}
          title="JADIJCB — كلشي قريب ليك"
        >
          <Download className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{label}</span>
        </button>
      )}

      <InstallGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        isIOS={isIOS}
        isInstallable={isInstallable}
        onTriggerNativeInstall={install}
      />
    </>
  );
};

export const PWAInstallBanner: React.FC = () => {
  const { lang } = useLanguage();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BANNER_DISMISS_KEY);
      if (saved) {
        const ts = Number(saved);
        if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_DURATION_MS) {
          setIsDismissed(true);
          return;
        }
      }
      setIsDismissed(false);
    } catch {
      setIsDismissed(false);
    }
  }, []);

  if (isInstalled || isDismissed) return null;

  // Show banner automatically when native prompt is ready OR on mobile/touch devices
  const isMobileViewport =
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 || isIOS || isInstallable);

  if (!isMobileViewport) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage errors
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        handleDismiss();
      }
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <div className="fixed bottom-20 md:bottom-5 start-3 end-3 md:start-auto md:end-5 md:w-96 z-40 animate-in slide-in-from-bottom duration-300 pointer-events-auto">
        <div className="bg-ink text-white border border-primary/50 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <img
              src="/pwa-192x192.png"
              alt="JADIJCB"
              className="w-11 h-11 rounded-xl border border-primary/40 shrink-0 shadow-sm"
            />
            <div className="min-w-0 flex-1 text-start">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-tight text-white">
                  JADI<span className="text-primary">JCB</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[9px] font-black">
                  APP
                </span>
              </div>
              <p className="text-[11px] font-bold text-primary truncate">كلشي قريب ليك</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3 py-2 min-h-[40px] rounded-xl bg-primary hover:bg-primary-hover text-ink text-xs font-black flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === 'fr' ? 'Installer' : 'تثبيت'}</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-2 min-h-[40px] min-w-[36px] rounded-xl text-steel-400 hover:text-white hover:bg-steel-800 flex items-center justify-center cursor-pointer"
              aria-label={lang === 'fr' ? 'Fermer' : 'إغلاق'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <InstallGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        isIOS={isIOS}
        isInstallable={isInstallable}
        onTriggerNativeInstall={install}
      />
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { lang } = useLanguage();

  if (isOnline) return null;

  return (
    <div className="fixed top-20 start-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 rounded-full bg-ink text-white border border-primary px-4 py-2 text-xs font-bold shadow-xl whitespace-nowrap">
      <WifiOff className="w-4 h-4 text-primary shrink-0" />
      <span>
        {lang === 'fr'
          ? 'Mode hors ligne — Données en cache affichées'
          : 'أنت غير متصل بالإنترنت — يتم عرض البيانات المحفوظة'}
      </span>
    </div>
  );
};
