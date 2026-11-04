import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import { shouldUseCrossplaneMockMode } from '@/lib/crossplane/offlineMode';

// Optimistic page-level check that sends signed-out visitors to Entra sign-in.
// It is not the security boundary: every API route calls requireSession().
export async function proxy(req: NextRequest) {
  if (shouldUseCrossplaneMockMode() || (await getToken({ req }))) {
    return NextResponse.next();
  }

  const signIn = new URL('/api/auth/signin', req.url);
  signIn.searchParams.set(
    'callbackUrl',
    `${req.nextUrl.pathname}${req.nextUrl.search}`
  );

  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
