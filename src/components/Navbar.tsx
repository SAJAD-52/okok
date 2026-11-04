import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Truck, 
  Globe, 
  Heart, 
  PlusCircle, 
  Menu, 
  X, 
  MapPin, 
  Wrench, 
  PhoneCall 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface NavbarProps {
  activeTab: 'catalog' | 'map' | 'saved' | 'parts';
  setActiveTab: (tab: 'catalog' | 'map' | 'saved' | 'parts') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { t, i18n } = useTranslation();
  const { language, toggleLanguage, favorites, setIsAddListingOpen } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabChange = (tab: 'catalog' | 'map' | 'saved' | 'parts') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-ink text-white border-b border-steel/60 shadow-md">
      {/* Top micro-bar for quick contact and assurance */}
      <div className="hidden sm:flex justify-between items-center px-4 sm:px-6 py-1.5 text-xs text-slate-300 bg-ink-dark/80 border-b border-steel/40">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
            <span className="text-white font-medium">{t('hero.stat_machines')}</span>
          </span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span>{t('hero.stat_cities')}</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a 
            href="tel:+212522987654" 
            className="flex items-center gap-1.5 hover:text-primary transition-colors focus:outline-none focus:ring-1 focus:ring-primary rounded"
          >
            <PhoneCall className="w-3.5 h-3.5 text-primary" />
            <span dir="ltr">+212 522 98 76 54</span>
          </a>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div 
          onClick={() => handleTabChange('catalog')}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary rounded-xl p-1"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleTabChange('catalog')}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center text-ink font-black shadow-yellow-glow group-hover:scale-105 transition-transform">
            <Truck className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-sans">
                JADI<span className="text-primary">JCB</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest bg-primary/20 text-primary px-1.5 py-0.5 rounded border border-primary/30">
                BTP MA
              </span>
            </div>
            <span className="text-[11px] text-slate-400 hidden xs:inline-block line-clamp-1">
              {language === 'ar' ? 'سوق الآليات والمعدات الثقيلة' : 'Matériel & Engins BTP Maroc'}
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          <button
            onClick={() => handleTabChange('catalog')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
              activeTab === 'catalog'
                ? 'bg-primary text-ink shadow-sm'
                : 'text-slate-200 hover:text-white hover:bg-steel/50'
            }`}
          >
            {t('nav.catalog')}
          </button>
          
          <button
            onClick={() => handleTabChange('map')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary ${
              activeTab === 'map'
                ? 'bg-primary text-ink shadow-sm'
                : 'text-slate-200 hover:text-white hover:bg-steel/50'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>{t('nav.map')}</span>
          </button>

          <button
            onClick={() => handleTabChange('parts')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary ${
              activeTab === 'parts'
                ? 'bg-primary text-ink shadow-sm'
                : 'text-slate-200 hover:text-white hover:bg-steel/50'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>{t('nav.spare_parts')}</span>
          </button>

          <button
            onClick={() => handleTabChange('saved')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary ${
              activeTab === 'saved'
                ? 'bg-primary text-ink shadow-sm'
                : 'text-slate-200 hover:text-white hover:bg-steel/50'
            }`}
            aria-label={t('nav.saved')}
          >
            <Heart className={`w-4 h-4 ${favorites.length > 0 ? 'fill-danger text-danger' : ''}`} />
            <span>{t('nav.saved')}</span>
            {favorites.length > 0 && (
              <span className="ms-1 px-1.5 py-0.2 bg-danger text-white rounded-full text-xs font-bold font-sans">
                {favorites.length}
              </span>
            )}
          </button>
        </nav>

        {/* Actions (Language Toggle + Add Listing CTA + Mobile Menu Button) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Toggle Button */}
          <button
            onClick={toggleLanguage}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-steel/60 hover:bg-steel text-white border border-steel/80 flex items-center gap-2 text-xs sm:text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary"
            title={i18n.language === 'ar' ? 'Passer en Français' : 'التحويل إلى العربية'}
            aria-label="Toggle language"
          >
            <Globe className="w-4 h-4 text-primary" />
            <span className="font-sans">
              {i18n.language === 'ar' ? 'Français' : 'العربية'}
            </span>
          </button>

          {/* Add Listing Button */}
          <button
            onClick={() => setIsAddListingOpen(true)}
            className="min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-ink font-bold text-xs sm:text-sm shadow-md flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-ink focus:ring-primary"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">{t('nav.add_listing')}</span>
            <span className="sm:hidden">{t('card.rent')} / {t('card.sale')}</span>
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-steel/50 text-white hover:bg-steel focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-ink-light border-b border-steel/60 px-4 pt-3 pb-5 space-y-2 animate-fadeIn">
          <button
            onClick={() => handleTabChange('catalog')}
            className={`w-full min-h-[44px] text-start px-4 py-3 rounded-xl font-bold flex items-center justify-between ${
              activeTab === 'catalog' ? 'bg-primary text-ink' : 'text-slate-100 hover:bg-steel/50'
            }`}
          >
            <span>{t('nav.catalog')}</span>
            <Truck className="w-5 h-5 opacity-70" />
          </button>

          <button
            onClick={() => handleTabChange('map')}
            className={`w-full min-h-[44px] text-start px-4 py-3 rounded-xl font-bold flex items-center justify-between ${
              activeTab === 'map' ? 'bg-primary text-ink' : 'text-slate-100 hover:bg-steel/50'
            }`}
          >
            <span>{t('nav.map')}</span>
            <MapPin className="w-5 h-5 opacity-70" />
          </button>

          <button
            onClick={() => handleTabChange('parts')}
            className={`w-full min-h-[44px] text-start px-4 py-3 rounded-xl font-bold flex items-center justify-between ${
              activeTab === 'parts' ? 'bg-primary text-ink' : 'text-slate-100 hover:bg-steel/50'
            }`}
          >
            <span>{t('nav.spare_parts')}</span>
            <Wrench className="w-5 h-5 opacity-70" />
          </button>

          <button
            onClick={() => handleTabChange('saved')}
            className={`w-full min-h-[44px] text-start px-4 py-3 rounded-xl font-bold flex items-center justify-between ${
              activeTab === 'saved' ? 'bg-primary text-ink' : 'text-slate-100 hover:bg-steel/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{t('nav.saved')}</span>
              {favorites.length > 0 && (
                <span className="px-2 py-0.5 bg-danger text-white rounded-full text-xs font-bold font-sans">
                  {favorites.length}
                </span>
              )}
            </div>
            <Heart className="w-5 h-5 opacity-70" />
          </button>
        </div>
      )}
    </header>
  );
};
