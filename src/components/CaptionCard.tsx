'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeedCaption } from '@/lib/database.types';

export default function CaptionCard({ item, imageUrl }: { item: FeedCaption; imageUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function vote(value: boolean) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captionId: item.id, value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Your vote could not be saved.');
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your vote.'); }
    finally { setBusy(false); }
  }
  return <article className="caption-card" id={`caption-${item.id}`}>
    <div className="caption-image">{imageUrl ? <Image src={imageUrl} alt="Photo submitted for this caption" fill unoptimized sizes="(max-width: 640px) 100vw, 50vw" /> : <span>Image unavailable. Refresh to try again.</span>}</div>
    <div className="caption-body"><p className="caption-text">{item.caption}</p>
      <div className="vote-row" aria-label="Rate this caption" aria-busy={busy}>{[true, false].map(value => <button key={String(value)} className={`vote ${item.my_vote === value ? 'selected' : ''}`} aria-pressed={item.my_vote === value} disabled={busy} onClick={() => vote(value)}>{value ? 'Funny' : 'Not Funny'} <span>{value ? item.funny_count : item.not_funny_count}</span></button>)}</div>
      <div className="card-meta"><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}</time><span aria-live="polite">{busy ? 'Saving vote…' : item.my_vote !== null ? 'Vote saved' : ''}</span></div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  </article>;
}
