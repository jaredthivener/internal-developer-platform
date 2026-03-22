import { NextRequest, NextResponse } from 'next/server';
import { getStorageAccountObservationByName } from '@/lib/observations/storageAccounts';

type RouteContext = {
  params: Promise<{
    name: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to observe storage account',
      },
      { status: 500 }
    );
  }
}
