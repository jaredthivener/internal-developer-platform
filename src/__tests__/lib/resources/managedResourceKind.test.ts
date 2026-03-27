import { describe, expect, it } from 'vitest';
import { azureStorageAccountResourceKind } from '@/lib/resources/managedResourceKind';

describe('managedResourceKind', () => {
  it('defines the live storage resource metadata in one place', () => {
    expect(azureStorageAccountResourceKind).toMatchObject({
      id: 'azure-storage-account',
      displayName: 'Azure Storage Account',
      catalogHref: '/catalog/azure-storage',
      observationsPathname: '/api/observations/storage-accounts',
      crossplane: {
        group: 'storage.azure.upbound.io',
        version: 'v1beta1',
        plural: 'accounts',
      },
    });
  });
});
