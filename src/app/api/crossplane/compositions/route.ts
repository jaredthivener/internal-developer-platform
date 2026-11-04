import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/requireSession';
import { getCustomObjectsApi } from '@/lib/crossplane/client';
import { shouldUseCrossplaneMockMode } from '@/lib/crossplane/offlineMode';

export async function GET(req?: NextRequest) {
  void req;

  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  if (shouldUseCrossplaneMockMode()) {
    return NextResponse.json(
      {
        data: [
          {
            metadata: { name: 'cluster-aws-s3-production' },
            spec: { compositeTypeRef: { kind: 'XBucket' } },
          },
          {
            metadata: { name: 'cluster-gcp-postgres-dev' },
            spec: { compositeTypeRef: { kind: 'XPostgreSQLInstance' } },
          },
          {
            metadata: { name: 'cluster-azure-redis' },
            spec: { compositeTypeRef: { kind: 'XRedisCache' } },
          },
        ],
      },
      { status: 200 }
    );
  }

  try {
    const response = await getCustomObjectsApi().listClusterCustomObject({
      group: 'apiextensions.crossplane.io',
      version: 'v1',
      plural: 'compositions',
    });
    const items = (response as { items?: unknown[] }).items ?? [];

    return NextResponse.json({ data: items }, { status: 200 });
  } catch (error) {
    console.error(
      '[API] GET /api/crossplane/compositions - Error fetching compositions:',
      error
    );

    // Kubernetes error details stay in the server log.
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
