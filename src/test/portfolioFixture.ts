import type { LivePortfolio } from '@/lib/catalog/livePortfolio';

export const livePortfolio: LivePortfolio = {
  observedAt: '2026-11-03T18:00:00.000Z',
  inventory: {
    'microsoft.containerservice/managedclusters': { resources: 1, regions: 1 },
    'microsoft.storage/storageaccounts': { resources: 2, regions: 2 },
  },
  cost: {
    currency: 'USD',
    total: 17,
    byResourceType: {
      'microsoft.containerservice/managedclusters': 12.5,
      'microsoft.storage/storageaccounts': 1.25,
    },
    topServices: [
      { service: 'Azure Kubernetes Service', cost: 12.5 },
      { service: 'Virtual Machines', cost: 3.25 },
    ],
  },
  compliance: {
    framework: 'Microsoft cloud security benchmark v2',
    overall: { compliant: 1, evaluated: 4 },
    byResourceType: {
      'microsoft.containerservice/managedclusters': {
        compliant: 0,
        evaluated: 1,
      },
      'microsoft.storage/storageaccounts': { compliant: 1, evaluated: 2 },
    },
    failingControls: [
      {
        id: 'Azure_Security_Benchmark_v3.0_NS-2',
        title: 'NS-2 Secure cloud services with network controls',
        resources: 3,
      },
    ],
  },
};

export const unavailablePortfolio: LivePortfolio = {
  observedAt: '2026-11-03T18:00:00.000Z',
  inventory: null,
  cost: null,
  compliance: null,
};
