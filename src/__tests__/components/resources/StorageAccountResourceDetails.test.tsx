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
        data: {
          metadata: {
            name: 'devstorealpha01',
            creationTimestamp: '2026-03-20T15:15:00Z',
          },
          spec: {
            forProvider: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              accountTier: 'Standard',
              accountReplicationType: 'LRS',
              accessTier: 'Hot',
              publicNetworkAccessEnabled: true,
            },
          },
          status: {
            atProvider: {
              id: '/subscriptions/test/resourceGroups/idp-crossplane-smoke/providers/Microsoft.Storage/storageAccounts/devstorealpha01',
            },
            conditions: [{ type: 'Ready', status: 'True' }],
          },
        },
      }),
    } as Response);

    render(<StorageAccountResourceDetails resourceName="devstorealpha01" />);

    expect(
      await screen.findByRole('heading', { name: /devstorealpha01/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/resource group: idp-crossplane-smoke/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/account tier: standard/i)).toBeInTheDocument();
    expect(screen.getByText(/replication: lrs/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete resource/i })
    ).toBeInTheDocument();
  });

  it('deletes the storage account and navigates back to the resources page', async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            metadata: { name: 'devstorealpha01' },
            spec: {
              forProvider: {
                resourceGroupName: 'idp-crossplane-smoke',
                location: 'eastus2',
              },
            },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
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
});
