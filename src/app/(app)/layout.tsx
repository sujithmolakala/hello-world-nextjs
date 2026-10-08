import Navigation from '@/components/Navigation';
import { requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <><a className="skip-link" href="#main">Skip to content</a><Navigation />{children}</>;
}
