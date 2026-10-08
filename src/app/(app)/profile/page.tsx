import { requireUser } from '@/lib/auth';
import ProfileEditor from '@/components/ProfileEditor';
export const metadata = { title: 'My Profile' };
export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const { data: profile, error } = await supabase.from('profiles').select('first_name,last_name,avatar_url').eq('id', user.id).maybeSingle();
  return <main id="main" className="page-shell form-page"><h1>My Profile</h1>{error || !profile ? <p className="error" role="alert">Your profile could not be loaded. Please try again.</p> : <ProfileEditor userId={user.id} initialFirstName={profile.first_name || ''} initialLastName={profile.last_name || ''} initialAvatarUrl={profile.avatar_url || ''} />}</main>;
}
