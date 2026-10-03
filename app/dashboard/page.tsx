"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { hcpPatientApi } from '../lib/api';
import { formatConditions } from '../lib/format';
import { useAuth } from '../lib/AuthContext';

interface DashboardStats {
  label: string;
  value: string;
  href: string;
  hint: string;
  tone?: 'critical';
}

interface Appointment {
  day: string;
  value: number;
  note: string;
  active?: boolean;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function buildWeeklyCheckInData(lastCheckInDates: string[]): Appointment[] {
  const counts = new Array(7).fill(0);
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  for (const iso of lastCheckInDates) {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime()) || parsed < weekStart || parsed >= weekEnd) {
      continue;
    }

    const index = (parsed.getDay() + 6) % 7;
    counts[index] += 1;
  }

  const todayIndex = (new Date().getDay() + 6) % 7;

  return counts.map((value, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);

    return {
    day: date.toLocaleDateString(undefined, { weekday: 'short' }),
    value,
    note: `${value} ${value === 1 ? 'check-in' : 'check-ins'}`,
    active: index === todayIndex,
    };
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats[]>([]);
  const [weeklyAppointments, setWeeklyAppointments] = useState<Appointment[]>([]);
  const [recentReadings, setRecentReadings] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        setError('');

        // Use the same facility-scoped patient collection as the patients page.
        const facilityId = user?.facilityId || user?.facility?.id;
        if (!facilityId) {
          setDashboardStats([]);
          setRecentReadings([]);
          setWeeklyAppointments([]);
          return;
        }

        const patients = await hcpPatientApi.getPatientsWithOptions({
          page: 1,
          pageSize: 100,
          facilityId,
        });
        
        // Ensure patients is an array
        if (!Array.isArray(patients)) {
          throw new Error('Patients data is not in the correct format');
        }

        let locallyCreatedPatients: any[] = [];
        try {
          const stored = JSON.parse(localStorage.getItem(`hcp-created-patients:${facilityId}`) || '[]');
          locallyCreatedPatients = Array.isArray(stored) ? stored.filter((patient) => patient?.id) : [];
        } catch {
          locallyCreatedPatients = [];
        }

        const allPatients = [
          ...locallyCreatedPatients,
          ...patients.filter((patient) => !locallyCreatedPatients.some((localPatient) => localPatient.id === patient.id)),
        ];

        // Calculate stats
        const totalPatients = allPatients.length;
        const criticalCount = allPatients.filter((patient) => (patient.criticalReadingsCount || 0) > 0 || patient.status === 'Critical').length;
        const weeklyCheckIns = buildWeeklyCheckInData(
          allPatients
            .map((patient) => patient.lastCheckInAt)
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
        );

        setDashboardStats([
          { label: 'Total patients', value: totalPatients.toString(), href: '/patients', hint: 'Registered at your facility' },
          {
            label: 'Critical readings',
            value: criticalCount.toString(),
            href: '/patients',
            hint: criticalCount === 1 ? 'Patient needs review' : 'Patients need review',
            tone: criticalCount > 0 ? 'critical' : undefined,
          },
        ]);

        // Set recent readings (first 3 patients with critical/caution status)
        const critical = allPatients
          .filter((patient) => (patient.criticalReadingsCount || 0) > 0 || patient.status === 'Critical')
          .slice(0, 3);
        setRecentReadings(critical);

        setWeeklyAppointments(weeklyCheckIns);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [user?.facilityId, user?.facility?.id]);

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase();
  };
  return (
    <ProtectedRoute requiredRole="health-worker">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Dashboard</h1>
              <p className="subtitle">A snapshot of your clinic workload and patient safety signals.</p>
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
                {dashboardStats.map((stat) => (
                  <Link key={stat.label} href={stat.href} className={`stat-box-figma ${stat.tone === 'critical' ? 'stat-critical' : ''}`}>
                    <p className="overline">{stat.label}</p>
                    <p className="stat-value">{stat.value}</p>
                    <p className="stat-hint">{stat.hint}</p>
                  </Link>
                ))}
              </section>

              <section className="panel hcp-panel">
                <div className="panel-headline-row">
                  <div>
                    <p className="panel-title">Patient check-ins this week</p>
                    <p className="panel-subtitle">{weeklyAppointments.reduce((sum, a) => sum + a.value, 0)} total check-ins</p>
                  </div>
                  <Link href="/patients" className="text-link">View all patients</Link>
                </div>

                <div className="week-grid-figma">
                  {weeklyAppointments.map((item) => (
                    <div key={item.day} className={`week-cell ${item.active ? 'active' : ''}`}>
                      <p>{item.day}</p>
                      <strong>{item.value}</strong>
                      <span>{item.note}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel hcp-panel">
                <div className="panel-headline-row">
                  <p className="panel-title">Recent critical readings</p>
                  <Link href="/patients" className="text-link">View all</Link>
                </div>

                <div className="table-wrap stack-on-mobile">

                  <table className="table hcp-table dashboard-readings-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Age</th>
                        <th>Condition</th>
                        <th>Last check-in</th>
                        <th>Adherence</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {recentReadings.length > 0 ? (
                        recentReadings.map((patient) => (
                          <tr key={patient.id}>
                            <td className="cell-primary">
                              <div className="table-name-cell">
                                <span className="table-avatar">{getInitials(patient.firstName, patient.lastName)}</span>
                                {patient.firstName} {patient.lastName}
                              </div>
                            </td>
                            <td data-label="Age">{patient.age}</td>
                            <td data-label="Condition">{formatConditions(patient.chronicConditions)}</td>
                            <td data-label="Last check-in">{patient.lastCheckIn || 'N/A'}</td>
                            <td className="adherence-cell" data-label="Adherence">{patient.adherence || 'N/A'}</td>
                            <td data-label="Status">
                              <span className={`status-pill status-${(patient.status || 'unknown').toLowerCase()}`}>
                                {patient.status || 'Unknown'}
                              </span>
                            </td>
                            <td className="row-arrow">
                              <Link href={`/patients/${patient.id}`} aria-label="Open patient details"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg></Link>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="empty-cell">
                            No critical readings at the moment
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
