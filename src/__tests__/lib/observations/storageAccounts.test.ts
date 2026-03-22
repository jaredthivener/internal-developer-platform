import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/crossplane/client', () => ({
  getCustomObjectsApi: vi.fn(),
}));

vi.mock('@/lib/crossplane/offlineMode', () => ({
  shouldUseCrossplaneMockMode: vi.fn(() => false),
}));

describe('getStorageAccountObservations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps a healthy Crossplane account in sync when Azure observation is unavailable', async () => {
    vi.stubEnv('AZURE_CLIENT_ID', '');
    vi.stubEnv('AZURE_TENANT_ID', '');

    const { getCustomObjectsApi } = await import('@/lib/crossplane/client');
    vi.mocked(getCustomObjectsApi).mockReturnValue({
      listClusterCustomObject: vi.fn().mockResolvedValue({
        body: {
          items: [
            {
              metadata: {
                name: 'idpstorealpha01',
                annotations: {
                  'idp.jared.io/request-id': 'req-123',
                },
              },
              spec: {
                forProvider: {
                  resourceGroupName: 'idp-crossplane-smoke',
                  location: 'westus3',
                  accountTier: 'Standard',
                  accountReplicationType: 'LRS',
                  accessTier: 'Hot',
                  publicNetworkAccessEnabled: true,
                },
              },
              status: {
                atProvider: {
                  id: '/subscriptions/test/resourceGroups/idp-crossplane-smoke/providers/Microsoft.Storage/storageAccounts/idpstorealpha01',
                  primaryLocation: 'westus3',
                  accessTier: 'Hot',
                  skuName: 'Standard_LRS',
                  publicNetworkAccessEnabled: true,
                },
                conditions: [
                  { type: 'Ready', status: 'True' },
                  { type: 'Synced', status: 'True' },
                ],
              },
            },
          ],
        },
      }),
    } as never);

    const { getStorageAccountObservations } =
      await import('@/lib/observations/storageAccounts');

    const result = await getStorageAccountObservations({ forceRefresh: true });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].classification.code).toBe('in_sync');
    expect(result.data[0].classification.reasonCodes).toContain(
      'azureObservationUnavailable'
    );
    expect(result.data[0].classification.diffCount).toBe(0);
  });
});
