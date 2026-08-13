"use client";

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { ApiError, authApi } from '../lib/api';
import { useGoogleScript, signInWithGoogle } from '../lib/googleAuth';
import { ROLE_CONFIG } from '../lib/config';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle, isLoading, isAuthenticated, user } = useAuth();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useGoogleScript();

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const loggedInUser = await login(email.trim(), password);
      router.push(loggedInUser.needsOnboarding ? '/onboarding' : ROLE_CONFIG[loggedInUser.role].defaultRoute);
    } catch (err) {
      if (err instanceof ApiError && /otp|verif|not verified/i.test(err.message)) {
        try {
          await authApi.resendOtp(email.trim());
          sessionStorage.setItem('hcp-pending-otp-context', JSON.stringify({
            flow: 'login',
            identifier: email.trim(),
            password,
          }));
          router.push(`/auth/otp?flow=login&identifier=${encodeURIComponent(email.trim())}`);
          return;
        } catch (resendError) {
          setError(resendError instanceof Error ? resendError.message : 'Unable to send verification code.');
          return;
        }
      }

      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.needsOnboarding) {
        router.push('/onboarding');
        return;
      }
      const defaultRoute = ROLE_CONFIG[user.role].defaultRoute;
      router.push(defaultRoute);
    }
  }, [isAuthenticated, user, router]);

  const handleGoogleSignIn = () => {
    signInWithGoogle(
      async (token: string) => {
        try {
          setError('');
          const loggedInUser = await loginWithGoogle(token);
          if (loggedInUser.needsOnboarding) {
            router.push('/onboarding');
            return;
          }
          router.push(ROLE_CONFIG[loggedInUser.role].defaultRoute);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Google sign in failed';
          console.error('Google sign in error:', err);
          setError(errorMessage);
        }
      },
      (message: string) => {
        setError(message);
      }
    );
  };

  return (
    <main className="auth-page">
      <div className="auth-container">
        <section className="auth-form-shell">
          <div className="auth-glow" />
          <div className="auth-brand">
            <div className="logo-mark">
              <Image src="/logo.png" alt="YELIMA logo" width={28} height={28} />
            </div>
            <div>
              <p className="auth-brand-title">YELIMA</p>
              <p className="auth-brand-subtitle">Health Worker portal</p>
            </div>
          </div>

          <div className="auth-copy">
            <h1>Welcome Back</h1>
            <p className="text-muted">Welcome back! Please enter your details.</p>
          </div>

          <button 
            type="button"
            className="ghost auth-action-button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting || isLoading}
          >
            <Image src="/GoogleIcon.png" alt="Google icon" width={18} height={18} />
            <span>Sign in with Google</span>
          </button>
          <p className="auth-divider">or continue with email</p>

          <form className="auth-fields" onSubmit={handleEmailSignIn}>
            <label>
              <span className="block-label">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={isSubmitting || isLoading}
              />
            </label>
            <label>
              <span className="block-label">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                disabled={isSubmitting || isLoading}
              />
            </label>
            <button className="primary auth-submit-button" type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {error && (
            <div style={{ 
              padding: '10px 12px', 
              backgroundColor: '#fee', 
              borderRadius: '6px',
              border: '1px solid #fcc',
              color: '#c33',
              fontSize: '14px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <p className="auth-footnote">
            Don&apos;t have an account? <Link href="/signup">Sign up</Link>
          </p>
        </section>

        <section className="auth-hero auth-hero-login">
          <div className="hero-copy">
            <p>Manage Health Conditions Easier with the help of Health Professionals and AI</p>
          </div>
        </section>
      </div>
    </main>
  );
}
