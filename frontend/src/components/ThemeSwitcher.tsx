import { useState } from 'react';
import { useTheme, themes, ThemeName } from '../contexts/ThemeContext';
import './ThemeSwitcher.css';

export function ThemeSwitcher() {
  const { themeName, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleThemeSelect = (newTheme: ThemeName) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  return (
    <div className="theme-switcher">
      <button
        className="theme-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Theme wechseln"
      >
        🎨
      </button>

      {isOpen && (
        <>
          <div className="theme-switcher-backdrop" onClick={() => setIsOpen(false)} />
          <div className="theme-switcher-menu">
            <div className="theme-switcher-header">
              <h3>Theme wählen</h3>
            </div>
            <div className="theme-options">
              {Object.values(themes).map((theme) => (
                <button
                  key={theme.name}
                  className={`theme-option ${themeName === theme.name ? 'active' : ''}`}
                  onClick={() => handleThemeSelect(theme.name)}
                >
                  <div
                    className="theme-preview"
                    style={{
                      background: theme.colors.background,
                    }}
                  >
                    <div className="theme-preview-card" style={{ background: theme.colors.cardBg }}>
                      <div className="theme-preview-dot" style={{ background: theme.colors.accent }}></div>
                    </div>
                  </div>
                  <span className="theme-name">{theme.displayName}</span>
                  {themeName === theme.name && <span className="theme-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
