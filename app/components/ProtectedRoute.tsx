"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('hcp-auth-token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setAllowed(true);
  }, [router]);

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
