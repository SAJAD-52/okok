import { useTranslation } from 'react-i18next';
import { useCallback, useEffect } from 'react';
import { applyHtmlDirAndLang } from '../i18n';

const STORAGE_KEY = 'jadijcb_lang';

export function useLanguage() {
  const { i18n, t } = useTranslation();
  const currentLang = (i18n.language === 'fr' ? 'fr' : 'ar') as 'ar' | 'fr';
  const isRTL = currentLang === 'ar';

  const setLanguage = useCallback((lang: 'ar' | 'fr') => {
    i18n.changeLanguage(lang);
    applyHtmlDirAndLang(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }, [i18n]);

  const toggleLanguage = useCallback(() => {
    const nextLang = currentLang === 'ar' ? 'fr' : 'ar';
    setLanguage(nextLang);
  }, [currentLang, setLanguage]);

  useEffect(() => {
    applyHtmlDirAndLang(currentLang);
  }, [currentLang]);

  const formatCurrency = useCallback((amount: number): string => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      useGrouping: true,
      maximumFractionDigits: 0,
    }).format(amount);
    return isRTL ? `${formatted} د.م` : `${formatted} MAD`;
  }, [isRTL]);

  return {
    lang: currentLang,
    isRTL,
    setLanguage,
    toggleLanguage,
    formatCurrency,
    t,
  };
}
