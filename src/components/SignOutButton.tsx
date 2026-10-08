'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true); setError('');
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.replace('/sign-in'); router.refresh();
    } catch { setError('Sign-out failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div><button className="button button-outline" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>{error && <p role="alert" className="error">{error}</p>}</div>;
}
