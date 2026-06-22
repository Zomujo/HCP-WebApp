"use client";

import { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function SignupPage() {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem('hcp-auth-token', 'demo-token');
    window.location.href = '/dashboard';
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
              <p className="overline">Zomjuo</p>
              <p className="subtitle">HCP portal</p>
            </div>
          </div>

          <div className="auth-copy">
            <h1>Sign Up</h1>
            <p className="text-muted">Create an account to manage patients and appointments.</p>
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
            Already have an account? <Link href="/login">Sign in</Link>
          </p>

          <div className="auth-demo">
            <p>Demo credentials:</p>
            <p>Email: <strong>user@zomjuo.health</strong></p>
            <p>Password: <strong>password123</strong></p>
          </div>
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
