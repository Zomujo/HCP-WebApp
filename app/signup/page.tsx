"use client";

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useGoogleScript, signInWithGoogle } from '../lib/googleAuth';
import { ROLE_CONFIG } from '../lib/config';
import { ApiError } from '../lib/api';

const PENDING_GOOGLE_LINK_TOKEN_KEY = 'hcp-pending-google-link-token';
const PENDING_OTP_CONTEXT_KEY = 'hcp-pending-otp-context';

export default function SignupPage() {
  const router = useRouter();
  const { signup, loginWithGoogle, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'health-worker' | 'pharmacy-personnel'>('health-worker');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useGoogleScript();

  const handleEmailPasswordSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError('Email is required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const signedUpUser = await signup({ email: normalizedEmail, password, role });

      if (signedUpUser.needsOtpVerification) {
        sessionStorage.setItem(
          PENDING_OTP_CONTEXT_KEY,
          JSON.stringify({
            flow: 'signup',
            identifier: normalizedEmail,
            password,
            role,
          })
        );
        router.push(`/auth/otp?flow=signup&identifier=${encodeURIComponent(normalizedEmail)}`);
        return;
      }

      if (signedUpUser.needsOnboarding) {
        router.push('/onboarding');
        return;
      }

      router.push(ROLE_CONFIG[signedUpUser.role].defaultRoute);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = () => {
    signInWithGoogle(
      async (token: string) => {
        try {
          setIsSubmitting(true);
          setError('');
          const loggedInUser = await loginWithGoogle(token);
          if (loggedInUser.needsOnboarding) {
            router.push('/onboarding');
            return;
          }
          router.push(ROLE_CONFIG[loggedInUser.role].defaultRoute);
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            sessionStorage.setItem(PENDING_GOOGLE_LINK_TOKEN_KEY, token);
            router.push('/login/google-link');
            return;
          }

          const errorMessage = err instanceof Error ? err.message : 'Google sign up failed';
          console.error('Google sign up error:', err);
          setError(errorMessage);
        } finally {
          setIsSubmitting(false);
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
              <Image src="/logo.png" alt="YELIMA logo" width={40} height={40} />
            </div>
            <div>
              <p className="auth-brand-title">YELIMA</p>
              <p className="auth-brand-subtitle">Health Worker portal</p>
            </div>
          </div>

          <div className="auth-copy">
            <h1>Create Account</h1>
            <p className="text-muted">Sign up to get started on your health worker journey.</p>
          </div>

          <form className="auth-fields" onSubmit={handleEmailPasswordSignup}>
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
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
                disabled={isSubmitting || isLoading}
              />
            </label>

            <label>
              <span className="block-label">Confirm Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                required
                disabled={isSubmitting || isLoading}
              />
            </label>

            <label>
              <span className="block-label">Account Type</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as 'health-worker' | 'pharmacy-personnel')}
                disabled={isSubmitting || isLoading}
              >
                <option value="health-worker">Health Worker</option>
                <option value="pharmacy-personnel">Pharmacy Personnel</option>
              </select>
            </label>

            <button
              type="submit"
              className="auth-submit"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="auth-divider">or continue with Google</p>

          <button 
            type="button"
            className="ghost auth-action-button"
            onClick={handleGoogleSignUp}
            disabled={isSubmitting || isLoading}
          >
            <Image src="/GoogleIcon.png" alt="Google icon" width={18} height={18} />
            <span>Sign up with Google</span>
          </button>

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
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </section>

        <section className="auth-hero auth-hero-signup">
          <div className="hero-copy">
            <p>Manage Health Conditions Easier with the help of Health Professionals and AI</p>
          </div>
        </section>
      </div>
    </main>
  );
}
