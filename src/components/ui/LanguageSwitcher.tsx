import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark' | 'header';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { lang, toggleLanguage } = useLanguage();

  const isDark = variant === 'dark';

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isDark
          ? 'bg-steel-800 text-white hover:bg-steel-700 border border-steel-700'
          : 'bg-steel-100 text-steel-800 hover:bg-steel-200 border border-steel-200'
      } ${className}`}
      aria-label={`تغيير اللغة إلى ${lang === 'ar' ? 'الفرنسية' : 'العربية'} / Changer de langue`}
      title={lang === 'ar' ? 'Passer en Français' : 'التحويل إلى العربية'}
    >
      <Languages className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
      <span className="font-semibold tracking-wide">
        {lang === 'ar' ? 'FR' : 'عر'}
      </span>
      <span className="text-[11px] opacity-75 font-normal">
        {lang === 'ar' ? 'Français' : 'العربية'}
      </span>
    </button>
  );
};

export default LanguageSwitcher;
