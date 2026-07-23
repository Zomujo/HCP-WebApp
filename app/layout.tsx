import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from './lib/AuthContext';

export const metadata: Metadata = {
  title: 'YELIMA Health Worker Portal',
  description: 'Healthcare platform for chronic care management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
