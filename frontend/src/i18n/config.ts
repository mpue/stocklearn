import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from '../locales/de.json';
import en from '../locales/en.json';

const resources = {
  de: { translation: de },
  en: { translation: en },
};

// Get saved language from localStorage or default to 'de'
const savedLanguage = localStorage.getItem('language') || 'de';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
