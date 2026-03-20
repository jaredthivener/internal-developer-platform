import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SettingsPage from '@/app/settings/page';

describe('Settings Page', () => {
  it('renders the settings title and control sections', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Settings'
    );
    expect(
      screen.getByText(
        /manage platform access, delivery defaults, and environment guardrails/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /platform controls/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /environment defaults/i })
    ).toBeInTheDocument();
  });
});
