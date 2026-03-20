import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StorageAccountResourceList from '@/components/features/resources/StorageAccountResourceList';

const mockFetch = vi.fn();
const mockReplace = vi.fn();
const mockSearchParams = vi.fn(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams(),
}));

global.fetch = mockFetch;

describe('StorageAccountResourceList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders storage account resources as cards with links to details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            metadata: {
              name: 'devstorealpha01',
              creationTimestamp: '2026-03-20T15:15:00Z',
            },
            spec: {
              forProvider: {
                resourceGroupName: 'idp-crossplane-smoke',
                location: 'eastus2',
                accountReplicationType: 'LRS',
                accessTier: 'Hot',
              },
            },
            status: {
              conditions: [{ type: 'Ready', status: 'True' }],
              atProvider: {
                id: '/subscriptions/test/resourceGroups/idp-crossplane-smoke/providers/Microsoft.Storage/storageAccounts/devstorealpha01',
              },
            },
          },
        ],
      }),
    } as Response);

    render(<StorageAccountResourceList />);

    expect(
      await screen.findByRole('heading', { name: /devstorealpha01/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/idp-crossplane-smoke/i)).toBeInTheDocument();
    expect(screen.getByText(/eastus2/i)).toBeInTheDocument();
    expect(screen.getByText(/ready/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /view details for devstorealpha01/i })
    ).toHaveAttribute('href', '/resources/devstorealpha01');
  });

  it('renders an empty state when no storage accounts exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    render(<StorageAccountResourceList />);

    expect(
      await screen.findByText(/no storage accounts have been provisioned yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open the catalog to create one/i })
    ).toHaveAttribute('href', '/catalog/azure-storage');
  });

  it('shows a deleting state and removes the card after the resource disappears', async () => {
    vi.useFakeTimers();
    mockSearchParams.mockReturnValue(
      new URLSearchParams('deleting=devstorealpha01')
    );

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              metadata: { name: 'devstorealpha01' },
              spec: {
                forProvider: {
                  resourceGroupName: 'idp-crossplane-smoke',
                  location: 'eastus2',
                  accountReplicationType: 'LRS',
                  accessTier: 'Hot',
                },
              },
              status: {
                conditions: [{ type: 'Ready', status: 'True' }],
              },
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

    render(<StorageAccountResourceList />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByRole('heading', { name: /devstorealpha01/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/^Deleting$/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
      await Promise.resolve();
    });

    expect(
      screen.queryByRole('heading', { name: /devstorealpha01/i })
    ).not.toBeInTheDocument();

    expect(mockReplace).toHaveBeenCalledWith('/resources');
  });

  it('renders an error state when the resource fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Cluster API unavailable' }),
    } as Response);

    render(<StorageAccountResourceList />);

    await waitFor(() => {
      expect(screen.getByText(/cluster api unavailable/i)).toBeInTheDocument();
    });
  });
});
