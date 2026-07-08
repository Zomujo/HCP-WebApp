"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'doctor' | 'pharmacist';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const [allowed, setAllowed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('hcp-auth-token');
    const userRole = localStorage.getItem('hcp-user-role') as 'doctor' | 'pharmacist' | null;

    if (!token) {
      router.replace('/login');
      return;
    }

    if (requiredRole && userRole !== requiredRole) {
      const redirectPath = userRole === 'doctor' ? '/dashboard' : '/pharmacy/dashboard';
      router.replace(redirectPath);
      return;
    }

    setAllowed(true);
  }, [router, requiredRole]);

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
