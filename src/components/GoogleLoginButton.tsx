'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
export default function GoogleLoginButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function login() {
    setBusy(true); setError('');
    try {
      const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } } });
      if (error) throw error;
    } catch { setError('Sign-in could not start. Please try again.'); setBusy(false); }
  }
  return <div><button className="button" onClick={login} disabled={busy}>{busy ? 'Connecting…' : 'Sign in with Google'}</button>{error && <p className="error" role="alert">{error}</p>}</div>;
}
