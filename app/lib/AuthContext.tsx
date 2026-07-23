'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, AuthResponse } from './api';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'health-worker' | 'pharmacy-personnel';
  facilityId?: string;
  facility?: {
    id: string;
    name: string;
  };
  needsOnboarding?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (googleToken: string) => Promise<User>;
  signup: (data: { email: string; password: string }) => Promise<User>;
  onboard: (data: {
    firstname: string;
    lastname: string;
    phoneNumber: string;
    personnelIdNumber: string;
    facilityId: string;
    facilityName?: string;
  }) => Promise<User>;
  logout: () => void;
  resetAccount: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isLikelyJwt(token: string): boolean {
  return typeof token === 'string' && token.split('.').length === 3;
}

function persistAuth(response: AuthResponse) {
  localStorage.setItem('hcp-auth-token', response.token);
  localStorage.setItem('hcp-user', JSON.stringify(response.user));
  localStorage.setItem('hcp-user-role', response.user.role);
}

function splitUserName(userName?: string): { firstName: string; lastName: string } {
  const parts = (userName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('hcp-auth-token');
      const savedUser = localStorage.getItem('hcp-user');

      if (savedToken && !isLikelyJwt(savedToken)) {
        localStorage.removeItem('hcp-auth-token');
        localStorage.removeItem('hcp-user');
        localStorage.removeItem('hcp-user-role');
        setIsLoading(false);
        return;
      }

      let parsedUser: User | null = null;

      if (savedToken && savedUser && savedUser !== 'undefined') {
        try {
          parsedUser = JSON.parse(savedUser);
          setToken(savedToken);
          setUser(parsedUser);
        } catch (error) {
          console.error('Failed to parse saved user:', error);
          localStorage.removeItem('hcp-auth-token');
          localStorage.removeItem('hcp-user');
          localStorage.removeItem('hcp-user-role');
          setIsLoading(false);
          return;
        }
      }

      if (savedToken) {
        try {
          const current = await authApi.getCurrent();
          const names = splitUserName(current?.userName);
          const hydratedUser: User = {
            id: current?.id || parsedUser?.id || '',
            email: current?.email || parsedUser?.email || '',
            firstName: names.firstName || parsedUser?.firstName || '',
            lastName: names.lastName || parsedUser?.lastName || '',
            role: parsedUser?.role || 'health-worker',
            facilityId: current?.facility?.id || parsedUser?.facilityId,
            facility: current?.facility
              ? { id: current.facility.id, name: current.facility.name }
              : parsedUser?.facility,
            needsOnboarding: !current?.facility,
          };

          setUser(hydratedUser);
          localStorage.setItem('hcp-user', JSON.stringify(hydratedUser));
          localStorage.setItem('hcp-user-role', hydratedUser.role);
        } catch {
          // Keep locally cached user if /current fails.
        }
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const applyAuth = (response: AuthResponse) => {
    persistAuth(response);
    setToken(response.token);
    setUser(response.user);
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await authApi.login(email, password);
      applyAuth(response);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (googleToken: string) => {
    try {
      setIsLoading(true);
      const response = await authApi.loginWithGoogle(googleToken);
      applyAuth(response);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: { email: string; password: string }) => {
    try {
      setIsLoading(true);
      const response = await authApi.signup(data);
      applyAuth(response);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const onboard = async (data: {
    firstname: string;
    lastname: string;
    phoneNumber: string;
    personnelIdNumber: string;
    facilityId: string;
    facilityName?: string;
  }) => {
    try {
      setIsLoading(true);
      const response = await authApi.onboard(data);
      applyAuth(response);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('hcp-auth-token');
    localStorage.removeItem('hcp-user');
    localStorage.removeItem('hcp-user-role');
    setToken(null);
    setUser(null);
  };

  const resetAccount = () => {
    // Local reset only: clears auth/session so user can start fresh from signup.
    localStorage.removeItem('hcp-auth-token');
    localStorage.removeItem('hcp-user');
    localStorage.removeItem('hcp-user-role');
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    login,
    loginWithGoogle,
    signup,
    onboard,
    logout,
    resetAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
