'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, AuthResponse } from './api';

interface User {
  id: string;
  personnelId: string;
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
  needsOtpVerification?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (googleToken: string) => Promise<User>;
  signup: (data: { email: string; password: string; role: 'health-worker' | 'pharmacy-personnel' }) => Promise<User>;
  onboard: (data: {
    personnelId: string;
    role: 'health-worker' | 'pharmacy-personnel';
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

const PENDING_USER_KEY = 'hcp-pending-onboarding-user';
const PENDING_CREDENTIALS_KEY = 'hcp-pending-onboarding-credentials';

function isLikelyJwt(token: string): boolean {
  return typeof token === 'string' && token.split('.').length === 3;
}

function persistAuth(response: AuthResponse) {
  localStorage.setItem('hcp-auth-token', response.token);
  localStorage.setItem('hcp-user', JSON.stringify(response.user));
  localStorage.setItem('hcp-user-role', response.user.role);
  localStorage.removeItem(PENDING_USER_KEY);
  sessionStorage.removeItem(PENDING_CREDENTIALS_KEY);
}

function persistPendingUser(user: User) {
  localStorage.setItem(PENDING_USER_KEY, JSON.stringify(user));
}

function readPendingUser(): User | null {
  const stored = localStorage.getItem(PENDING_USER_KEY);
  if (!stored || stored === 'undefined') return null;

  try {
    return JSON.parse(stored) as User;
  } catch {
    localStorage.removeItem(PENDING_USER_KEY);
    return null;
  }
}

function persistPendingCredentials(email: string, password: string) {
  sessionStorage.setItem(PENDING_CREDENTIALS_KEY, JSON.stringify({ email, password }));
}

function readPendingCredentials(): { email: string; password: string } | null {
  const stored = sessionStorage.getItem(PENDING_CREDENTIALS_KEY);
  if (!stored || stored === 'undefined') return null;

  try {
    const parsed = JSON.parse(stored) as { email?: string; password?: string };
    if (typeof parsed.email === 'string' && typeof parsed.password === 'string') {
      return { email: parsed.email, password: parsed.password };
    }
  } catch {
    // fall through to cleanup
  }

  sessionStorage.removeItem(PENDING_CREDENTIALS_KEY);
  return null;
}

function clearPendingOnboarding() {
  localStorage.removeItem(PENDING_USER_KEY);
  sessionStorage.removeItem(PENDING_CREDENTIALS_KEY);
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
      const pendingUser = readPendingUser();

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
            personnelId: current?.personnelId || parsedUser?.personnelId || '',
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
      } else if (pendingUser) {
        setUser(pendingUser);
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const applyAuth = (response: AuthResponse) => {
    if (response.token && isLikelyJwt(response.token)) {
      persistAuth(response);
      setToken(response.token);
    } else {
      localStorage.removeItem('hcp-auth-token');
      localStorage.removeItem('hcp-user');
      localStorage.removeItem('hcp-user-role');
      persistPendingUser(response.user);
      setToken(null);
    }
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

  const signup = async (data: { email: string; password: string; role: 'health-worker' | 'pharmacy-personnel' }) => {
    try {
      setIsLoading(true);
      const response = await authApi.signup(data);
      persistPendingCredentials(data.email, data.password);
      applyAuth(response);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const onboard = async (data: {
    personnelId: string;
    role: 'health-worker' | 'pharmacy-personnel';
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

      if (response.token && isLikelyJwt(response.token)) {
        applyAuth(response);
        return response.user;
      }

      const pendingCredentials = readPendingCredentials();
      if (!pendingCredentials) {
        clearPendingOnboarding();
        throw new Error('Onboarding completed. Please sign in with your email and password to continue.');
      }

      const loggedIn = await authApi.login(pendingCredentials.email, pendingCredentials.password);
      applyAuth({
        ...loggedIn,
        user: {
          ...loggedIn.user,
          personnelId: data.personnelId,
          role: data.role,
          firstName: data.firstname,
          lastName: data.lastname,
          facilityId: data.facilityId,
          facility: data.facilityName
            ? { id: data.facilityId, name: data.facilityName }
            : loggedIn.user.facility,
          needsOnboarding: false,
        },
      });
      return loggedIn.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('hcp-auth-token');
    localStorage.removeItem('hcp-user');
    localStorage.removeItem('hcp-user-role');
    clearPendingOnboarding();
    setToken(null);
    setUser(null);
  };

  const resetAccount = () => {
    // Local reset only: clears auth/session so user can start fresh from signup.
    localStorage.removeItem('hcp-auth-token');
    localStorage.removeItem('hcp-user');
    localStorage.removeItem('hcp-user-role');
    clearPendingOnboarding();
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
