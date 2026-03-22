import * as k8s from '@kubernetes/client-node';
import { NextRequest, NextResponse } from 'next/server';
import { getCustomObjectsApi } from '@/lib/crossplane/client';
import { shouldUseCrossplaneMockMode } from '@/lib/crossplane/offlineMode';
import { getDesiredStateStore } from '@/lib/persistence/store';
import {
  REQUEST_ID_ANNOTATION,
  type DesiredStateSubmissionRecord,
} from '@/lib/persistence/types';

function unwrapKubernetesResponse<T>(response: T | { body?: T }): T {
  if (
    response &&
    typeof response === 'object' &&
    'body' in response &&
    response.body !== undefined
  ) {
    return response.body;
  }

  return response as T;
}

function toErrorResponse(error: unknown, fallbackMessage: string) {
  const errorBody =
    typeof error === 'object' && error !== null && 'body' in error
      ? (error as { body?: { code?: number; message?: string } }).body
      : undefined;

  return NextResponse.json(
    { error: errorBody?.message || fallbackMessage },
    { status: errorBody?.code || 500 }
  );
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'body' in error &&
    typeof (error as { body?: { message?: string } }).body?.message === 'string'
  ) {
    return (error as { body?: { message?: string } }).body?.message as string;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

function withRequestIdAnnotation(
  payload: Record<string, unknown>,
  requestId: string
): Record<string, unknown> {
  const metadata =
    typeof payload.metadata === 'object' && payload.metadata !== null
      ? (payload.metadata as Record<string, unknown>)
      : {};
  const annotations =
    typeof metadata.annotations === 'object' && metadata.annotations !== null
      ? (metadata.annotations as Record<string, string>)
      : {};

  return {
    ...payload,
    metadata: {
      ...metadata,
      annotations: {
        ...annotations,
        [REQUEST_ID_ANNOTATION]: requestId,
      },
    },
  };
}

function buildSubmissionRecord(
  requestId: string,
  group: string,
  version: string,
  plural: string,
  payload: Record<string, unknown>
): DesiredStateSubmissionRecord {
  const providerConfigName =
    typeof payload.spec === 'object' &&
    payload.spec !== null &&
    typeof (payload.spec as { providerConfigRef?: { name?: string } })
      .providerConfigRef?.name === 'string'
      ? (payload.spec as { providerConfigRef?: { name?: string } })
          .providerConfigRef?.name
      : undefined;
  const resourceName =
    typeof payload.metadata === 'object' &&
    payload.metadata !== null &&
    typeof (payload.metadata as { name?: string }).name === 'string'
      ? (payload.metadata as { name?: string }).name
      : undefined;
  const now = new Date().toISOString();

  return {
    requestId,
    group,
    version,
    plural,
    payload,
    status: 'pending',
    workflow: 'crossplane-resource-submission',
    resourceName,
    providerConfigName,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * GET /api/crossplane/resources
 * Fetches arbitrary Crossplane Managed Resources or general Custom Resources.
 * Requires `group`, `version`, and `plural` searchParams.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Enforce strict auth proxy layer (Bypassed for Dev/MVP Core functionality phase)
    // const session = await getServerSession(authOptions);
    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // 2. Extract and validate parameters
    const searchParams = req.nextUrl.searchParams;
    const group = searchParams.get('group');
    const version = searchParams.get('version');
    const plural = searchParams.get('plural');
    const name = searchParams.get('name');

    if (!group || !version || !plural) {
      return NextResponse.json(
        { error: 'Missing required query parameters: group, version, plural' },
        { status: 400 }
      );
    }

    if (shouldUseCrossplaneMockMode()) {
      if (name) {
        return NextResponse.json(
          {
            data: {
              metadata: { name },
              spec: {
                forProvider: {
                  resourceGroupName: 'idp-crossplane-smoke',
                  location: 'westus3',
                  accountTier: 'Standard',
                  accountReplicationType: 'LRS',
                  accessTier: 'Hot',
                  publicNetworkAccessEnabled: true,
                },
              },
              status: {
                conditions: [{ type: 'Ready', status: 'True' }],
              },
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json({ data: [] }, { status: 200 });
    }

    // 3. Delegate to Kubernetes cluster
    const k8sClient =
      getCustomObjectsApi() as /* eslint-disable-line @typescript-eslint/no-explicit-any */ any;

    if (name) {
      const response = await k8sClient.getClusterCustomObject({
        group,
        version,
        plural,
        name,
      });

      return NextResponse.json(
        { data: unwrapKubernetesResponse(response) },
        { status: 200 }
      );
    }

    const response = await k8sClient.listClusterCustomObject({
      group,
      version,
      plural,
    });

    const list = unwrapKubernetesResponse<{ items?: unknown[] }>(response);
    const items = Array.isArray(list?.items) ? list.items : [];

    // Return sanitized resources list
    return NextResponse.json({ data: items }, { status: 200 });
  } catch (error) {
    console.error('[API] GET /api/crossplane/resources - Error:', error);

    // Provide a mocked fallback for Local MVP UI demonstrations
    if (shouldUseCrossplaneMockMode()) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    return toErrorResponse(error, 'Internal Server Error');
  }
}

/**
 * POST /api/crossplane/resources
 * Provisions a new arbitrary Crossplane Managed Resource.
 * Expects a JSON body with `group`, `version`, `plural`, and the full `payload`.
 */
export async function POST(req: NextRequest) {
  let requestId: string | null = null;

  try {
    // 1. Authentication Check (Bypassed for Dev/MVP Core functionality phase)
    // const session = await getServerSession(authOptions);
    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await req.json();
    const { group, version, plural, payload } = body;

    // Validate request structure
    if (!group || !version || !plural || !payload) {
      return NextResponse.json(
        {
          error:
            'Missing required body parameters: group, version, plural, payload',
        },
        { status: 400 }
      );
    }

    requestId = crypto.randomUUID();
    const desiredStateStore = getDesiredStateStore();
    const annotatedPayload = withRequestIdAnnotation(
      payload as Record<string, unknown>,
      requestId
    );

    await desiredStateStore.persistSubmission(
      buildSubmissionRecord(requestId, group, version, plural, annotatedPayload)
    );

    // Safety fallback for offline demo
    if (shouldUseCrossplaneMockMode()) {
      const payloadMetadata =
        typeof annotatedPayload.metadata === 'object' &&
        annotatedPayload.metadata !== null
          ? (annotatedPayload.metadata as {
              name?: string;
              generateName?: string;
            })
          : {};
      const fakeName = payloadMetadata.name
        ? payloadMetadata.name
        : payloadMetadata.generateName
          ? payloadMetadata.generateName + Math.floor(Math.random() * 10000)
          : 'demo-resource-123';

      await desiredStateStore.markSubmissionApplied(requestId, {
        resourceName: fakeName,
      });

      return NextResponse.json(
        {
          requestId,
          data: { metadata: { name: fakeName } },
        },
        { status: 201 }
      );
    }

    // Delegate to K8s API to create the resource
    // Typical Managed Resources are cluster-scoped in native Crossplane/Upbound providers
    const k8sClient =
      getCustomObjectsApi() as /* eslint-disable-line @typescript-eslint/no-explicit-any */ any;

    const response = await k8sClient.createClusterCustomObject({
      group,
      version,
      plural,
      body: annotatedPayload,
    });

    const createdResource = unwrapKubernetesResponse(response) as {
      metadata?: { name?: string };
    };

    await desiredStateStore.markSubmissionApplied(requestId, {
      resourceName: createdResource.metadata?.name,
    });

    return NextResponse.json(
      { requestId, data: createdResource },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error(
      '[API] POST /api/crossplane/resources - Error creating resource:',
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      (error as any)?.body || error
    );

    if (requestId) {
      try {
        await getDesiredStateStore().markSubmissionFailed(requestId, {
          error: getErrorMessage(error, 'Internal Server Error'),
        });
      } catch (persistenceError) {
        console.error(
          '[API] POST /api/crossplane/resources - Error marking submission failed:',
          persistenceError
        );
      }
    }

    return toErrorResponse(error, 'Internal Server Error');
  }
}

/**
 * DELETE /api/crossplane/resources
 * Deletes an arbitrary Crossplane Managed Resource.
 * Expects a JSON body with `group`, `version`, `plural`, and `name`.
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { group, version, plural, name } = body;

    if (!group || !version || !plural || !name) {
      return NextResponse.json(
        {
          error:
            'Missing required body parameters: group, version, plural, name',
        },
        { status: 400 }
      );
    }

    if (shouldUseCrossplaneMockMode()) {
      return NextResponse.json(
        {
          data: { metadata: { name } },
        },
        { status: 200 }
      );
    }

    const k8sClient =
      getCustomObjectsApi() as /* eslint-disable-line @typescript-eslint/no-explicit-any */ any;

    const response = await k8sClient.deleteClusterCustomObject({
      group,
      version,
      plural,
      name,
    });

    return NextResponse.json(
      { data: unwrapKubernetesResponse(response) },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error(
      '[API] DELETE /api/crossplane/resources - Error deleting resource:',
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      (error as any)?.body || error
    );

    return toErrorResponse(error, 'Internal Server Error');
  }
}

/**
 * PATCH /api/crossplane/resources
 * Triggers a reconciliation-safe sync-back by merge-patching the managed resource.
 * Expects a JSON body with `group`, `version`, `plural`, `name`, and `patch`.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { group, version, plural, name, patch } = body;

    if (!group || !version || !plural || !name || !patch) {
      return NextResponse.json(
        {
          error:
            'Missing required body parameters: group, version, plural, name, patch',
        },
        { status: 400 }
      );
    }

    if (shouldUseCrossplaneMockMode()) {
      return NextResponse.json(
        {
          data: { metadata: { name } },
        },
        { status: 200 }
      );
    }

    const k8sClient =
      getCustomObjectsApi() as /* eslint-disable-line @typescript-eslint/no-explicit-any */ any;

    const response = await k8sClient.patchClusterCustomObject(
      group,
      version,
      plural,
      name,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        headers: {
          'Content-Type': k8s.PatchStrategy.MergePatch,
        },
      }
    );

    return NextResponse.json(
      { data: unwrapKubernetesResponse(response) },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error(
      '[API] PATCH /api/crossplane/resources - Error patching resource:',
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      (error as any)?.body || error
    );

    return toErrorResponse(error, 'Internal Server Error');
  }
}
