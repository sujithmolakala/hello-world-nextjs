'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from './SignOutButton';

export default function Navigation() {
  const path = usePathname();
  return <header className="site-header"><div className="nav-shell">
    <Link href="/" className="brand">Mock Humor Study</Link>
    <nav aria-label="Main navigation">{[['/', 'Feed'], ['/create', 'Create'], ['/members', 'Members'], ['/profile', 'My Profile']].map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link>)}</nav>
    <SignOutButton />
  </div></header>;
}
