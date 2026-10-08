'use client';
import ProfileEditor from './ProfileEditor';
// Kept as a compatible entry point for the original profile-completion flow.
export default function ProfileForm({ userId }: { userId: string }) {
  return <ProfileEditor userId={userId} initialFirstName="" initialLastName="" initialAvatarUrl="" />;
}
