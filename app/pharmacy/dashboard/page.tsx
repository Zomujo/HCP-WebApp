"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { pharmacyPatientApi } from '../../lib/api';

interface DashboardStat {
  label: string;
  value: string;
}

interface RecentVital {
  id: string;
  patientName: string;
  patientCode?: string;
  recordedAt: string;
}

export default function PharmacyDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [recentVitals, setRecentVitals] = useState<RecentVital[]>([]);
  const [referralCode, setReferralCode] = useState('');
  const [isReferralCopied, setIsReferralCopied] = useState(false);

  const handleCopyReferralCode = async () => {
    if (!referralCode) return;

    try {
      await navigator.clipboard.writeText(referralCode);
      setIsReferralCopied(true);
      window.setTimeout(() => setIsReferralCopied(false), 1800);
    } catch {
      setError('Unable to copy referral code');
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError('');

        const [analytics, vitals, code] = await Promise.all([
          pharmacyPatientApi.getAnalytics(),
          pharmacyPatientApi.getVitalHistories(1, 5),
          pharmacyPatientApi.getReferralCode(),
        ]);

        setStats([
          { label: 'Registered patients', value: String(analytics.patientsCount || 0) },
          { label: 'Vitals recorded', value: String(analytics.vitalsRecordedCount || 0) },
          { label: 'Referrals', value: String(analytics.referralsCount || 0) },
        ]);
        setRecentVitals(vitals);
        setReferralCode(code);
      } catch (err) {
        console.error('Failed to load pharmacy dashboard:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Pharmacy Dashboard</h1>
              <p className="subtitle">Monitor registered patients, vital activity, and referrals.</p>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="loading-state" role="status">
              <span className="spinner" aria-hidden />
              Loading dashboard…
            </div>
          ) : (
            <>
              <section className="stats-row-figma">
                {stats.map((stat) => (
                  <div key={stat.label} className="stat-box-figma">
                    <p className="overline">{stat.label}</p>
                    <p className="stat-value">{stat.value}</p>
                  </div>
                ))}
              </section>

              <section className="panel hcp-panel">
                <div className="panel-headline-row">
                  <div>
                    <p className="panel-title">Referral code</p>
                    <p className="panel-subtitle">Share this code when connecting new patients or partners.</p>
                  </div>
                </div>
                <div className="referral-code-row">
                  <code className="referral-code">{referralCode || 'Not available'}</code>
                  <button type="button" className="ghost small" onClick={handleCopyReferralCode} disabled={!referralCode}>
                    {isReferralCopied ? 'Copied' : 'Copy code'}
                  </button>
                </div>
              </section>

              <section className="panel hcp-panel">
                <div className="panel-headline-row">
                  <div>
                    <p className="panel-title">Recent vitals activity</p>
                    <p className="panel-subtitle">Latest patient vitals recorded by your pharmacy team.</p>
                  </div>
                  <Link href="/pharmacy/patients" className="text-link">View all patients</Link>
                </div>

                <div className="table-wrap stack-on-mobile">

                  <table className="table hcp-table pharmacy-vitals-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Patient Code</th>
                        <th>Recorded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentVitals.length > 0 ? (
                        recentVitals.map((item) => (
                          <tr key={item.id}>
                            <td className="cell-primary">{item.patientName}</td>
                            <td data-label="Patient code">{item.patientCode || 'N/A'}</td>
                            <td data-label="Recorded">{new Date(item.recordedAt).toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="empty-cell">
                            No vitals recorded yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                </div>
              </section>

            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
