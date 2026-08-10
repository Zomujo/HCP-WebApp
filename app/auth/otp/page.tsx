"use client";

import { FormEvent, Suspense, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, authApi } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { ROLE_CONFIG } from '../../lib/config';

type OtpFlow = 'signup' | 'login';

interface PendingOtpContext {
  flow: OtpFlow;
  identifier: string;
  password?: string;
  role?: 'health-worker' | 'pharmacy-personnel';
}

const PENDING_OTP_CONTEXT_KEY = 'hcp-pending-otp-context';

function readPendingOtpContext(): PendingOtpContext | null {
  const stored = sessionStorage.getItem(PENDING_OTP_CONTEXT_KEY);
  if (!stored || stored === 'undefined') return null;

  try {
    const parsed = JSON.parse(stored) as PendingOtpContext;
    if (!parsed?.identifier || !parsed?.flow) return null;
    return parsed;
  } catch {
    return null;
  }
}

function OtpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading } = useAuth();

  const queryFlow = searchParams.get('flow');
  const queryIdentifier = searchParams.get('identifier') || '';

  const pending = useMemo(() => readPendingOtpContext(), []);
  const flow: OtpFlow = (queryFlow === 'signup' || queryFlow === 'login')
    ? queryFlow
    : (pending?.flow || 'login');
  const identifier = queryIdentifier || pending?.identifier || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const completeVerificationFlow = async (pendingContext: PendingOtpContext | null) => {
    if (pendingContext?.password) {
      const loggedInUser = await login(identifier, pendingContext.password);
      sessionStorage.removeItem(PENDING_OTP_CONTEXT_KEY);

      if (flow === 'signup' || loggedInUser.needsOnboarding) {
        router.push('/onboarding');
        return;
      }

      router.push(ROLE_CONFIG[loggedInUser.role].defaultRoute);
      return;
    }

    sessionStorage.removeItem(PENDING_OTP_CONTEXT_KEY);
    setNotice('OTP verified successfully. Please sign in now.');
    router.push('/login');
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!identifier) {
      setError('Missing email identifier. Please go back and try again.');
      return;
    }

    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit OTP code from your email.');
      return;
    }

    const pendingContext = readPendingOtpContext();

    try {
      setError('');
      setNotice('');
      setIsSubmitting(true);

      await authApi.verifyOtp(identifier, Number(code.trim()));
      await completeVerificationFlow(pendingContext);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError('No OTP request found for this email. Please resend OTP and try again.');
          return;
        }

        if (err.status === 409) {
          if (/already verified/i.test(err.message)) {
            await completeVerificationFlow(pendingContext);
            return;
          }
          setError('This OTP is invalid or has expired. Please resend OTP and try again.');
          return;
        }
      }

      const message = err instanceof Error ? err.message : 'Failed to verify OTP.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!identifier) {
      setError('Missing email identifier. Please return to login or signup and try again.');
      return;
    }

    try {
      setError('');
      setNotice('');
      setIsResending(true);
      await authApi.resendOtp(identifier);
      setNotice('A new OTP has been sent to your email.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend OTP.';
      setError(message);
    } finally {
      setIsResending(false);
    }
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
            <h1>Enter OTP</h1>
            <p className="text-muted">
              Enter the 6-digit code sent to {identifier || 'your email'}.
            </p>
          </div>

          <form className="auth-fields" onSubmit={handleVerifyOtp}>
            <label>
              <span className="block-label">Verification Code</span>
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                disabled={isSubmitting || isLoading}
              />
            </label>

            <button
              type="submit"
              className="auth-submit"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>

          <button
            type="button"
            className="ghost auth-action-button"
            onClick={handleResendOtp}
            disabled={isResending || isSubmitting || isLoading}
          >
            <span>{isResending ? 'Sending...' : 'Resend OTP'}</span>
          </button>

          {notice && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: '#eef9f2',
                borderRadius: '6px',
                border: '1px solid #ccead6',
                color: '#2d7a47',
                fontSize: '14px',
                marginBottom: '16px'
              }}
            >
              {notice}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: '#fee',
                borderRadius: '6px',
                border: '1px solid #fcc',
                color: '#c33',
                fontSize: '14px',
                marginBottom: '16px'
              }}
            >
              {error}
            </div>
          )}

          <p className="auth-footnote">
            Back to <Link href={flow === 'signup' ? '/signup' : '/login'}>{flow === 'signup' ? 'Sign up' : 'Sign in'}</Link>
          </p>
        </section>

        <section className="auth-hero auth-hero-login">
          <div className="hero-copy">
            <p>Secure verification keeps your health worker account protected.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function OtpPage() {
  return (
    <Suspense fallback={null}>
      <OtpPageContent />
    </Suspense>
  );
}
