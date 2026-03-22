import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  type DesiredStateStore,
  type DesiredStateSubmissionAppliedDetails,
  type DesiredStateSubmissionFailedDetails,
  type DesiredStateSubmissionRecord,
} from '@/lib/persistence/types';

export class FileSystemDesiredStateStore implements DesiredStateStore {
  constructor(private readonly rootDirectory: string) {}

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
    const rawRecord = await readFile(this.getRecordPath(requestId), 'utf8');

    return JSON.parse(rawRecord) as DesiredStateSubmissionRecord;
  }

  private async writeRecord(
    record: DesiredStateSubmissionRecord
  ): Promise<void> {
    await mkdir(this.rootDirectory, { recursive: true });
    await writeFile(
      this.getRecordPath(record.requestId),
      `${JSON.stringify(record, null, 2)}\n`,
      'utf8'
    );
  }

  private getRecordPath(requestId: string): string {
    return path.join(this.rootDirectory, `${requestId}.json`);
  }
}
