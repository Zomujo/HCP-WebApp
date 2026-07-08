"use client";

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
  const [role, setRole] = useState<'doctor' | 'pharmacist'>('doctor');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = data.get('email');
    const password = data.get('password');

    if (email === 'user@yelima.health' && password === 'password123') {
      localStorage.setItem('hcp-auth-token', 'demo-token');
      localStorage.setItem('hcp-user-role', role);
      const redirectPath = role === 'doctor' ? '/dashboard' : '/pharmacy/dashboard';
      window.location.href = redirectPath;
      return;
    }

    alert('Invalid demo credentials. Use user@yelima.health / password123');
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
              <p className="auth-brand-subtitle">HCP portal</p>
            </div>
          </div>

          <div className="auth-copy">
            <h1>Welcome Back</h1>
            <p className="text-muted">Welcome back! Please enter your details.</p>
          </div>

          <button className="ghost auth-action-button">
            <Image src="/GoogleIcon.png" alt="Google icon" width={18} height={18} />
            <span>Sign in with Google</span>
          </button>
          <p className="auth-divider">Or log in with email</p>

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
            <button type="submit" className="primary auth-submit">Sign in ›</button>
          </form>

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
