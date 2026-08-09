"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useGoogleScript, signInWithGoogle } from '../lib/googleAuth';
import { ROLE_CONFIG } from '../lib/config';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithGoogle, isLoading, isAuthenticated, user } = useAuth();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useGoogleScript();

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
          <p className="auth-divider">Google authentication only</p>

          <p className="text-muted" style={{ marginTop: 0, marginBottom: 16, fontSize: '0.92rem' }}>
            Email and password login is temporarily unavailable on this environment.
          </p>

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
