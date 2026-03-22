import { type ObservationClassCode } from '@/lib/observations/types';

export function formatObservationClassification(
  code: ObservationClassCode
): string {
  switch (code) {
    case 'in_sync':
      return 'In sync';
    case 'provisioning':
      return 'Pending';
    case 'deleting':
      return 'Deleting';
    case 'config_drift':
      return 'Drifted';
    case 'missing_in_azure':
      return 'Desired only';
    case 'orphaned_in_azure':
      return 'Cloud only';
    case 'identity_drift':
    case 'ownership_drift':
      return 'Drifted';
    case 'scan_error':
      return 'Control plane unavailable';
  }
}
