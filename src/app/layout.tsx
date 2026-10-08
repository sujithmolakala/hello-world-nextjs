import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Mock Humor Study', template: '%s · Mock Humor Study' },
  description: 'Create and rate image captions with the Columbia community.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
