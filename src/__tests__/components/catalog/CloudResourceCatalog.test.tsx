import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import CloudResourceCatalog from '@/components/features/catalog/CloudResourceCatalog';

describe('CloudResourceCatalog', () => {
  it('renders the azure resource catalog title and supporting text', () => {
    render(<CloudResourceCatalog />);

    expect(
      screen.getByRole('heading', { name: /^catalog$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /azure resource catalog/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/browse platform-owned services by control plane area/i)
    ).toBeInTheDocument();
  });

  it('renders the core azure catalog entries', () => {
    render(<CloudResourceCatalog />);

    expect(screen.getByText('Azure Kubernetes Service')).toBeInTheDocument();
    expect(screen.getByText('Azure Storage')).toBeInTheDocument();
    expect(
      screen.getByText('Azure Database for PostgreSQL')
    ).toBeInTheDocument();
    expect(screen.getByText('Azure Virtual Network')).toBeInTheDocument();
  });

  it('renders cost and security insight panels', () => {
    render(<CloudResourceCatalog />);

    expect(
      screen.getByRole('heading', { name: /cost watchlist/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /security posture/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/aks compute spend/i)).toBeInTheDocument();
    expect(
      screen.getByText(/public network access left enabled/i)
    ).toBeInTheDocument();
  });

  it('renders catalog actions from the resource cards', () => {
    render(<CloudResourceCatalog />);

    expect(
      screen.getByRole('link', { name: /open azure storage workflow/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /coming soon/i })
    ).toHaveLength(3);
  });

  it('links the azure storage card to the catalog workflow route', () => {
    render(<CloudResourceCatalog />);

    expect(
      screen.getByRole('link', { name: /open azure storage workflow/i })
    ).toHaveAttribute('href', '/catalog/azure-storage');
  });
});
