// Static catalog configuration: what each service domain is and which
// workflow it offers. Live figures (inventory, cost, compliance) come from
// livePortfolio.ts, keyed by `resourceType`.
export type ServiceCatalogEntry = {
  id: string;
  name: string;
  category: string;
  summary: string;
  owner: string;
  // Lower-case ARM resource type, as Resource Graph and Cost Management report it.
  resourceType: string;
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
      'Clusters for the portal, Crossplane control plane, and tenant workloads.',
    owner: 'Platform Runtime',
    resourceType: 'microsoft.containerservice/managedclusters',
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
    resourceType: 'microsoft.storage/storageaccounts',
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
    resourceType: 'microsoft.dbforpostgresql/flexibleservers',
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
    summary: 'Network boundaries for ingress, AKS, and managed data services.',
    owner: 'Cloud Foundation',
    resourceType: 'microsoft.network/virtualnetworks',
    icon: 'network',
    workflow: {
      status: 'planned',
      actionLabel: 'Coming soon',
    },
    href: null,
  },
];
