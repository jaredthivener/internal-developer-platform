import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';

vi.mock('@/components/features/crossplane/CompositionList', () => ({
  default: () => <div>Application Environments</div>,
}));

vi.mock('@/components/features/crossplane/ResourceProvisioner', () => ({
  default: () => <div>Provision Application Base</div>,
}));

describe('Home Page', () => {
  it('renders the portal title', () => {
    render(<Home />);

    // Check if the primary title is rendered
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Dashboard'
    );
  });

  it('renders a welcome message', () => {
    render(<Home />);
    expect(
      screen.getByText(
        /Manage your application environments and self-service deployments/i
      )
    ).toBeInTheDocument();
  });
});
