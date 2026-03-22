import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import {
  type DesiredStateStore,
  type DesiredStateSubmissionAppliedDetails,
  type DesiredStateSubmissionFailedDetails,
  type DesiredStateSubmissionRecord,
} from '@/lib/persistence/types';

export class AzureBlobDesiredStateStore implements DesiredStateStore {
  private readonly containerClient;

  constructor(accountUrl: string, containerName: string) {
    const blobServiceClient = new BlobServiceClient(
      accountUrl,
      new DefaultAzureCredential()
    );

    this.containerClient = blobServiceClient.getContainerClient(containerName);
  }

  async persistSubmission(record: DesiredStateSubmissionRecord): Promise<void> {
    await this.writeRecord(record);
  }

  async markSubmissionApplied(
    requestId: string,
    details: DesiredStateSubmissionAppliedDetails
  ): Promise<void> {
    const existingRecord = await this.readRecord(requestId);

    await this.writeRecord({
      ...existingRecord,
      status: 'applied',
      resourceName: details.resourceName || existingRecord.resourceName,
      updatedAt: new Date().toISOString(),
    });
  }

  async markSubmissionFailed(
    requestId: string,
    details: DesiredStateSubmissionFailedDetails
  ): Promise<void> {
    const existingRecord = await this.readRecord(requestId);

    await this.writeRecord({
      ...existingRecord,
      status: 'failed',
      error: details.error,
      updatedAt: new Date().toISOString(),
    });
  }

  private async readRecord(
    requestId: string
  ): Promise<DesiredStateSubmissionRecord> {
    await this.containerClient.createIfNotExists();

    const blobClient = this.containerClient.getBlockBlobClient(
      this.getBlobName(requestId)
    );
    const response = await blobClient.downloadToBuffer();

    return JSON.parse(
      response.toString('utf8')
    ) as DesiredStateSubmissionRecord;
  }

  private async writeRecord(
    record: DesiredStateSubmissionRecord
  ): Promise<void> {
    await this.containerClient.createIfNotExists();

    const blobClient = this.containerClient.getBlockBlobClient(
      this.getBlobName(record.requestId)
    );
    const body = JSON.stringify(record, null, 2);

    await blobClient.deleteIfExists();
    await blobClient.upload(body, Buffer.byteLength(body), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
  }

  private getBlobName(requestId: string): string {
    return `desired-state/${requestId}.json`;
  }
}
