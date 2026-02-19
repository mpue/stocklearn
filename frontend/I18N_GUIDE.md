# Internationalization (i18n) Guide

This application now supports multiple languages using react-i18next.

## Currently Supported Languages

- 🇩🇪 **German (de)** - Default language
- 🇬🇧 **English (en)**

## How to Use Translations in Components

### 1. Import the useTranslation hook

```tsx
import { useTranslation } from 'react-i18next';
```

### 2. Use the hook in your component

```tsx
export function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('mySection.title')}</h1>
      <p>{t('mySection.description')}</p>
    </div>
  );
}
```

### 3. Add translations to the JSON files

**In `/src/locales/de.json`:**
```json
{
  "mySection": {
    "title": "Mein Titel",
    "description": "Meine Beschreibung"
  }
}
```

**In `/src/locales/en.json`:**
```json
{
  "mySection": {
    "title": "My Title",
    "description": "My Description"
  }
}
```

## Translation with Variables

Use interpolation for dynamic values:

```tsx
// In component
<p>{t('lobby.gamesWaiting', { count: 5 })}</p>

// In translation file
{
  "lobby": {
    "gamesWaiting": "{{count}} game waiting",
    "gamesWaiting_plural": "{{count}} games waiting"
  }
}
```

## Components Already Translated

- ✅ Lobby
- ✅ Login
- ✅ Register
- ✅ Dashboard (partial)

## Components Still To Translate

- ⏳ ChessGame
- ⏳ GameAnalysis
- ⏳ GameChat
- ⏳ AdminDashboard and all admin subcomponents
- ⏳ InviteAccept

## Language Switcher

The `LanguageSwitcher` component is already integrated into the Dashboard header. Users can switch between German and English by clicking the language flags.

The selected language is automatically saved to `localStorage` and persists across sessions.

## Adding a New Language

1. Create a new translation file: `/src/locales/[language-code].json`
2. Copy the structure from `de.json` or `en.json`
3. Translate all values
4. Add the language to `/src/i18n/config.ts`:

```typescript
import fr from '../locales/fr.json'; // Example: French

const resources = {
  de: { translation: de },
  en: { translation: en },
  fr: { translation: fr }, // Add new language
};
```

5. Update the `LanguageSwitcher` component to include the new language option
6. Update the `Language` type in `LanguageContext.tsx`:

```typescript
export type Language = 'de' | 'en' | 'fr';
```

## Best Practices

1. **Keep keys organized**: Group related translations under common parent keys
2. **Use descriptive keys**: `auth.loginButton` is better than `btn1`
3. **Maintain consistency**: Use the same key structure across all language files
4. **Test translations**: Switch languages and verify all text displays correctly
5. **Avoid hardcoded strings**: Always use `t()` for user-facing text

## File Structure

```
frontend/src/
├── i18n/
│   └── config.ts           # i18n configuration
├── locales/
│   ├── de.json            # German translations
│   └── en.json            # English translations
├── contexts/
│   └── LanguageContext.tsx # Language state management
└── components/
    └── LanguageSwitcher.tsx # Language selection UI
```
