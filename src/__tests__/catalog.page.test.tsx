import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { unavailablePortfolio } from '@/test/portfolioFixture';
import CatalogPage from '@/app/catalog/page';

vi.mock('@/lib/catalog/livePortfolio', () => ({
  getLivePortfolio: vi.fn(async () => unavailablePortfolio),
}));

vi.mock('@/components/features/catalog/CloudResourceCatalog', () => ({
  default: () => <div>Catalog Resource Grid</div>,
}));

describe('Catalog Page', () => {
  it('renders the catalog page title and summary', async () => {
    render(await CatalogPage());

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
