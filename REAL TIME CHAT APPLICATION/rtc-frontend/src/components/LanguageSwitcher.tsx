'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Locale } from '@/i18n/translations';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="lang-switcher">
      <button
        className={`lang-btn${locale === 'fr' ? ' active' : ''}`}
        onClick={() => setLocale('fr' as Locale)}
        title="Français"
      >
        FR
      </button>
      <span className="lang-sep">|</span>
      <button
        className={`lang-btn${locale === 'en' ? ' active' : ''}`}
        onClick={() => setLocale('en' as Locale)}
        title="English"
      >
        EN
      </button>
    </div>
  );
}
