export type ObservationClassCode =
  | 'scan_error'
  | 'deleting'
  | 'provisioning'
  | 'missing_in_azure'
  | 'orphaned_in_azure'
  | 'identity_drift'
  | 'ownership_drift'
  | 'config_drift'
  | 'in_sync';

export type ObservationSeverity = 'critical' | 'warning' | 'info' | 'success';

export type StorageAccountObservationClassification = {
  code: ObservationClassCode;
  severity: ObservationSeverity;
  reasonCodes: string[];
  diffCount: number;
};

export type StorageAccountObservationOwnership = {
  requestId?: string;
  managedBy?: string;
};

export type StorageAccountObservationShape = {
  resourceGroupName?: string;
  location?: string;
  accountTier?: string;
  replicationType?: string;
  accessTier?: string;
  publicNetworkAccessEnabled?: boolean;
};

export type StorageAccountObservationSummary = {
  resourceName: string;
  resourceKey: string;
  azureResourceId?: string;
  classification: StorageAccountObservationClassification;
  ownership: StorageAccountObservationOwnership;
  desired: StorageAccountObservationShape;
  live: StorageAccountObservationShape;
  observedAt: string;
};

export type StorageAccountObservationDiff = {
  field: string;
  desired: string | boolean | null;
  live: string | boolean | null;
  category: 'identity' | 'ownership' | 'network' | 'security' | 'data' | 'sku';
};

export type StorageAccountObservationDetail =
  StorageAccountObservationSummary & {
    crossplane: {
      name: string;
      uid?: string;
      ready: boolean;
      synced?: boolean;
      deletionTimestamp?: string | null;
    };
    normalizedDesired: Record<string, string | boolean | null>;
    normalizedLive: Record<string, string | boolean | null>;
    diffs: StorageAccountObservationDiff[];
  };

export type StorageAccountObservationsResponse<T> = {
  scan: {
    source: 'crossplane+azure';
    observedAt: string;
    cacheTtlSeconds: number;
  };
  data: T;
};
