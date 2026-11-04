import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { PlusCircle, User, Menu, X, Compass, Wrench } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Button } from '../ui/Button';
import { useLanguage } from '../../hooks/useLanguage';

export const PublicHeader: React.FC = () => {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
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

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/auth')}
            className="hidden sm:inline-flex"
            leftIcon={<User className="w-4 h-4" />}
          >
            {t('nav.login')}
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/app/machines')}
            className="hidden sm:inline-flex"
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            {t('nav.post_machine')}
          </Button>

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
            <Button
              size="md"
              variant="outline"
              className="w-full justify-center"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/auth');
              }}
              leftIcon={<User className="w-4 h-4" />}
            >
              {t('nav.login')}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;
