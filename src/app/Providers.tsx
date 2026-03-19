'use client';

import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { SessionProvider } from 'next-auth/react';
import React, { ReactNode, createContext, useMemo, useState } from 'react';

// Create a context so deep components can toggle the theme
export const ThemeModeContext = createContext({
  toggleColorMode: () => {},
  mode: 'dark',
});

export default function Providers({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
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
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
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
