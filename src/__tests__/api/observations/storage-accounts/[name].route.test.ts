import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/observations/storage-accounts/[name]/route';
import { getStorageAccountObservationByName } from '@/lib/observations/storageAccounts';

vi.mock('@/lib/observations/storageAccounts', () => ({
  getStorageAccountObservationByName: vi.fn(),
}));

describe('GET /api/observations/storage-accounts/[name]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a detailed observation document', async () => {
    vi.mocked(getStorageAccountObservationByName).mockResolvedValueOnce({
      scan: {
        source: 'crossplane+azure',
        observedAt: '2026-03-22T20:00:00Z',
        cacheTtlSeconds: 300,
      },
      data: {
        resourceName: 'devstorealpha01',
        resourceKey:
          '/subscriptions/test/resourcegroups/idp-crossplane-smoke/providers/microsoft.storage/storageaccounts/devstorealpha01',
        classification: {
          code: 'config_drift',
          severity: 'warning',
          reasonCodes: ['replicationType'],
          diffCount: 1,
        },
        ownership: {
          requestId: 'req-123',
          managedBy: 'idp',
        },
        desired: {
          resourceGroupName: 'idp-crossplane-smoke',
          location: 'eastus2',
          accountTier: 'Standard',
          replicationType: 'LRS',
          accessTier: 'Hot',
        },
        live: {
          resourceGroupName: 'idp-crossplane-smoke',
          location: 'eastus2',
          accountTier: 'Standard',
          replicationType: 'GRS',
          accessTier: 'Hot',
        },
        crossplane: {
          name: 'devstorealpha01',
          ready: true,
          synced: true,
        },
        normalizedDesired: {
          replicationType: 'LRS',
        },
        normalizedLive: {
          replicationType: 'GRS',
        },
        diffs: [
          {
            field: 'replicationType',
            desired: 'LRS',
            live: 'GRS',
            category: 'sku',
          },
        ],
        observedAt: '2026-03-22T20:00:00Z',
      },
    });

    const req = new NextRequest(
      'http://localhost:3000/api/observations/storage-accounts/devstorealpha01'
    );
    const res = await GET(req, {
      params: Promise.resolve({ name: 'devstorealpha01' }),
    });

    expect(res.status).toBe(200);
    expect(getStorageAccountObservationByName).toHaveBeenCalledWith(
      'devstorealpha01',
      {
        forceRefresh: false,
      }
    );

    const body = await res.json();
    expect(body.data.classification.code).toBe('config_drift');
    expect(body.data.diffs).toHaveLength(1);
  });

  it('returns 404 when no matching resource exists', async () => {
    vi.mocked(getStorageAccountObservationByName).mockResolvedValueOnce(null);

    const req = new NextRequest(
      'http://localhost:3000/api/observations/storage-accounts/missing-account'
    );
    const res = await GET(req, {
      params: Promise.resolve({ name: 'missing-account' }),
    });

    expect(res.status).toBe(404);
  });
});
