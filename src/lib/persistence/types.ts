export const REQUEST_ID_ANNOTATION = 'idp.jared.io/request-id';

export type DesiredStateSubmissionStatus = 'pending' | 'applied' | 'failed';

export type DesiredStateSubmissionRecord = {
  requestId: string;
  group: string;
  version: string;
  plural: string;
  payload: Record<string, unknown>;
  status: DesiredStateSubmissionStatus;
  workflow: 'crossplane-resource-submission';
  resourceName?: string;
  providerConfigName?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type DesiredStateSubmissionAppliedDetails = {
  resourceName?: string;
};

export type DesiredStateSubmissionFailedDetails = {
  error: string;
};

export interface DesiredStateStore {
  persistSubmission(record: DesiredStateSubmissionRecord): Promise<void>;
  markSubmissionApplied(
    requestId: string,
    details: DesiredStateSubmissionAppliedDetails
  ): Promise<void>;
  markSubmissionFailed(
    requestId: string,
    details: DesiredStateSubmissionFailedDetails
  ): Promise<void>;
}
