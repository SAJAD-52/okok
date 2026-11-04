import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import arTranslations from './ar.json';
import frTranslations from './fr.json';

const STORAGE_KEY = 'jadijcb_lang';

export const getSavedLanguage = (): 'ar' | 'fr' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'fr') {
      return saved;
    }
  }
  return 'ar'; // Default language = Arabic as per prompt rule 6
};

export const applyHtmlDirAndLang = (lang: 'ar' | 'fr') => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }
};

const initialLang = getSavedLanguage();
applyHtmlDirAndLang(initialLang);

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: arTranslations },
      fr: { translation: frTranslations },
    },
    lng: initialLang,
    fallbackLng: 'ar',
    interpolation: {
      escapeValue: false,
    },
  });

export const toggleLanguage = () => {
  const currentLang = i18n.language === 'ar' ? 'fr' : 'ar';
  i18n.changeLanguage(currentLang);
  applyHtmlDirAndLang(currentLang);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, currentLang);
  }
  return currentLang;
};

export const setAppLanguage = (lang: 'ar' | 'fr') => {
  i18n.changeLanguage(lang);
  applyHtmlDirAndLang(lang);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lang);
  }
};

export default i18n;
