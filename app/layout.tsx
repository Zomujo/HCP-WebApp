import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YLIMA HCP Portal',
  description: 'Healthcare platform for chronic care management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
