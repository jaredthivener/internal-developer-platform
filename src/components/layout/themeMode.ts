'use client';

import { createContext, useContext } from 'react';
import type { PaletteMode } from '@mui/material/styles';

export type ThemeModeContextValue = {
  mode: PaletteMode;
  toggleColorMode: () => void;
};

export const THEME_MODE_STORAGE_KEY = 'idp-theme-mode';

const defaultThemeModeContextValue: ThemeModeContextValue = {
  mode: 'dark',
  toggleColorMode: () => {},
};

export const ThemeModeContext = createContext<ThemeModeContextValue>(
  defaultThemeModeContextValue
);

export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}
