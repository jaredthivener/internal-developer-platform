export type ServiceCatalogEntry = {
  id: string;
  name: string;
  category: string;
  summary: string;
  owner: string;
  regionCount: number;
  serviceCount: number;
  monthlyCost: string;
  security: string;
  health: number;
  icon: 'aks' | 'storage' | 'postgres' | 'network';
  workflow: {
    status: 'ready' | 'planned';
    actionLabel: string;
  };
  href: string | null;
};

export const serviceCatalogEntries: ServiceCatalogEntry[] = [
  {
    id: 'aks',
    name: 'Azure Kubernetes Service',
    category: 'Compute platform',
    summary:
      'Low-cost clusters for the portal, Crossplane control plane, and tenant workloads.',
    owner: 'Platform Runtime',
    regionCount: 1,
    serviceCount: 2,
    monthlyCost: '$57',
    security: 'OIDC and workload identity enabled',
    health: 91,
    icon: 'aks',
    workflow: {
      status: 'planned',
      actionLabel: 'Coming soon',
    },
    href: null,
  },
  {
    id: 'azure-storage-accounts',
    name: 'Azure Storage Accounts',
    category: 'Storage',
    summary:
      'Governed storage accounts backing state snapshots, documentation assets, and operational logs.',
    owner: 'Platform Runtime',
    regionCount: 1,
    serviceCount: 4,
    monthlyCost: '$19',
    security: '100% encryption with soft delete',
    health: 95,
    icon: 'storage',
    workflow: {
      status: 'ready',
      actionLabel: 'Open Storage Account Workflow',
    },
    href: '/catalog/azure-storage',
  },
  {
    id: 'postgres',
    name: 'Azure Database for PostgreSQL',
    category: 'Data services',
    summary:
      'Flexible Server instances for portal state, metadata, and operational reporting.',
    owner: 'Persistence Guild',
    regionCount: 1,
    serviceCount: 3,
    monthlyCost: '$38',
    security: 'Private access on 2 of 3 servers',
    health: 84,
    icon: 'postgres',
    workflow: {
      status: 'planned',
      actionLabel: 'Coming soon',
    },
    href: null,
  },
  {
    id: 'network',
    name: 'Azure Virtual Network',
    category: 'Networking',
    summary:
      'Segmented hub-and-spoke network boundaries for ingress, AKS, and managed data services.',
    owner: 'Cloud Foundation',
    regionCount: 1,
    serviceCount: 5,
    monthlyCost: '$11',
    security: '96% NSG policy compliance',
    health: 97,
    icon: 'network',
    workflow: {
      status: 'planned',
      actionLabel: 'Coming soon',
    },
    href: null,
  },
];

export const serviceCostWatchlist = [
  {
    label: 'AKS compute spend',
    detail:
      'Automatic system capacity remains inside credit budget, but add-on usage is trending upward.',
  },
  {
    label: 'PostgreSQL idle capacity',
    detail:
      'One dev Flexible Server is oversized for current traffic and can move down a SKU.',
  },
  {
    label: 'Blob retention growth',
    detail:
      'Diagnostic storage is the largest unplanned cost driver under the current credit cap.',
  },
];

export const serviceSecuritySignals = [
  'Public network access left enabled on one PostgreSQL server.',
  'Two AKS namespaces still need workload identity migration off static secrets.',
  'One virtual network subnet is missing the newest egress restriction policy.',
];

export function getServicePortfolioSummary(entries = serviceCatalogEntries) {
  return {
    catalogDomainCount: entries.length,
    liveWorkflowCount: entries.filter(
      (entry) => entry.workflow.status === 'ready'
    ).length,
    trackedServiceCount: entries.reduce(
      (total, entry) => total + entry.serviceCount,
      0
    ),
    healthyDomainCount: entries.filter((entry) => entry.health >= 90).length,
  };
}
