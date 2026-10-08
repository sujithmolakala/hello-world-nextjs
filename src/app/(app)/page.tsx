import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import CaptionDeck from '@/components/CaptionDeck';
export const dynamic = 'force-dynamic';
export default async function Feed() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('caption_deck_snapshot', {});
  return <main id="main" className="page-shell">
    <div className="page-heading"><h1>Feed</h1><Link href="/create" className="button">Create caption</Link></div>
    {error || !data ? <div className="empty-state" role="alert"><p>Monthly decks could not be loaded. Apply the new monthly caption decks migration, then refresh.</p><Link href="/" className="text-link">Try again</Link></div> : <CaptionDeck initial={data} />}
  </main>;
}
