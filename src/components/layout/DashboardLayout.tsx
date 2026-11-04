import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  CalendarCheck,
  MessageSquare,
  Building2,
  ShieldCheck,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Bell,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { TrialBanner } from '../dashboard/TrialBanner';
import { SoftLockModal } from '../dashboard/SoftLockModal';
import { PaymentProofModal } from '../dashboard/PaymentProofModal';

export const DashboardLayout: React.FC = () => {
  const { t, isRTL, lang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, logout } = useAuth();
  const { isLocked, isTrial, formattedCountdown, isActive } = useSubscription();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const isChatRoute = location.pathname.startsWith('/app/messages');
  const shouldShowLock = isLocked && !isChatRoute;
  const unreadMessagesCount = 1;

  const navigationItems = [
    {
      to: '/app',
      exact: true,
      label: t('nav.dashboard'),
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      to: '/app/machines',
      label: t('nav.machines'),
      icon: <Truck className="w-5 h-5" />,
    },
    {
      to: '/app/bookings',
      label: t('nav.bookings'),
      icon: <CalendarCheck className="w-5 h-5" />,
    },
    {
      to: '/app/messages',
      label: t('nav.messages'),
      icon: <MessageSquare className="w-5 h-5" />,
      badge: unreadMessagesCount,
    },
    {
      to: '/app/storefront',
      label: t('nav.storefront'),
      icon: <Building2 className="w-5 h-5" />,
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const displayName = profile?.company_name || profile?.full_name || 'JADIJCB Partner';
  const roleLabel =
    profile?.role === 'owner'
      ? t('auth.role_owner')
      : profile?.role === 'admin'
      ? 'Super Admin'
      : t('auth.role_client');

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row relative">
      {/* Desktop Sidebar (Logical start-0) */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-ink text-white border-e border-steel-800 shrink-0 sticky top-0 h-screen select-none z-30">
        {/* Brand Area */}
        <div className="p-6 border-b border-steel-800">
          <Logo variant="light" size="md" />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navigationItems.map((item) => {
            const isItemActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                  isItemActive
                    ? 'bg-primary text-ink shadow-sm'
                    : 'text-steel-300 hover:text-white hover:bg-steel-800'
                }`}
              >
                <div className="relative shrink-0">
                  {item.icon}
                  {item.badge && item.badge > 0 && !isItemActive && (
                    <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-primary" />
                  )}
                </div>
                <span className="flex-1 text-start">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isItemActive ? 'bg-ink text-primary' : 'bg-primary text-ink'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isItemActive && (
                  <span className="shrink-0 text-ink">
                    {isRTL ? (
                      <ChevronLeft className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>
                )}
              </NavLink>
            );
          })}

          {/* Admin link (Always accessible to admin or preview) */}
          <div className="pt-4 mt-4 border-t border-steel-800">
            <NavLink
              to="/admin"
              className={({ isActive: isLinkActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                  isLinkActive
                    ? 'bg-steel-800 text-primary'
                    : 'text-steel-400 hover:text-white hover:bg-steel-800'
                }`
              }
            >
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span className="text-start">{t('nav.admin')}</span>
            </NavLink>
          </div>
        </nav>

        {/* User Status, Subscription Badge & Language */}
        <div className="p-4 border-t border-steel-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-steel-800 flex items-center justify-center font-bold text-xs text-primary border border-steel-700 uppercase">
                {displayName.slice(0, 2)}
              </div>
              <div className="flex flex-col text-start">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">
                  {displayName}
                </span>
                <span className="text-[10px] text-steel-400 truncate max-w-[120px]">
                  {roleLabel}
                </span>
              </div>
            </div>
            <LanguageSwitcher variant="dark" />
          </div>

          {/* Subscription Mini Pill */}
          {isTrial && !isLocked && (
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex items-center justify-between p-2 rounded-xl bg-steel-900 border border-steel-700/80 text-[11px] hover:border-primary transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-primary font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('trial.status_trial')}</span>
              </div>
              <span className="font-mono text-white text-[10px] font-bold">
                {formattedCountdown}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-semibold text-steel-400 hover:text-danger transition-colors py-2 px-1 min-h-[44px] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Trial Live Banner */}
        <TrialBanner onOpenPaymentModal={() => setIsPaymentModalOpen(true)} />

        {/* Mobile & Tablet Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-steel-200/80 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <Logo size="sm" />
            </div>
            <h1 className="hidden md:block text-base font-bold text-ink">
              {navigationItems.find((i) =>
                i.exact
                  ? location.pathname === i.to
                  : location.pathname.startsWith(i.to)
              )?.label || t('nav.dashboard')}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <NavLink
              to="/marketplace"
              className="text-xs font-semibold text-steel-700 hover:text-ink px-3 py-1.5 rounded-lg border border-steel-200 bg-steel-50 hover:bg-steel-100 min-h-[44px] flex items-center"
            >
              {t('nav.marketplace')}
            </NavLink>
            <div className="md:hidden">
              <LanguageSwitcher />
            </div>
            <button
              type="button"
              className="p-2 text-steel-600 hover:text-ink hover:bg-steel-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center relative cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 end-2 w-2 h-2 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        {/* Page Inner Content (Blurred if shouldShowLock) */}
        <main
          className={`flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-all duration-300 ${
            shouldShowLock ? 'blur-sm pointer-events-none select-none' : ''
          }`}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Fixed, 44px+ touch targets, thumb-friendly) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 start-0 end-0 bg-white border-t border-steel-200 shadow-elevated z-40 px-2 py-1 flex items-center justify-around"
      >
        {navigationItems.map((item) => {
          const isItemActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[50px] transition-colors relative ${
                isItemActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all relative ${
                  isItemActive ? 'bg-primary text-ink' : ''
                }`}
              >
                {item.icon}
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white" />
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px]">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Soft Lock Modal Overlay (Non-dismissible when shouldShowLock is true) */}
      <SoftLockModal isLocked={shouldShowLock} />

      {/* Voluntary Payment Proof Modal (Dismissible, for activating before expiry) */}
      <PaymentProofModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        isDismissible={true}
      />
    </div>
  );
};

export default DashboardLayout;
