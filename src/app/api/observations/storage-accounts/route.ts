import { NextRequest, NextResponse } from 'next/server';
import { getStorageAccountObservations } from '@/lib/observations/storageAccounts';

export async function GET(req: NextRequest) {
  try {
    const refresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const response = await getStorageAccountObservations({
      forceRefresh: refresh,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to observe storage accounts',
      },
      { status: 500 }
    );
  }
}
