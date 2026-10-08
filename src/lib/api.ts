import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { InputError, sameOrigin } from '@/lib/validation';
export async function authenticated(request: Request) {
  sameOrigin(request);
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new InputError('Please sign in with Google to continue.', 401);
  return { supabase, user };
}
export function apiError(error: unknown) {
  return Response.json({ error: error instanceof InputError ? error.message : 'Something went wrong. Please try again.' }, { status: error instanceof InputError ? error.status : 500 });
}
