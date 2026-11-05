import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import CloudResourceCatalog from '@/components/features/catalog/CloudResourceCatalog';
import { livePortfolio, unavailablePortfolio } from '@/test/portfolioFixture';

function card(name: string) {
  return within(
    screen
      .getByRole('heading', { name })
      .closest('.MuiGrid-root') as HTMLElement
  );
}

describe('CloudResourceCatalog', () => {
  it('renders the catalog headings', () => {
    render(<CloudResourceCatalog portfolio={livePortfolio} />);

    expect(
      screen.getByRole('heading', { name: /^catalog$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /service catalog/i })
    ).toBeInTheDocument();
  });

  it('shows live inventory, cost and compliance on each card', () => {
    render(<CloudResourceCatalog portfolio={livePortfolio} />);

    const storage = card('Azure Storage Accounts');
    expect(storage.getByText('2 resources')).toBeInTheDocument();
    expect(storage.getByText('2 regions')).toBeInTheDocument();
    expect(storage.getByText('$1.25')).toBeInTheDocument();
    expect(storage.getByText('50% (1 of 2 resources)')).toBeInTheDocument();
    expect(storage.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50'
    );

    const aks = card('Azure Kubernetes Service');
    expect(aks.getByText('1 resource')).toBeInTheDocument();
    expect(aks.getByText('$12.50')).toBeInTheDocument();
    expect(aks.getByText('0% (0 of 1 resource)')).toBeInTheDocument();
  });

  it('shows zero, not unavailable, for a domain with no resources', () => {
    render(<CloudResourceCatalog portfolio={livePortfolio} />);

    const postgres = card('Azure Database for PostgreSQL');
    expect(postgres.getByText('0 resources')).toBeInTheDocument();
    expect(postgres.getByText('$0.00')).toBeInTheDocument();
    expect(postgres.getAllByText('Not evaluated')).toHaveLength(2);
  });

  it('shows the subscription cost total and top services', () => {
    render(<CloudResourceCatalog portfolio={livePortfolio} />);

    expect(
      screen.getByRole('heading', { name: /cost, month to date/i })
    ).toBeInTheDocument();
    expect(screen.getByText('$17.00')).toBeInTheDocument();
    expect(screen.getByText('Virtual Machines')).toBeInTheDocument();
  });

  it('shows overall MCSB compliance and the most failing controls', () => {
    render(<CloudResourceCatalog portfolio={livePortfolio} />);

    expect(
      screen.getByRole('heading', { name: /^compliance$/i })
    ).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(
      screen.getByText(
        /1 of 4 resources compliant with the microsoft cloud security benchmark v2/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('NS-2 Secure cloud services with network controls')
    ).toBeInTheDocument();
    expect(screen.getByText('3 noncompliant resources')).toBeInTheDocument();
  });

  it('says when Azure Policy has not evaluated yet', () => {
    render(
      <CloudResourceCatalog
        portfolio={{
          ...livePortfolio,
          compliance: {
            ...livePortfolio.compliance!,
            overall: { compliant: 0, evaluated: 0 },
            byResourceType: {},
            failingControls: [],
          },
        }}
      />
    );

    expect(
      screen.getByText(/has not finished evaluating/i)
    ).toBeInTheDocument();
  });

  it('says unavailable instead of inventing figures when Azure cannot be read', () => {
    render(<CloudResourceCatalog portfolio={unavailablePortfolio} />);

    expect(screen.getByText(/cost data is unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/compliance data is unavailable/i)
    ).toBeInTheDocument();
    expect(
      card('Azure Storage Accounts').getAllByText('Unavailable')
    ).toHaveLength(5);
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
  });

  it('keeps the catalog workflow actions', () => {
    render(<CloudResourceCatalog portfolio={livePortfolio} />);

    expect(
      screen.getByRole('link', { name: /open storage account workflow/i })
    ).toHaveAttribute('href', '/catalog/azure-storage');
    expect(
      screen.getAllByRole('button', { name: /coming soon/i })
    ).toHaveLength(3);
    expect(screen.getByText(/workflow ready/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^planned$/i)).toHaveLength(3);
  });
});
