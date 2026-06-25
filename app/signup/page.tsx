"use client";

import { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function SignupPage() {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem('hcp-auth-token', 'demo-token');
    window.location.href = '/onboarding';
  };

  return (
    <main className="auth-page">
      <div className="auth-container">
        <section className="auth-form-shell">
          <div className="auth-glow" />
          <div className="auth-brand">
            <div className="logo-mark">
              <Image src="/logo.png" alt="Zomjuo logo" width={40} height={40} />
            </div>
            <div>
              <p className="auth-brand-title">Zyptyk</p>
              <p className="auth-brand-subtitle">HCP portal</p>
            </div>
          </div>

          <button className="ghost auth-action-button">
            <Image src="/GoogleIcon.png" alt="Google icon" width={18} height={18} />
            <span>Sign up with Google</span>
          </button>
          <p className="auth-divider">Or sign up with email</p>

          <form className="auth-fields" onSubmit={handleSubmit}>
            <label>
              <span className="block-label">Email</span>
              <input name="email" type="email" placeholder="you@example.com" defaultValue="user@zomjuo.health" />
            </label>
            <label>
              <span className="block-label">Password</span>
              <input name="password" type="password" placeholder="At least 6 characters" defaultValue="password123" />
            </label>
            <button type="submit" className="primary auth-submit">Sign up ›</button>
          </form>

          <p className="auth-footnote">
            Don&apos;t have an account? <Link href="/signup">Sign up</Link>
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
