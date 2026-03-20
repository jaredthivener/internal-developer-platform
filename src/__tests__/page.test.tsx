import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';

vi.mock('@/components/features/catalog/CloudEstateOverview', () => ({
  default: () => <div>Cloud Estate Overview</div>,
}));

vi.mock('@/components/features/catalog/CloudResourceCatalog', () => ({
  default: () => <div>Azure Resource Catalog</div>,
}));

describe('Home Page', () => {
  it('renders the estate title', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Cloud Estate'
    );
  });

  it('renders the estate summary message', () => {
    render(<Home />);
    expect(
      screen.getByText(
        /explore the platform-owned azure estate through a clean catalog view/i
      )
    ).toBeInTheDocument();
  });
});
