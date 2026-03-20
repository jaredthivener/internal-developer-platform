import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ApplicationsPage from '@/app/applications/page';

describe('Applications Page', () => {
  it('renders the applications title and supporting copy', () => {
    render(<ApplicationsPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Applications'
    );
    expect(
      screen.getByText(
        /track onboarding status, runtime ownership, and delivery readiness/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /application inventory/i })
    ).toBeInTheDocument();
  });
});
