import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

// Refresh the session cookie and reject unauthenticated requests before rendering.
// Pages and API handlers independently verify authentication too.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  const signedIn = !!user && !error;
  const path = request.nextUrl.pathname;
  const publicRoute = ['/sign-in', '/auth/callback', '/auth/auth-code-error'].includes(path);
  let gated = response;
  if (!signedIn && !publicRoute) {
    gated = path.startsWith('/api/')
      ? NextResponse.json({ error: 'Please sign in with Google to continue.' }, { status: 401 })
      : NextResponse.redirect(new URL('/sign-in', request.url));
  } else if (signedIn && path === '/sign-in') {
    gated = NextResponse.redirect(new URL('/', request.url));
  }
  if (gated !== response) response.cookies.getAll().forEach(cookie => gated.cookies.set(cookie));
  gated.headers.set('Cache-Control', 'private, no-store');
  return gated;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
