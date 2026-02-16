import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeName = 'purple' | 'dark' | 'blue' | 'green' | 'sunset';

export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    textLight: string;
    cardBg: string;
    cardBgGradient?: string;
    accent: string;
    success: string;
    danger: string;
    warning: string;
  };
}

export const themes: Record<ThemeName, Theme> = {
  purple: {
    name: 'purple',
    displayName: '🟣 Purple Dream',
    colors: {
      primary: '#667eea',
      secondary: '#764ba2',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      text: '#ffffff',
      textLight: 'rgba(255, 255, 255, 0.9)',
      cardBg: '#ffffff',
      accent: '#667eea',
      success: '#28a745',
      danger: '#dc3545',
      warning: '#ffc107',
    },
  },
  dark: {
    name: 'dark',
    displayName: '🌙 Dark Mode',
    colors: {
      primary: '#1a1a2e',
      secondary: '#16213e',
      background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%)',
      text: '#ffffff',
      textLight: 'rgba(255, 255, 255, 0.8)',
      cardBg: '#16213e',
      accent: '#8b5cf6',
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
    },
  },
  blue: {
    name: 'blue',
    displayName: '🔵 Ocean Blue',
    colors: {
      primary: '#0575e6',
      secondary: '#021b79',
      background: 'linear-gradient(135deg, #0575e6 0%, #021b79 100%)',
      text: '#ffffff',
      textLight: 'rgba(255, 255, 255, 0.9)',
      cardBg: '#ffffff',
      accent: '#0575e6',
      success: '#28a745',
      danger: '#dc3545',
      warning: '#ffc107',
    },
  },
  green: {
    name: 'green',
    displayName: '🟢 Forest Green',
    colors: {
      primary: '#11998e',
      secondary: '#38ef7d',
      background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      text: '#ffffff',
      textLight: 'rgba(255, 255, 255, 0.9)',
      cardBg: '#ffffff',
      accent: '#11998e',
      success: '#28a745',
      danger: '#dc3545',
      warning: '#ffc107',
    },
  },
  sunset: {
    name: 'sunset',
    displayName: '🌅 Warm Sunset',
    colors: {
      primary: '#f46b45',
      secondary: '#eea849',
      background: 'linear-gradient(135deg, #f46b45 0%, #eea849 100%)',
      text: '#ffffff',
      textLight: 'rgba(255, 255, 255, 0.9)',
      cardBg: '#ffffff',
      accent: '#f46b45',
      success: '#28a745',
      danger: '#dc3545',
      warning: '#ffc107',
    },
  },
};

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeName: ThemeName) => void;
  themeName: ThemeName;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('selectedTheme');
    return (saved as ThemeName) || 'purple';
  });

  const currentTheme = themes[themeName];

  useEffect(() => {
    // Apply theme CSS variables to document root
    const root = document.documentElement;
    Object.entries(currentTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Save to localStorage
    localStorage.setItem('selectedTheme', themeName);
  }, [themeName, currentTheme]);

  const setTheme = (newTheme: ThemeName) => {
    setThemeName(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themeName }}>
      {children}
    </ThemeContext.Provider>
  );
};
