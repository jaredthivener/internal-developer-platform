'use client';

import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import type { PaletteMode } from '@mui/material/styles';
import { SessionProvider } from 'next-auth/react';
import {
  type ReactNode,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  THEME_MODE_STORAGE_KEY,
  ThemeModeContext,
  type ThemeModeContextValue,
} from '@/components/layout/themeMode';

const THEME_MODE_EVENT = 'idp:theme-mode-change';

function isPaletteMode(value: string | null): value is PaletteMode {
  return value === 'light' || value === 'dark';
}

function getStoredThemeMode(): PaletteMode {
  const savedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  return isPaletteMode(savedMode) ? savedMode : 'dark';
}

function subscribeToThemeMode(onStoreChange: () => void) {
  function handleThemeModeChange() {
    onStoreChange();
  }

  window.addEventListener('storage', handleThemeModeChange);
  window.addEventListener(THEME_MODE_EVENT, handleThemeModeChange);

  return () => {
    window.removeEventListener('storage', handleThemeModeChange);
    window.removeEventListener(THEME_MODE_EVENT, handleThemeModeChange);
  };
}

function getThemeModeSnapshot(): PaletteMode {
  return getStoredThemeMode();
}

function getServerThemeModeSnapshot(): PaletteMode {
  return 'dark';
}

function persistThemeMode(mode: PaletteMode) {
  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new Event(THEME_MODE_EVENT));
}

export default function Providers({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(
    subscribeToThemeMode,
    getThemeModeSnapshot,
    getServerThemeModeSnapshot
  );

  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const colorMode = useMemo<ThemeModeContextValue>(
    () => ({
      toggleColorMode: () => {
        persistThemeMode(mode === 'light' ? 'dark' : 'light');
      },
      mode,
    }),
    [mode]
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === 'light'
            ? {
                primary: { main: '#1a73e8' },
                secondary: { main: '#188038' },
                background: { default: '#f8f9fa', paper: '#ffffff' },
                text: { primary: '#202124', secondary: '#5f6368' },
                divider: '#dadce0',
              }
            : {
                primary: { main: '#8ab4f8' },
                secondary: { main: '#81c995' },
                background: { default: '#202124', paper: '#292a2d' },
                text: { primary: '#e8eaed', secondary: '#9aa0a6' },
                divider: '#3c4043',
              }),
        },
        typography: {
          fontFamily:
            'var(--font-geist-sans), "Segoe UI", "Helvetica Neue", Arial, sans-serif',
          h5: { fontWeight: 500, letterSpacing: '-0.5px' },
          h6: { fontWeight: 500, letterSpacing: '-0.5px' },
          button: { textTransform: 'none', fontWeight: 500 },
        },
        shape: { borderRadius: 8 },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 4,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow:
                    mode === 'light'
                      ? '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)'
                      : '0 1px 2px 0 rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15)',
                },
              },
            },
          },
          MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
          MuiCard: {
            styleOverrides: {
              root: {
                border: `1px solid ${mode === 'light' ? '#dadce0' : '#3c4043'}`,
                boxShadow: 'none',
                backgroundColor: mode === 'light' ? '#ffffff' : '#292a2d',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: mode === 'light' ? '#ffffff' : '#292a2d',
                color: mode === 'light' ? '#5f6368' : '#e8eaed',
                borderBottom: `1px solid ${mode === 'light' ? '#dadce0' : '#3c4043'}`,
                boxShadow: 'none',
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: mode === 'light' ? '#ffffff' : '#292a2d',
                borderRight: `1px solid ${mode === 'light' ? '#dadce0' : '#3c4043'}`,
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={colorMode}>
      <SessionProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </SessionProvider>
    </ThemeModeContext.Provider>
  );
}
