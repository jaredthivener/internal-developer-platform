import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/observations/storage-accounts/route';
import { getStorageAccountObservations } from '@/lib/observations/storageAccounts';

vi.mock('@/lib/observations/storageAccounts', () => ({
  getStorageAccountObservations: vi.fn(),
}));

describe('GET /api/observations/storage-accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns storage account observation summaries', async () => {
    vi.mocked(getStorageAccountObservations).mockResolvedValueOnce({
      scan: {
        source: 'crossplane+azure',
        observedAt: '2026-03-22T20:00:00Z',
        cacheTtlSeconds: 300,
      },
      data: [
        {
          resourceName: 'devstorealpha01',
          resourceKey:
            '/subscriptions/test/resourcegroups/idp-crossplane-smoke/providers/microsoft.storage/storageaccounts/devstorealpha01',
          azureResourceId:
            '/subscriptions/test/resourceGroups/idp-crossplane-smoke/providers/Microsoft.Storage/storageAccounts/devstorealpha01',
          classification: {
            code: 'in_sync',
            severity: 'success',
            reasonCodes: [],
            diffCount: 0,
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
            replicationType: 'LRS',
            accessTier: 'Hot',
          },
          observedAt: '2026-03-22T20:00:00Z',
        },
      ],
    });

    const req = new NextRequest(
      'http://localhost:3000/api/observations/storage-accounts'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getStorageAccountObservations).toHaveBeenCalledWith({
      forceRefresh: false,
    });

    const body = await res.json();
    expect(body.scan.source).toBe('crossplane+azure');
    expect(body.data).toHaveLength(1);
    expect(body.data[0].classification.code).toBe('in_sync');
  });

  it('passes through refresh intent', async () => {
    vi.mocked(getStorageAccountObservations).mockResolvedValueOnce({
      scan: {
        source: 'crossplane+azure',
        observedAt: '2026-03-22T20:00:00Z',
        cacheTtlSeconds: 300,
      },
      data: [],
    });

    const req = new NextRequest(
      'http://localhost:3000/api/observations/storage-accounts?refresh=true'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getStorageAccountObservations).toHaveBeenCalledWith({
      forceRefresh: true,
    });
  });

  it('returns 500 when observation fails', async () => {
    vi.mocked(getStorageAccountObservations).mockRejectedValueOnce(
      new Error('Azure observation failed')
    );

    const req = new NextRequest(
      'http://localhost:3000/api/observations/storage-accounts'
    );
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Azure observation failed');
  });
});
