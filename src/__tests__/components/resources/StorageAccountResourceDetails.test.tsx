import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StorageAccountResourceDetails from '@/components/features/resources/StorageAccountResourceDetails';

const mockFetch = vi.fn();
const mockPush = vi.fn();

global.fetch = mockFetch;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('StorageAccountResourceDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders detailed storage account metadata and actions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scan: {
          source: 'crossplane+azure',
          observedAt: '2026-03-22T20:00:00Z',
          cacheTtlSeconds: 300,
        },
        data: {
          resourceName: 'devstorealpha01',
          classification: {
            code: 'config_drift',
            severity: 'warning',
            reasonCodes: ['replicationType'],
            diffCount: 1,
          },
          desired: {
            resourceGroupName: 'idp-crossplane-smoke',
            location: 'eastus2',
            accountTier: 'Standard',
            replicationType: 'LRS',
            accessTier: 'Hot',
            publicNetworkAccessEnabled: true,
          },
          live: {
            resourceGroupName: 'idp-crossplane-smoke',
            location: 'eastus2',
            accountTier: 'Standard',
            replicationType: 'GRS',
            accessTier: 'Hot',
            publicNetworkAccessEnabled: true,
          },
          crossplane: {
            name: 'devstorealpha01',
            ready: true,
            synced: true,
          },
          azureResourceId:
            '/subscriptions/test/resourceGroups/idp-crossplane-smoke/providers/Microsoft.Storage/storageAccounts/devstorealpha01',
          diffs: [
            {
              field: 'replicationType',
              desired: 'LRS',
              live: 'GRS',
              category: 'sku',
            },
          ],
        },
      }),
    } as Response);

    render(<StorageAccountResourceDetails resourceName="devstorealpha01" />);

    expect(
      await screen.findByRole('heading', { name: /devstorealpha01/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/^Azure Storage Account$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Resource group$/i)).toBeInTheDocument();
    expect(screen.getByText(/^idp-crossplane-smoke$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Account tier$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Standard$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Desired replication$/i)).toBeInTheDocument();
    expect(screen.getByText(/^LRS$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Live replication$/i)).toBeInTheDocument();
    expect(screen.getByText(/^GRS$/i)).toBeInTheDocument();
    expect(screen.getByText(/drifted/i)).toBeInTheDocument();
    expect(screen.getByText(/replication type/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /refresh status/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sync resource/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete resource/i })
    ).toBeInTheDocument();
  });

  it('renders a generic not-found message when the managed resource is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: null }),
    } as Response);

    render(<StorageAccountResourceDetails resourceName="missing-resource" />);

    expect(
      await screen.findByText(/managed resource not found/i)
    ).toBeInTheDocument();
  });

  it('requests a sync-back for a drifted storage account', async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scan: {
            source: 'crossplane+azure',
            observedAt: '2026-03-22T20:00:00Z',
            cacheTtlSeconds: 300,
          },
          data: {
            resourceName: 'devstorealpha01',
            classification: {
              code: 'config_drift',
              severity: 'warning',
              reasonCodes: ['replicationType'],
              diffCount: 1,
            },
            desired: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              accountTier: 'Standard',
              replicationType: 'LRS',
              accessTier: 'Hot',
              publicNetworkAccessEnabled: true,
            },
            live: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              accountTier: 'Standard',
              replicationType: 'GRS',
              accessTier: 'Hot',
              publicNetworkAccessEnabled: true,
            },
            crossplane: {
              name: 'devstorealpha01',
              ready: true,
              synced: true,
            },
            azureResourceId:
              '/subscriptions/test/resourceGroups/idp-crossplane-smoke/providers/Microsoft.Storage/storageAccounts/devstorealpha01',
            diffs: [
              {
                field: 'replicationType',
                desired: 'LRS',
                live: 'GRS',
                category: 'sku',
              },
            ],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { metadata: { name: 'devstorealpha01' } } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scan: {
            source: 'crossplane+azure',
            observedAt: '2026-03-22T20:01:00Z',
            cacheTtlSeconds: 300,
          },
          data: {
            resourceName: 'devstorealpha01',
            classification: {
              code: 'provisioning',
              severity: 'info',
              reasonCodes: ['ready'],
              diffCount: 0,
            },
            desired: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              accountTier: 'Standard',
              replicationType: 'LRS',
              accessTier: 'Hot',
              publicNetworkAccessEnabled: true,
            },
            live: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              accountTier: 'Standard',
              replicationType: 'LRS',
              accessTier: 'Hot',
              publicNetworkAccessEnabled: true,
            },
            crossplane: {
              name: 'devstorealpha01',
              ready: false,
              synced: true,
            },
            azureResourceId:
              '/subscriptions/test/resourceGroups/idp-crossplane-smoke/providers/Microsoft.Storage/storageAccounts/devstorealpha01',
            diffs: [],
          },
        }),
      } as Response);

    render(<StorageAccountResourceDetails resourceName="devstorealpha01" />);

    await screen.findByRole('heading', { name: /devstorealpha01/i });
    await user.click(screen.getByRole('button', { name: /sync resource/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/crossplane/resources',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('accountReplicationType'),
        })
      );
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/observations/storage-accounts/devstorealpha01?refresh=true'
      );
    });

    expect(
      screen.getByText(
        /sync requested\. crossplane will reconcile the desired state/i
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Pending$/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /sync resource/i })
    ).not.toBeInTheDocument();
  });

  it('refreshes the resource details on demand', async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scan: {
            source: 'crossplane+azure',
            observedAt: '2026-03-22T20:00:00Z',
            cacheTtlSeconds: 300,
          },
          data: {
            resourceName: 'devstorealpha01',
            classification: {
              code: 'provisioning',
              severity: 'info',
              reasonCodes: ['ready'],
              diffCount: 0,
            },
            desired: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              accountTier: 'Standard',
              replicationType: 'LRS',
              accessTier: 'Hot',
              publicNetworkAccessEnabled: true,
            },
            live: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              accountTier: 'Standard',
              replicationType: 'LRS',
              accessTier: 'Hot',
              publicNetworkAccessEnabled: true,
            },
            crossplane: {
              name: 'devstorealpha01',
              ready: false,
              synced: true,
            },
            diffs: [],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scan: {
            source: 'crossplane+azure',
            observedAt: '2026-03-22T20:05:00Z',
            cacheTtlSeconds: 300,
          },
          data: {
            resourceName: 'devstorealpha01',
            classification: {
              code: 'in_sync',
              severity: 'success',
              reasonCodes: [],
              diffCount: 0,
            },
            desired: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              accountTier: 'Standard',
              replicationType: 'LRS',
              accessTier: 'Hot',
              publicNetworkAccessEnabled: true,
            },
            live: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              accountTier: 'Standard',
              replicationType: 'LRS',
              accessTier: 'Hot',
              publicNetworkAccessEnabled: true,
            },
            crossplane: {
              name: 'devstorealpha01',
              ready: true,
              synced: true,
            },
            diffs: [],
          },
        }),
      } as Response);

    render(<StorageAccountResourceDetails resourceName="devstorealpha01" />);

    await screen.findByRole('heading', { name: /devstorealpha01/i });
    expect(screen.getAllByText(/^Pending$/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /refresh status/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/observations/storage-accounts/devstorealpha01?refresh=true'
      );
    });

    expect(await screen.findByText(/^In sync$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/status refreshed from the latest observation snapshot/i)
    ).toBeInTheDocument();
  });

  it('deletes the storage account and navigates back to the resources page', async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scan: {
            source: 'crossplane+azure',
            observedAt: '2026-03-22T20:00:00Z',
            cacheTtlSeconds: 300,
          },
          data: {
            resourceName: 'devstorealpha01',
            classification: {
              code: 'in_sync',
              severity: 'success',
              reasonCodes: [],
              diffCount: 0,
            },
            desired: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
            },
            live: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
            },
            crossplane: {
              name: 'devstorealpha01',
              ready: true,
            },
            diffs: [],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { metadata: { name: 'devstorealpha01' } } }),
      } as Response);

    render(<StorageAccountResourceDetails resourceName="devstorealpha01" />);

    await screen.findByRole('heading', { name: /devstorealpha01/i });
    await user.click(screen.getByRole('button', { name: /delete resource/i }));
    expect(
      screen.getByRole('heading', { name: /confirm deletion/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /this starts deletion for the storage account and removes it from the platform inventory once reconciliation completes/i
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/crossplane/resources',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    expect(screen.getByText(/^Deleting$/i)).toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith(
      '/resources?deleting=devstorealpha01'
    );
  });

  it('renders an error state when the observation fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Azure observation unavailable' }),
    } as Response);

    render(<StorageAccountResourceDetails resourceName="devstorealpha01" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /azure observation unavailable/i
    );
  });
});
