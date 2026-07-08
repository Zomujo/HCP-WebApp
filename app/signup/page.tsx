"use client";

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function SignupPage() {
  const [role, setRole] = useState<'doctor' | 'pharmacist'>('doctor');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem('hcp-auth-token', 'demo-token');
    localStorage.setItem('hcp-user-role', role);
    window.location.href = '/onboarding';
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
              <p className="auth-brand-subtitle">HCP portal</p>
            </div>
          </div>

          <button className="ghost auth-action-button">
            <Image src="/GoogleIcon.png" alt="Google icon" width={18} height={18} />
            <span>Sign up with Google</span>
          </button>
          <p className="auth-divider">Or sign up with email</p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setRole('doctor')}
              className={`${role === 'doctor' ? 'primary' : 'ghost'}`}
              style={{ flex: 1, padding: '8px 12px', fontSize: '14px' }}
            >
              Doctor
            </button>
            <button
              type="button"
              onClick={() => setRole('pharmacist')}
              className={`${role === 'pharmacist' ? 'primary' : 'ghost'}`}
              style={{ flex: 1, padding: '8px 12px', fontSize: '14px' }}
            >
              Pharmacist
            </button>
          </div>

          <form className="auth-fields" onSubmit={handleSubmit}>
            <label>
              <span className="block-label">Email</span>
              <input name="email" type="email" placeholder="you@example.com" defaultValue="user@yelima.health" />
            </label>
            <label>
              <span className="block-label">Password</span>
              <input name="password" type="password" placeholder="At least 6 characters" defaultValue="password123" />
            </label>
            <button type="submit" className="primary auth-submit">Sign up ›</button>
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
