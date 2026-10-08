import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const session = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
});

export async function requireUser() {
  const { supabase, user } = await session();
  if (!user) redirect('/sign-in');
  return { supabase, user };
}
