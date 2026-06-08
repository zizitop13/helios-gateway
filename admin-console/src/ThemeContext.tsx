import React, { createContext, useContext, useState, useEffect } from 'react';
import type { MantineThemeOverride } from '@mantine/core';

interface ThemeContextType {
  colorScheme: 'light' | 'dark';
  toggleColorScheme: () => void;
  theme: MantineThemeOverride;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

const lightTheme: MantineThemeOverride = {
  primaryColor: 'blue',
  primaryShade: 6,
  colors: {
    gray: [
      '#F8F9FA',
      '#F1F3F5',
      '#E9ECEF',
      '#DEE2E6',
      '#CED4DA',
      '#ADB5BD',
      '#868E96',
      '#495057',
      '#212529',
      '#000000',
    ],
  },
  components: {
    AppShell: {
      defaultProps: {
        styles: {
          main: {
            backgroundColor: '#FFFFFF',
            color: '#212529',
          },
        },
      },
    },
    Paper: {
      defaultProps: {
        styles: {
          root: {
            color: '#212529',
          },
        },
      },
    },
    Text: {
      defaultProps: {
        styles: {
          root: {
            color: '#212529',
          },
        },
      },
    },
  },
};

const darkTheme: MantineThemeOverride = {
  colors: {
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5c5f66',
      '#373A40',
      '#2C2E33',
      '#25262b',
      '#1A1B1E',
      '#0D1117',
      '#000000',
    ],
  },
  primaryColor: 'blue',
  primaryShade: 6,
  components: {
    AppShell: {
      defaultProps: {
        styles: {
          main: {
            backgroundColor: '#0D1117',
          },
        },
      },
    },
  },
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme-preference');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme-preference', colorScheme);
  }, [colorScheme]);

  const toggleColorScheme = () => {
    setColorScheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const theme: MantineThemeOverride = colorScheme === 'dark' ? darkTheme : lightTheme;

  return <ThemeContext.Provider value={{ colorScheme, toggleColorScheme, theme }}>{children}</ThemeContext.Provider>;
};









