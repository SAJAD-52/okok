import React from 'react';
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
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { useLanguage } from '../../hooks/useLanguage';

export const DashboardLayout: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

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
    },
    {
      to: '/app/storefront',
      label: t('nav.storefront'),
      icon: <Building2 className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row">
      {/* Desktop Sidebar (Logical start-0) */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-ink text-white border-e border-steel-800 shrink-0 sticky top-0 h-screen select-none z-30">
        {/* Brand Area */}
        <div className="p-6 border-b border-steel-800">
          <Logo variant="light" size="md" />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navigationItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                  isActive
                    ? 'bg-primary text-ink shadow-sm'
                    : 'text-steel-300 hover:text-white hover:bg-steel-800'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="flex-1 text-start">{item.label}</span>
                {isActive && (
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

          <div className="pt-4 mt-4 border-t border-steel-800">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                  isActive
                    ? 'bg-steel-800 text-primary'
                    : 'text-steel-400 hover:text-white hover:bg-steel-800'
                }`
              }
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-start">{t('nav.admin')}</span>
            </NavLink>
          </div>
        </nav>

        {/* User Status & Language */}
        <div className="p-4 border-t border-steel-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-steel-800 flex items-center justify-center font-bold text-xs text-primary border border-steel-700">
                JC
              </div>
              <div className="flex flex-col text-start">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">
                  SNTL Logistique
                </span>
                <span className="text-[10px] text-steel-400">
                  {t('auth.role_owner')}
                </span>
              </div>
            </div>
            <LanguageSwitcher variant="dark" />
          </div>

          <button
            onClick={() => navigate('/auth')}
            className="flex items-center gap-2 text-xs font-semibold text-steel-400 hover:text-danger transition-colors py-2 px-1 min-h-[44px] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
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

        {/* Page Inner Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Fixed, 44px+ touch targets, thumb-friendly) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 start-0 end-0 bg-white border-t border-steel-200 shadow-elevated z-40 px-2 py-1 flex items-center justify-around"
      >
        {navigationItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[50px] transition-colors ${
                isActive ? 'text-ink font-bold' : 'text-steel-400 hover:text-steel-700'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-primary text-ink' : ''
                }`}
              >
                {item.icon}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px]">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default DashboardLayout;
