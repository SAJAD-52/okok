import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { PlusCircle, User, Menu, X, Compass, Wrench, MapPin, Building2, HardHat } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Button } from '../ui/Button';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';

export const PublicHeader: React.FC = () => {
  const { t, lang } = useLanguage();
  const { user, profile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const isContractor = profile?.role === 'client' || profile?.role === 'contractor';

  const navLinks = isContractor
    ? [
        { to: '/marketplace', label: t('nav.marketplace'), icon: <Compass className="w-4 h-4" /> },
        { to: '/entreprise/map', label: lang === 'fr' ? 'Radar Chantiers' : 'رادار الأوراش 📍', icon: <MapPin className="w-4 h-4" /> },
        { to: '/entreprise/bookings', label: lang === 'fr' ? 'Mes Locations' : 'حجوزاتي', icon: <Building2 className="w-4 h-4" /> },
        { to: '/entreprise', label: lang === 'fr' ? 'Espace Entreprise' : 'بوابة المقاولة' },
      ]
    : [
        { to: '/marketplace', label: t('nav.marketplace'), icon: <Compass className="w-4 h-4" /> },
        { to: '/app/machines', label: t('nav.machines'), icon: <Wrench className="w-4 h-4" /> },
        { to: '/app', label: t('nav.dashboard') },
      ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-steel-200/80 transition-shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <Logo size="md" />

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-steel-700">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `transition-colors hover:text-ink whitespace-nowrap shrink-0 py-2 border-b-2 ${
                  isActive
                    ? 'text-ink font-bold border-primary'
                    : 'border-transparent'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Zone 3: Primary Action + Language Switcher + Auth */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          <LanguageSwitcher />

          {user ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(isContractor ? '/entreprise' : '/app')}
              className="hidden sm:inline-flex text-xs font-bold"
              leftIcon={isContractor ? <HardHat className="w-4 h-4 text-primary" /> : <User className="w-4 h-4" />}
            >
              {isContractor
                ? (profile?.company_name || (lang === 'fr' ? 'Mon Entreprise' : 'حساب المقاولة'))
                : (profile?.company_name || profile?.full_name || t('nav.dashboard'))}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/auth')}
              className="hidden sm:inline-flex"
              leftIcon={<User className="w-4 h-4" />}
            >
              {t('nav.login')}
            </Button>
          )}

          {isContractor ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate('/entreprise/map')}
              className="hidden sm:inline-flex font-black text-xs"
              leftIcon={<MapPin className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Radar Chantiers' : 'رادار أقرب الآليات 📍'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate('/app/machines')}
              className="hidden sm:inline-flex"
              leftIcon={<PlusCircle className="w-4 h-4" />}
            >
              {t('nav.post_machine')}
            </Button>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-steel-700 hover:text-ink hover:bg-steel-100 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-steel-200 px-4 pt-3 pb-6 flex flex-col gap-3 shadow-lg">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-steel-800 hover:bg-steel-50 transition-colors"
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>

          <div className="pt-3 border-t border-steel-100 flex flex-col gap-2.5">
            {isContractor ? (
              <Button
                size="md"
                variant="primary"
                className="w-full justify-center font-black"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/entreprise/map');
                }}
                leftIcon={<MapPin className="w-4 h-4" />}
              >
                {lang === 'fr' ? 'Radar InDrive Chantiers' : 'رادار أقرب الآليات للورش 📍'}
              </Button>
            ) : (
              <Button
                size="md"
                variant="primary"
                className="w-full justify-center"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/app/machines');
                }}
                leftIcon={<PlusCircle className="w-4 h-4" />}
              >
                {t('nav.post_machine')}
              </Button>
            )}

            <Button
              size="md"
              variant="outline"
              className="w-full justify-center"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate(user ? (isContractor ? '/entreprise' : '/app') : '/auth');
              }}
              leftIcon={<User className="w-4 h-4" />}
            >
              {user
                ? (isContractor ? (lang === 'fr' ? 'Mon Entreprise' : 'بوابة المقاولة') : t('nav.dashboard'))
                : t('nav.login')}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;
