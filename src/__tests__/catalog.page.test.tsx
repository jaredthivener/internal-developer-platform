import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CatalogPage from '@/app/catalog/page';

vi.mock('@/components/features/catalog/CloudResourceCatalog', () => ({
  default: () => <div>Catalog Resource Grid</div>,
}));

describe('Catalog Page', () => {
  it('renders the catalog page title and summary', () => {
    render(<CatalogPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Catalog'
    );
    expect(
      screen.getByText(
        /choose a platform resource, review its operating context/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Catalog Resource Grid')).toBeInTheDocument();
  });
});
