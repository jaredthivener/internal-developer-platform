import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Providers from '@/app/Providers';
import { useThemeMode } from '@/components/layout/themeMode';

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function ThemeConsumer() {
  const { mode, toggleColorMode } = useThemeMode();

  return (
    <>
      <span>{mode}</span>
      <button type="button" onClick={toggleColorMode}>
        Toggle theme
      </button>
    </>
  );
}

describe('Providers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.style.colorScheme = '';
  });

  it('defaults to dark mode when no stored preference exists', async () => {
    render(
      <Providers>
        <ThemeConsumer />
      </Providers>
    );

    await waitFor(() => {
      expect(screen.getByText('dark')).toBeInTheDocument();
    });

    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('applies the stored preference and updates the document color scheme', async () => {
    window.localStorage.setItem('idp-theme-mode', 'light');

    render(
      <Providers>
        <ThemeConsumer />
      </Providers>
    );

    await waitFor(() => {
      expect(screen.getByText('light')).toBeInTheDocument();
    });

    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('loads a saved theme mode from local storage', async () => {
    window.localStorage.setItem('idp-theme-mode', 'light');

    render(
      <Providers>
        <ThemeConsumer />
      </Providers>
    );

    await waitFor(() => {
      expect(screen.getByText('light')).toBeInTheDocument();
    });
  });

  it('persists theme mode changes to local storage', async () => {
    const user = userEvent.setup();

    render(
      <Providers>
        <ThemeConsumer />
      </Providers>
    );

    await user.click(screen.getByRole('button', { name: /toggle theme/i }));

    await waitFor(() => {
      expect(screen.getByText('light')).toBeInTheDocument();
    });

    expect(window.localStorage.getItem('idp-theme-mode')).toBe('light');
  });
});
