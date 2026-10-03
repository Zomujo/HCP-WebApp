"use client";

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import { authApi, ApiError } from '../../lib/api';
import { ROLE_CONFIG } from '../../lib/config';

const PENDING_GOOGLE_LINK_TOKEN_KEY = 'hcp-pending-google-link-token';

export default function GoogleLinkPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem(PENDING_GOOGLE_LINK_TOKEN_KEY);
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const googleToken = sessionStorage.getItem(PENDING_GOOGLE_LINK_TOKEN_KEY);
    if (!googleToken) {
      setError('Google sign-in session expired. Please try Google sign-in again.');
      return;
    }

    try {
      setError('');
      setIsSubmitting(true);

      const loggedInUser = await login(email.trim(), password);
      await authApi.linkGoogleAccount(googleToken);

      sessionStorage.removeItem(PENDING_GOOGLE_LINK_TOKEN_KEY);

      if (loggedInUser.needsOnboarding) {
        router.push('/onboarding');
        return;
      }

      router.push(ROLE_CONFIG[loggedInUser.role].defaultRoute);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password. Please try again.');
        return;
      }

      const message = err instanceof Error ? err.message : 'Failed to link Google account.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-container">
        <section className="auth-form-shell">
                    <div className="auth-brand">
            <div className="logo-mark">
              <Image src="/logo.png" alt="YELIMA logo" width={44} height={44} />
            </div>
            <div>
              <p className="auth-brand-title">YELIMA</p>
              <p className="auth-brand-subtitle">Health Worker portal</p>
            </div>
          </div>

          <div className="auth-copy">
            <h1>Link your Google account</h1>
            <p className="text-muted">
              This email already exists. Sign in with your email and password to verify ownership and link your Google account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="credentials-form">
            <label htmlFor="link-email" className="credentials-label">Email</label>
            <input
              id="link-email"
              type="email"
              className="credentials-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={isSubmitting || isLoading}
            />

            <label htmlFor="link-password" className="credentials-label">Password</label>
            <input
              id="link-password"
              type="password"
              className="credentials-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              disabled={isSubmitting || isLoading}
            />

            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="primary auth-submit-button"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Verifying and linking...' : 'Verify and link Google'}
            </button>
          </form>

          <p className="auth-footnote">
            Want to use another account? <Link href="/login">Back to sign in</Link>
          </p>
        </section>

        <section className="auth-hero auth-hero-login" aria-hidden="true" />
      </div>
    </main>
  );
}
