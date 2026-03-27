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
        scan: {
          source: 'crossplane+azure',
          observedAt: '2026-03-22T20:00:00Z',
          cacheTtlSeconds: 300,
        },
        data: [
          {
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
              replicationType: 'LRS',
              accessTier: 'Hot',
            },
            live: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              replicationType: 'LRS',
              accessTier: 'Hot',
            },
            observedAt: '2026-03-22T20:00:00Z',
          },
        ],
      }),
    } as Response);

    render(<StorageAccountResourceList />);

    expect(
      await screen.findByRole('heading', { name: /devstorealpha01/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/^Azure Storage Account$/i)).toBeInTheDocument();
    expect(screen.getByText(/idp-crossplane-smoke/i)).toBeInTheDocument();
    expect(screen.getByText(/eastus2/i)).toBeInTheDocument();
    expect(screen.getByText(/in sync/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /view details for devstorealpha01/i })
    ).toHaveAttribute('href', '/resources/devstorealpha01');
  });

  it('renders an empty state when no storage accounts exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scan: {
          source: 'crossplane+azure',
          observedAt: '2026-03-22T20:00:00Z',
          cacheTtlSeconds: 300,
        },
        data: [],
      }),
    } as Response);

    render(<StorageAccountResourceList />);

    expect(
      await screen.findByText(/no managed resources are available yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /storage accounts created from the catalog will appear here first/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open the storage workflow/i })
    ).toHaveAttribute('href', '/catalog/azure-storage');
  });

  it('keeps the empty state tied to the live storage workflow descriptor', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scan: {
          source: 'crossplane+azure',
          observedAt: '2026-03-22T20:00:00Z',
          cacheTtlSeconds: 300,
        },
        data: [],
      }),
    } as Response);

    render(<StorageAccountResourceList />);

    expect(
      await screen.findByText(
        /storage accounts created from the catalog will appear here first/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open the storage workflow/i })
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
              resourceName: 'devstorealpha01',
              classification: {
                code: 'deleting',
                severity: 'warning',
                reasonCodes: ['deleting'],
                diffCount: 0,
              },
              desired: {
                resourceGroupName: 'idp-crossplane-smoke',
                location: 'eastus2',
                replicationType: 'LRS',
                accessTier: 'Hot',
              },
              live: {
                resourceGroupName: 'idp-crossplane-smoke',
                location: 'eastus2',
                replicationType: 'LRS',
                accessTier: 'Hot',
              },
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scan: {
            source: 'crossplane+azure',
            observedAt: '2026-03-22T20:00:03Z',
            cacheTtlSeconds: 300,
          },
          data: [],
        }),
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

  it('renders drift classification when Azure differs from the desired state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scan: {
          source: 'crossplane+azure',
          observedAt: '2026-03-22T20:00:00Z',
          cacheTtlSeconds: 300,
        },
        data: [
          {
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
              replicationType: 'LRS',
              accessTier: 'Hot',
            },
            live: {
              resourceGroupName: 'idp-crossplane-smoke',
              location: 'eastus2',
              replicationType: 'GRS',
              accessTier: 'Hot',
            },
            observedAt: '2026-03-22T20:00:00Z',
          },
        ],
      }),
    } as Response);

    render(<StorageAccountResourceList />);

    expect(
      await screen.findByRole('heading', { name: /devstorealpha01/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/drifted/i)).toBeInTheDocument();
    expect(screen.getByText(/1 difference/i)).toBeInTheDocument();
  });
});
