"use client";

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useGoogleScript, signInWithGoogle } from '../lib/googleAuth';

export default function SignupPage() {
  const router = useRouter();
  const { signup, loginWithGoogle, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useGoogleScript();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await signup({ email, password });
      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
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
          router.push('/dashboard');
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
          <p className="auth-divider">Or sign up with email</p>

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

          <form className="auth-fields" onSubmit={handleSubmit}>
            <label>
              <span className="block-label">Email</span>
              <input 
                name="email" 
                type="email" 
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting || isLoading}
              />
            </label>
            <label>
              <span className="block-label">Password</span>
              <input 
                name="password" 
                type="password" 
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting || isLoading}
              />
            </label>
            <button 
              type="submit" 
              className="primary auth-submit"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? 'Signing up...' : 'Sign up ›'}
            </button>
          </form>

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
