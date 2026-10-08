import { redirect } from 'next/navigation';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import { session } from '@/lib/auth';

export const metadata = { title: 'Sign in' };
export default async function SignInPage() {
  const { user } = await session();
  if (user) redirect('/');
  return <main className="sign-in"><div><h1>Mock Humor Study</h1><p>Create and rate image captions with the Columbia community.</p><GoogleLoginButton /></div></main>;
}
