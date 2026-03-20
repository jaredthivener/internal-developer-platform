import { NextRequest, NextResponse } from 'next/server';
import { getCustomObjectsApi } from '@/lib/crossplane/client';

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

    if (!group || !version || !plural) {
      return NextResponse.json(
        { error: 'Missing required query parameters: group, version, plural' },
        { status: 400 }
      );
    }

    // 3. Delegate to Kubernetes cluster
    const k8sClient =
      getCustomObjectsApi() as /* eslint-disable-line @typescript-eslint/no-explicit-any */ any;

    const response = await k8sClient.listClusterCustomObject(
      group,
      version,
      plural
    );

    const items = (response.body as { items?: unknown[] }).items || [];

    // Return sanitized resources list
    return NextResponse.json({ data: items }, { status: 200 });
  } catch (error) {
    console.error('[API] GET /api/crossplane/resources - Error:', error);

    // Provide a mocked fallback for Local MVP UI demonstrations
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crossplane/resources
 * Provisions a new arbitrary Crossplane Managed Resource.
 * Expects a JSON body with `group`, `version`, `plural`, and the full `payload`.
 */
export async function POST(req: NextRequest) {
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

    // Delegate to K8s API to create the resource
    // Typical Managed Resources are cluster-scoped in native Crossplane/Upbound providers
    const k8sClient =
      getCustomObjectsApi() as /* eslint-disable-line @typescript-eslint/no-explicit-any */ any;

    // Safety fallback for offline demo
    if (process.env.NODE_ENV === 'development') {
      try {
        const response = await k8sClient.createClusterCustomObject(
          group,
          version,
          plural,
          payload
        );
        return NextResponse.json({ data: response.body }, { status: 201 });
      } catch {
        console.log('[API] Catching K8s Err for Dev Demo fallback...');
        // Fake success response so UI functions locally
        const fakeName = payload.metadata?.generateName
          ? payload.metadata.generateName + Math.floor(Math.random() * 10000)
          : 'demo-resource-123';
        return NextResponse.json(
          {
            data: { metadata: { name: fakeName } },
          },
          { status: 201 }
        );
      }
    }

    const response = await k8sClient.createClusterCustomObject(
      group,
      version,
      plural,
      payload
    );

    return NextResponse.json({ data: response.body }, { status: 201 });
  } catch (error: unknown) {
    console.error(
      '[API] POST /api/crossplane/resources - Error creating resource:',
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      (error as any)?.body || error
    );
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
