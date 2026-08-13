"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { hcpPatientApi } from '../lib/api';

interface DashboardStats {
  label: string;
  value: string;
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
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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

  return labels.map((day, index) => ({
    day,
    value: counts[index],
    note: counts[index] === 1 ? '1 check-in' : `${counts[index]} check-ins`,
    active: index === todayIndex,
  }));
}

export default function DashboardPage() {
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

        // Fetch patients
        const patients = await hcpPatientApi.getPatients(1, 50);
        
        // Ensure patients is an array
        if (!Array.isArray(patients)) {
          throw new Error('Patients data is not in the correct format');
        }

        // Calculate stats
        const totalPatients = patients.length;
        const criticalCount = patients.filter((patient) => (patient.criticalReadingsCount || 0) > 0 || patient.status === 'Critical').length;
        const silentCount = patients.filter(p => p.status === 'Silent').length;
        const weeklyCheckIns = buildWeeklyCheckInData(
          patients
            .map((patient) => patient.lastCheckInAt)
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
        );

        setDashboardStats([
          { label: 'Total Patients', value: totalPatients.toString() },
          { label: 'Patients With Critical Readings', value: criticalCount.toString() },
          { label: 'Silent Patients', value: silentCount.toString() },
        ]);

        // Set recent readings (first 3 patients with critical/caution status)
        const critical = patients
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
  }, []);

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
                {dashboardStats.map((stat) => (
                  <div key={stat.label} className="stat-box-figma">
                    <p className="overline">{stat.label}</p>
                    <p className="stat-value">{stat.value}</p>
                  </div>
                ))}
              </section>

              <section className="panel hcp-panel" style={{ marginTop: 18 }}>
                <div className="panel-headline-row">
                  <div>
                    <p className="panel-title">Patient Check-ins This Week</p>
                    <p className="text-muted">{weeklyAppointments.reduce((sum, a) => sum + a.value, 0)} Total Check-ins</p>
                  </div>
                  <Link href="/patients" className="text-link">See All Patients</Link>
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

              <section className="panel hcp-panel" style={{ marginTop: 18 }}>
                <div className="panel-headline-row" style={{ marginBottom: 10 }}>
                  <p className="panel-title">Recent Critical Readings</p>
                  <Link href="/patients" className="text-link">See All Patients</Link>
                </div>

                <table className="table hcp-table">
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
                          <td>
                            <div className="table-name-cell">
                              <span className="table-avatar">{getInitials(patient.firstName, patient.lastName)}</span>
                              {patient.firstName} {patient.lastName}
                            </div>
                          </td>
                          <td>{patient.age}</td>
                          <td>{patient.chronicConditions?.join(', ') || 'N/A'}</td>
                          <td>{patient.lastCheckIn || 'N/A'}</td>
                          <td className="adherence-cell">{patient.adherence || 'N/A'}</td>
                          <td>
                            <span className={`status-pill status-${(patient.status || 'stable').toLowerCase()}`}>
                              {patient.status || 'Stable'}
                            </span>
                          </td>
                          <td className="row-arrow">
                            <Link href={`/patients/${patient.id}`}>&gt;</Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                          No critical readings at the moment
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
