"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { RegisterPatientModal } from '../../components/RegisterPatientModal';
import { useAuth } from '../../lib/AuthContext';
import { ApiError, pharmacyPatientApi } from '../../lib/api';
import type { CreatePatientInput, PharmacyVitalHistory } from '../../lib/api';

type StatIcon = 'patients' | 'vitals' | 'referrals';

interface DashboardStat {
  label: string;
  value: string;
  hint?: string;
  icon: StatIcon;
  href?: string;
}

function StatGlyph({ name }: { name: StatIcon }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'patients') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3 3 0 0 1 0 5.6M17.5 13.6A5.5 5.5 0 0 1 20.5 19" />
      </svg>
    );
  }
  if (name === 'vitals') {
    return (
      <svg {...common}>
        <path d="M3 12h4l2-5 4 10 2-5h6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
    </svg>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatRelative(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

export default function PharmacyDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [recentVitals, setRecentVitals] = useState<PharmacyVitalHistory[]>([]);
  const [referralCode, setReferralCode] = useState('');
  const [isReferralCopied, setIsReferralCopied] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleCopyReferralCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setIsReferralCopied(true);
      window.setTimeout(() => setIsReferralCopied(false), 1800);
    } catch {
      setError('Unable to copy the referral code. Select it and copy manually.');
    }
  };

  const handleRegister = async (input: CreatePatientInput) => {
    const id = await pharmacyPatientApi.createPatient(input);
    setShowRegister(false);
    router.push(id ? `/pharmacy/patients/${id}?registered=1` : '/pharmacy/patients');
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError('');

        // Load sections independently so one failing endpoint does not blank the whole dashboard.
        const [analytics, vitals, code, patientCount] = await Promise.allSettled([
          pharmacyPatientApi.getAnalytics(),
          pharmacyPatientApi.getRecentVitals(6),
          pharmacyPatientApi.getReferralCode(),
          pharmacyPatientApi.getPatientCount(),
        ]);

        const counts = analytics.status === 'fulfilled' ? analytics.value : null;
        const format = (value?: number) => (counts ? String(value || 0) : '—');
        // Count from the patient list so the card always matches the Patients page.
        const registeredPatients = patientCount.status === 'fulfilled'
          ? String(patientCount.value)
          : format(counts?.patientsCount);
        setStats([
          { label: 'Registered patients', value: registeredPatients, icon: 'patients', href: '/pharmacy/patients' },
          { label: 'Vitals recorded', value: format(counts?.vitalsRecordedCount), hint: 'Readings taken by your team', icon: 'vitals' },
          { label: 'Referrals', value: format(counts?.referralsCount), hint: 'Joined with your code', icon: 'referrals' },
        ]);
        if (vitals.status === 'fulfilled') setRecentVitals(vitals.value);
        if (code.status === 'fulfilled') setReferralCode(code.value);

        const failures = [analytics, vitals, code]
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map((result) => result.reason);
        if (failures.length > 0) {
          console.error('Failed to load parts of the pharmacy dashboard:', failures);
          const forbidden = failures.some((reason) => reason instanceof ApiError && reason.status === 403);
          setError(
            forbidden
              ? 'Your account does not have pharmacy access yet. Sign out and sign in again; if this continues, contact support to confirm your account is registered as pharmacy personnel.'
              : 'Some dashboard data could not be loaded. Refresh to try again.'
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const pharmacyName = user?.firstName || 'there';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <p className="page-kicker">{today}</p>
              <h1 className="hcp-page-title">{greeting()}, {pharmacyName}</h1>
              <p className="subtitle">Here&apos;s what&apos;s happening with your patients.</p>
            </div>
            <div className="header-actions">
              <Link href="/pharmacy/patients" className="ghost small">View patients</Link>
              <button type="button" className="primary small" onClick={() => setShowRegister(true)}>
                <span aria-hidden>+</span> Register patient
              </button>
            </div>
          </div>

          {error && <div className="alert alert-error" role="alert">{error}</div>}

          {isLoading ? (
            <div className="loading-state" role="status">
              <span className="spinner" aria-hidden />
              Loading dashboard…
            </div>
          ) : (
            <>
              <section className="stats-row-figma">
                {stats.map((stat) => {
                  const body = (
                    <>
                      <div className="stat-top">
                        <p className="overline">{stat.label}</p>
                        <span className={`stat-icon stat-icon-${stat.icon}`}><StatGlyph name={stat.icon} /></span>
                      </div>
                      <p className="stat-value">{stat.value}</p>
                      {stat.hint && <p className="stat-hint">{stat.hint}</p>}
                    </>
                  );
                  return stat.href ? (
                    <Link key={stat.label} href={stat.href} className="stat-box-figma">{body}</Link>
                  ) : (
                    <div key={stat.label} className="stat-box-figma">{body}</div>
                  );
                })}
              </section>

              <div className="dashboard-columns">
                <section className="panel hcp-panel">
                  <div className="panel-headline-row">
                    <div>
                      <p className="panel-title">Recent vitals</p>
                      <p className="panel-subtitle">Latest readings recorded for patients.</p>
                    </div>
                    <Link href="/pharmacy/patients" className="text-link">All patients</Link>
                  </div>

                  {recentVitals.length > 0 ? (
                    <ul className="activity-list">
                      {recentVitals.map((item) => (
                        <li key={item.id}>
                          <Link href={`/pharmacy/patients/${item.patientId}`} className="activity-item">
                            <span className="table-avatar">{initials(item.patientName)}</span>
                            <span className="activity-text">
                              <span className="activity-title">{item.patientName}</span>
                              <span className="activity-meta">
                                {item.patientCode ? `${item.patientCode} · ` : ''}Vitals recorded
                              </span>
                            </span>
                            <span className="activity-time">{formatRelative(item.recordedAt)}</span>
                            <svg className="activity-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-state empty-state-cta">
                      <div className="empty-icon" aria-hidden><StatGlyph name="vitals" /></div>
                      <p className="empty-title">No vitals recorded yet</p>
                      <p>Register a patient, then record their blood pressure, sugar and other vitals.</p>
                      <button type="button" className="primary small" onClick={() => setShowRegister(true)}>
                        <span aria-hidden>+</span> Register patient
                      </button>
                    </div>
                  )}
                </section>

                <div className="dashboard-side">
                  <section className="referral-card">
                    <p className="referral-card-label">Your referral code</p>
                    <div className="referral-card-row">
                      <code className="referral-code">{referralCode || 'Not available'}</code>
                      <button type="button" className="ghost small" onClick={handleCopyReferralCode} disabled={!referralCode}>
                        {isReferralCopied ? 'Copied ✓' : 'Copy'}
                      </button>
                    </div>
                    <p className="referral-card-help">Share it with patients and partners so their sign-ups are linked to your pharmacy.</p>
                  </section>

                  <section className="panel hcp-panel">
                    <p className="panel-title">Quick actions</p>
                    <div className="quick-actions">
                      <button type="button" className="quick-action" onClick={() => setShowRegister(true)}>
                        <span className="quick-action-icon"><StatGlyph name="patients" /></span>
                        <span>
                          <strong>Register a patient</strong>
                          <small>Add a new patient record</small>
                        </span>
                      </button>
                      <Link href="/pharmacy/patients" className="quick-action">
                        <span className="quick-action-icon"><StatGlyph name="vitals" /></span>
                        <span>
                          <strong>Record vitals</strong>
                          <small>Choose a patient to add readings</small>
                        </span>
                      </Link>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}

          {showRegister && <RegisterPatientModal onClose={() => setShowRegister(false)} onSubmit={handleRegister} />}
        </main>
      </div>
    </ProtectedRoute>
  );
}
