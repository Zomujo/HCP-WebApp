"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'health-worker' | 'pharmacy-personnel' | 'pharmacy';
}

function normalizeStoredRole(role: string | null): 'health-worker' | 'pharmacy-personnel' | null {
  if (!role) return null;
  if (role === 'pharmacy') return 'pharmacy-personnel';
  if (role === 'pharmacy-personnel' || role === 'health-worker') return role;
  return null;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const [allowed, setAllowed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('hcp-auth-token');
    const userRole = normalizeStoredRole(localStorage.getItem('hcp-user-role'));
    const expectedRole = requiredRole === 'pharmacy' ? 'pharmacy-personnel' : requiredRole;

    if (!token) {
      router.replace('/login');
      return;
    }

    if (expectedRole && userRole !== expectedRole) {
      const redirectPath = userRole === 'health-worker' ? '/dashboard' : '/pharmacy/dashboard';
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
