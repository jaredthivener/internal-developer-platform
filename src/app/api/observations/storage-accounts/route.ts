import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/requireSession';
import { getStorageAccountObservations } from '@/lib/observations/storageAccounts';

export async function GET(req: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const refresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const response = await getStorageAccountObservations({
      forceRefresh: refresh,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Kubernetes/ARM error text can include response headers and identities;
    // keep it in the server log only.
    console.error(
      '[API] GET /api/observations/storage-accounts - Error:',
      error
    );

    return NextResponse.json(
      { error: 'Failed to observe storage accounts' },
      { status: 500 }
    );
  }
}
