"use client";

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { authApi } from '../lib/api';
import { useGoogleScript, signInWithGoogle } from '../lib/googleAuth';
import { ROLE_CONFIG } from '../lib/config';

export default function SignupPage() {
  const router = useRouter();
  const { signup, loginWithGoogle, isLoading } = useAuth();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'health-worker' | 'pharmacy-personnel'>('health-worker');
  const pendingOtpKey = 'hcp-pending-otp-context';

  useGoogleScript();

  const handleEmailSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const signedUpUser = await signup({ email: email.trim(), password, role });
      await authApi.resendOtp(email.trim());
      sessionStorage.setItem(pendingOtpKey, JSON.stringify({
        flow: 'signup',
        identifier: email.trim(),
        password,
        role,
      }));
      router.push(`/auth/otp?flow=signup&identifier=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = () => {
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
          const errorMessage = err instanceof Error ? err.message : 'Google sign up failed';
          console.error('Google sign up error:', err);
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

          <button 
            type="button"
            className="ghost auth-action-button"
            onClick={handleGoogleSignUp}
            disabled={isSubmitting || isLoading}
          >
            <Image src="/GoogleIcon.png" alt="Google icon" width={18} height={18} />
            <span>Sign up with Google</span>
          </button>
          <p className="auth-divider">or continue with email</p>

          <form className="auth-fields" onSubmit={handleEmailSignUp}>
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
                minLength={8}
                required
                disabled={isSubmitting || isLoading}
              />
            </label>
            <label>
              <span className="block-label">Account type</span>
              <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} disabled={isSubmitting || isLoading}>
                <option value="health-worker">Health Worker</option>
                <option value="pharmacy-personnel">Pharmacy Personnel</option>
              </select>
            </label>
            <button className="primary auth-submit-button" type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
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
