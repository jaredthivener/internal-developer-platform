import { describe, expect, it } from 'vitest';
import { serviceCatalogEntries } from '@/lib/catalog/servicePortfolio';

describe('servicePortfolio', () => {
  it('maps every domain to a lower-case ARM resource type', () => {
    expect(serviceCatalogEntries.map((entry) => entry.resourceType)).toEqual([
      'microsoft.containerservice/managedclusters',
      'microsoft.storage/storageaccounts',
      'microsoft.dbforpostgresql/flexibleservers',
      'microsoft.network/virtualnetworks',
    ]);
  });

  it('marks only the storage workflow as available today', () => {
    const ready = serviceCatalogEntries.filter(
      (entry) => entry.workflow.status === 'ready'
    );

    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({
      id: 'azure-storage-accounts',
      href: '/catalog/azure-storage',
    });
  });
});
