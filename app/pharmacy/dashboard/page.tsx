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
          { label: 'Registered Patients', value: String(analytics.patientsCount || 0) },
          { label: 'Vitals Recorded', value: String(analytics.vitalsRecordedCount || 0) },
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
              <p className="subtitle">Overview of pharmacy patients and team communication.</p>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#fee',
              borderRadius: '6px',
              border: '1px solid #fcc',
              color: '#c33',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
              Loading dashboard...
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

              <section className="panel hcp-panel" style={{ marginTop: 18 }}>
                <div className="panel-headline-row" style={{ marginBottom: 10 }}>
                  <div>
                    <p className="panel-title">Referral Code</p>
                    <p className="text-muted">Share this code when connecting new patients or partners.</p>
                  </div>
                </div>
                <div className="appointment-row" style={{ alignItems: 'center' }}>
                  <div>
                    <p className="appointment-title" style={{ letterSpacing: '0.08em' }}>
                      {referralCode || 'Not available'}
                    </p>
                  </div>
                  <Link href="/pharmacy/patients" className="ghost small">
                    Open Patients
                  </Link>
                </div>
              </section>

              <section className="panel hcp-panel" style={{ marginTop: 18 }}>
                <div className="panel-headline-row" style={{ marginBottom: 10 }}>
                  <div>
                    <p className="panel-title">Recent Vitals Activity</p>
                    <p className="text-muted">Latest patient vitals recorded by your pharmacy team.</p>
                  </div>
                  <Link href="/pharmacy/patients" className="text-link">See All Patients</Link>
                </div>

                <table className="table hcp-table">
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
                          <td>{item.patientName}</td>
                          <td>{item.patientCode || 'N/A'}</td>
                          <td>{new Date(item.recordedAt).toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                          No vitals recorded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <section className="panel hcp-panel" style={{ marginTop: 18 }}>
                <div className="panel-headline-row" style={{ marginBottom: 10 }}>
                  <p className="panel-title">Quick Access</p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Link href="/pharmacy/patients" className="ghost">
                    Open Patients
                  </Link>
                  <Link href="/pharmacy/chats" className="ghost">
                    Open Chats
                  </Link>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
