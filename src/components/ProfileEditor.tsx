'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type Props = { userId: string; initialFirstName: string; initialLastName: string; initialAvatarUrl: string };
export default function ProfileEditor({ initialFirstName, initialLastName, initialAvatarUrl }: Props) {
  const router = useRouter();
  const [avatar, setAvatar] = useState(initialAvatarUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/profile', { method: 'POST', body: new FormData(event.currentTarget) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Profile update failed.');
      if (result.avatarUrl) setAvatar(result.avatarUrl);
      setMessage('Profile saved.'); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Profile could not be saved.'); }
    finally { setBusy(false); }
  }
  return <section className="profile-editor"><div className="profile-avatar">{avatar ? <Image src={avatar} alt="Your profile avatar" fill unoptimized sizes="100px" /> : <span aria-hidden="true">{initialFirstName.slice(0, 1) || '?'}</span>}</div><form onSubmit={submit} aria-busy={busy}><fieldset disabled={busy}><div className="name-fields"><div><label htmlFor="first-name">First name</label><input id="first-name" name="firstName" defaultValue={initialFirstName} autoComplete="given-name" required maxLength={60} /></div><div><label htmlFor="last-name">Last name</label><input id="last-name" name="lastName" defaultValue={initialLastName} autoComplete="family-name" required maxLength={60} /></div></div><label htmlFor="avatar">Profile photo</label><input id="avatar" name="image" type="file" accept="image/jpeg,image/png,image/webp" /><p className="muted">JPEG, PNG, or WebP. Maximum 3 MB. Avatars remain publicly accessible.</p><button className="button" type="submit">{busy ? 'Saving changes…' : 'Save changes'}</button></fieldset>{error && <p role="alert" className="error notice">{error}</p>}{message && <p className="success notice" role="status">{message}</p>}</form></section>;
}
