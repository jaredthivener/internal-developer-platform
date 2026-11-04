import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { GET } from '@/app/api/observations/storage-accounts/route';
import { getStorageAccountObservations } from '@/lib/observations/storageAccounts';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth/authOptions', () => ({
  authOptions: {},
}));

vi.mock('@/lib/observations/storageAccounts', () => ({
  getStorageAccountObservations: vi.fn(),
}));

describe('GET /api/observations/storage-accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'Test User' },
    });
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
    expect(body.error).toBe('Failed to observe storage accounts');
    expect(JSON.stringify(body)).not.toContain('Azure observation failed');
  });

  it('returns 401 without a session and never runs the observation', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await GET(
      new NextRequest('http://localhost:3000/api/observations/storage-accounts')
    );

    expect(res.status).toBe(401);
    expect(getStorageAccountObservations).not.toHaveBeenCalled();
  });
});
