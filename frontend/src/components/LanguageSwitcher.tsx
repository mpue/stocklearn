import { useLanguage, Language } from '../contexts/LanguageContext';
import './LanguageSwitcher.css';

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="language-switcher">
      {languages.map((lang) => (
        <button
          key={lang.code}
          className={`language-btn ${language === lang.code ? 'active' : ''}`}
          onClick={() => setLanguage(lang.code)}
          title={lang.label}
        >
          <span className="language-flag">{lang.flag}</span>
          <span className="language-label">{lang.label}</span>
        </button>
      ))}
    </div>
  );
}
