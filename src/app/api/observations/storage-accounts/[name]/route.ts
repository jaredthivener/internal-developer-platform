import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/requireSession';
import { getStorageAccountObservationByName } from '@/lib/observations/storageAccounts';

type RouteContext = {
  params: Promise<{
    name: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { name } = await context.params;
    const refresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const response = await getStorageAccountObservationByName(name, {
      forceRefresh: refresh,
    });

    if (!response) {
      return NextResponse.json(
        { error: 'Storage account observation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Kubernetes/ARM error text can include response headers and identities;
    // keep it in the server log only.
    console.error(
      '[API] GET /api/observations/storage-accounts/[name] - Error:',
      error
    );

    return NextResponse.json(
      { error: 'Failed to observe storage account' },
      { status: 500 }
    );
  }
}
