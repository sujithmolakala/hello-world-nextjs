import Image from 'next/image';
import { requireUser } from '@/lib/auth';
export const metadata = { title: 'Members' };
export default async function MembersPage() {
  const { supabase } = await requireUser();
  const { data: members, error } = await supabase.rpc('member_directory');
  return <main id="main" className="page-shell"><h1>Members</h1>
    {error ? <p className="error" role="alert">The member directory could not be loaded. Please try again.</p> : members?.length ? <ul className="member-list">{members.map(member => {
      const name = [member.first_name?.trim(), member.last_name?.trim()].filter(Boolean).join(' ') || 'Unnamed member';
      const avatarUrl = member.avatar_url?.trim();
      return <li key={member.id}><div className="member-avatar">{avatarUrl ? <Image src={avatarUrl} alt="" fill unoptimized sizes="40px" /> : <svg className="avatar-fallback" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>}</div><span>{name}</span></li>;
    })}</ul> : <p className="muted">No member profiles yet.</p>}
  </main>;
}
