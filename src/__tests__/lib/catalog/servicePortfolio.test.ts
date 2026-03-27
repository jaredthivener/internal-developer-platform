import { describe, expect, it } from 'vitest';
import {
  getServicePortfolioSummary,
  serviceCatalogEntries,
} from '@/lib/catalog/servicePortfolio';

describe('servicePortfolio', () => {
  it('derives the top-line estate summary from the catalog entries', () => {
    expect(getServicePortfolioSummary()).toEqual({
      catalogDomainCount: 4,
      liveWorkflowCount: 1,
      trackedServiceCount: 14,
      healthyDomainCount: 3,
    });
  });

  it('marks only the storage workflow as available today', () => {
    const workflowReadyEntries = serviceCatalogEntries.filter(
      (entry) => entry.workflow.status === 'ready'
    );

    expect(workflowReadyEntries).toHaveLength(1);
    expect(workflowReadyEntries[0]).toMatchObject({
      id: 'azure-storage-accounts',
      href: '/catalog/azure-storage',
    });
  });
});
