"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { hcpPatientApi } from '../../lib/api';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import type { Patient, Appointment, Medication } from '../../lib/api';

const tabs = ['Overview', 'Readings', 'Medication', 'Appointments', 'Chat'] as const;
type TabName = (typeof tabs)[number];

function formatAppointmentDate(value?: string): string {
  if (!value) return 'Unknown date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PatientDetailsPage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [messageText, setMessageText] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [readingComment, setReadingComment] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError('');

        const [patientData, vitalsData, appointmentsData, medicationsData] = await Promise.all([
          hcpPatientApi.getPatientById(patientId),
          hcpPatientApi.getPatientVitals(patientId).catch(() => []),
          hcpPatientApi.getPatientAppointments(patientId),
          hcpPatientApi.getPatientMedications(patientId),
        ]);

        setPatient(patientData);
        setVitals(Array.isArray(vitalsData) ? vitalsData : []);
        setAppointments(appointmentsData);
        setMedications(medicationsData);
      } catch (err) {
        console.error('Failed to load patient data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load patient data');
      } finally {
        setIsLoading(false);
      }
    };

    if (patientId) {
      loadData();
    }
  }, [patientId]);

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      setCancellingId(appointmentId);
      await hcpPatientApi.cancelAppointment(patientId, appointmentId);
      const refreshed = await hcpPatientApi.getPatientAppointments(patientId);
      setAppointments(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute requiredRole="health-worker">
        <div className="app-shell">
          <Sidebar />
          <main className="content hcp-page">
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
              Loading patient details...
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !patient) {
    return (
      <ProtectedRoute requiredRole="health-worker">
        <div className="app-shell">
          <Sidebar />
          <main className="content hcp-page">
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fee',
                borderRadius: '6px',
                border: '1px solid #fcc',
                color: '#c33',
              }}
            >
              {error || 'Patient not found'}
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  const getInitials = () => {
    const first = patient.firstName?.[0] || '';
    const last = patient.lastName?.[0] || '';
    return (first + last).toUpperCase();
  };

  const upcoming = appointments.filter((a) => a.status === 'scheduled' || a.status === 'active');
  const past = appointments.filter((a) => a.status === 'completed' || a.status === 'cancelled');
  const chartData = [120, 180, 150, 380, 250, 210, 240, 140, 440, 320, 340, 305];
  const currentBloodPressure = patient?.vitals?.systolic && patient?.vitals?.diastolic
    ? `${patient.vitals.systolic} / ${patient.vitals.diastolic}`
    : '168 / 102';

  return (
    <ProtectedRoute requiredRole="health-worker">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <section className="patient-head-figma">
            <div className="table-avatar patient-head-avatar">{getInitials()}</div>
            <div>
              <h1 className="patient-head-title">
                {patient.firstName} {patient.lastName}
              </h1>
              <p className="text-muted" style={{ margin: '4px 0 0' }}>
                {patient.age} • {patient.chronicConditions?.join(', ') || 'N/A'} • Patient since Jan 2025
              </p>
              <div className="patient-chip-row">
                <span className="badge badge-critical">△ 3 critical readings</span>
                <span className="badge badge-caution">Adherence {patient.adherence || '64%'}</span>
                <span className="badge badge-stable">Assigned to you</span>
              </div>
            </div>
          </section>

          <nav className="patient-tab-nav" aria-label="Patient tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`patient-tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>

          {activeTab === 'Overview' && (
            <section className="patient-overview-grid">
              <div className="panel hcp-panel">
                <div className="panel-headline-row" style={{ marginBottom: 12 }}>
                  <p className="panel-title">Patient details</p>
                </div>
                <div className="patient-kv-grid">
                  <div>
                    <p className="block-label">Full name</p>
                    <p>
                      {patient.firstName} {patient.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="block-label">Age</p>
                    <p>{patient.age}</p>
                  </div>
                  <div>
                    <p className="block-label">Ghana Card</p>
                    <p>{patient.ghanaCard || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="block-label">NHIS</p>
                    <p>{patient.nhis || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="block-label">Conditions</p>
                    <p>{patient.chronicConditions?.join(', ') || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="block-label">Registered</p>
                    <p>14 Jan 2025</p>
                  </div>
                  <div>
                    <p className="block-label">Facility</p>
                    <p>{patient.facility || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="panel hcp-panel">
                <p className="panel-title">Latest vitals</p>
                <div className="latest-vitals-box">
                  <p className="block-label" style={{ color: '#c14d4d' }}>
                    CRITICAL
                  </p>
                  <p className="latest-vitals-value">{currentBloodPressure}</p>
                  <p className="text-muted" style={{ margin: 0 }}>mmHg • Today 07:42 · AI check-in</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'Readings' && (
            <section className="panel hcp-panel">
              <div className="readings-chart-box">
                <div className="readings-chart-inner">
                  <svg viewBox="0 0 720 250" width="100%" height="100%" preserveAspectRatio="none">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <line key={`h-${index}`} x1="60" y1={30 + index * 35} x2="680" y2={30 + index * 35} className="chart-grid-line" />
                    ))}
                    {Array.from({ length: 12 }).map((_, index) => (
                      <line key={`v-${index}`} x1={60 + index * 56} y1="30" x2={60 + index * 56} y2="205" className="chart-grid-line" />
                    ))}

                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                      <text key={month} x={60 + index * 56} y="225" textAnchor="middle" className="chart-axis-text">{month}</text>
                    ))}

                    <text x="20" y="118" className="chart-axis-text">Blood Pressure</text>

                    <polyline
                      className="chart-line-systolic"
                      points={chartData.map((value, index) => `${60 + index * 56},${205 - (value / 500) * 170}`).join(' ')}
                    />
                    {chartData.map((value, index) => (
                      <circle
                        key={`d-${index}`}
                        className="chart-dot-systolic"
                        cx={60 + index * 56}
                        cy={205 - (value / 500) * 170}
                        r="3.2"
                      />
                    ))}
                  </svg>
                </div>
              </div>

              <div className="reading-card">
                <p><strong>BP</strong> {currentBloodPressure} mmHg <span className="badge badge-critical" style={{ marginLeft: 8 }}>Critical</span></p>
                <p className="text-muted">Today 07:42 · AI check-in</p>
                <p className="block-label" style={{ marginTop: 10 }}>Leave a critical comment</p>
                <div className="reading-note-row">
                  <button className="filter-pill" type="button" onClick={() => setReadingComment('Your reading looks good, keep it up.')}>Your reading looks good, keep it up.</button>
                  <button className="filter-pill" type="button" onClick={() => setReadingComment('This reading needs monitoring, please check in again tomorrow.')}>This reading needs monitoring, please check in again tomorrow.</button>
                  <button className="filter-pill" type="button" onClick={() => setReadingComment('This reading is concerning, please visit the facility as soon as possible.')}>This reading is concerning, please visit the facility as soon as possible.</button>
                  <button className="filter-pill" type="button" onClick={() => setReadingComment('Please ensure you are taking your medication as prescribed.')}>Please ensure you are taking your medication as prescribed.</button>
                </div>
                <div className="readings-action-row">
                  <input
                    value={readingComment}
                    onChange={(event) => setReadingComment(event.target.value)}
                    placeholder="Add a short guidance note"
                  />
                  <button className="ghost small readings-action-clear" type="button" onClick={() => setReadingComment('')}>Clear</button>
                  <button className="primary small readings-action-send" type="button">Send to patient</button>
                </div>
              </div>

              {['161 / 98', '152 / 94', '145 / 91', '138 / 86'].map((bp, index) => (
                <div key={bp} className="reading-mini-card">
                  <p><strong>BP</strong> {bp} mmHg</p>
                  <p className="text-muted" style={{ marginTop: 4 }}>{index + 1} day(s) ago · AI check-in</p>
                </div>
              ))}
            </section>
          )}

          {activeTab === 'Medication' && (
            <section className="patient-overview-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
              <div className="panel hcp-panel">
                <div className="panel-headline-row" style={{ marginBottom: 10 }}>
                  <p className="panel-title">30-day adherence</p>
                  <p className="text-muted" style={{ margin: 0 }}><strong style={{ color: '#f2994a' }}>{patient.adherence || '64%'}</strong> overall</p>
                </div>

                <div className="adherence-grid">
                  {Array.from({ length: 30 }).map((_, index) => (
                    <span key={index} className={`adherence-cell-dot ${[2, 7, 13, 18, 24].includes(index) ? 'missed' : ''}`} />
                  ))}
                </div>

                <div className="readings-legend-row" style={{ marginTop: 10 }}>
                  <span className="readings-legend-item"><span className="legend-dot taken" /> Taken</span>
                  <span className="readings-legend-item"><span className="legend-dot diastolic" style={{ background: '#c2ccda' }} /> Missed</span>
                </div>

                <label style={{ marginTop: 16, display: 'block' }}>
                  <span className="block-label">Note to patient about adherence</span>
                  <textarea
                    placeholder="Write a short, warm note in plain language..."
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button type="button" className="primary small">Send & notify patient</button>
                </div>
              </div>

              <div className="panel hcp-panel">
                <p className="panel-title">Prescription</p>
                {medications.length > 0 ? (
                  medications.slice(0, 2).map((med) => (
                    <div key={med.id} className="prescription-card">
                      <p style={{ margin: 0, fontWeight: 700 }}>{med.name}</p>
                      <p className="text-muted" style={{ margin: '4px 0 0' }}>
                        {[med.dose, med.frequency].filter(Boolean).join(' • ') || '1 tablet, every morning'}
                      </p>
                      <p style={{ margin: '6px 0 0', color: '#ef6b6b', fontWeight: 700, fontSize: '0.82rem' }}>
                        Adherence {med.adherence || '71%'}
                      </p>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="prescription-card">
                      <p style={{ margin: 0, fontWeight: 700 }}>Amlodipine 5mg</p>
                      <p className="text-muted" style={{ margin: '4px 0 0' }}>1 tablet, every morning</p>
                      <p style={{ margin: '6px 0 0', color: '#ef6b6b', fontWeight: 700, fontSize: '0.82rem' }}>Adherence 71%</p>
                    </div>
                    <div className="prescription-card">
                      <p style={{ margin: 0, fontWeight: 700 }}>Hydrochlorothiazide 25mg</p>
                      <p className="text-muted" style={{ margin: '4px 0 0' }}>1 tablet, every morning</p>
                      <p style={{ margin: '6px 0 0', color: '#ef6b6b', fontWeight: 700, fontSize: '0.82rem' }}>Adherence 57%</p>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {activeTab === 'Appointments' && (
            <section className="panel hcp-panel">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <Link href="/appointments" className="primary small">
                  + New Appointment
                </Link>
              </div>

              <p className="block-label" style={{ marginBottom: 8 }}>
                Upcoming
              </p>
              <div className="list-card">
                {upcoming.length > 0 ? (
                  upcoming.map((appt) => (
                    <div key={appt.id} className="appointment-row">
                      <div>
                        <p className="appointment-title">{appt.title || appt.type}</p>
                        <p className="text-muted" style={{ margin: '4px 0 0' }}>
                          {formatAppointmentDate(appt.dateTime)}
                        </p>
                        {appt.note && (
                          <p className="text-muted" style={{ margin: '4px 0 0' }}>
                            {appt.note}
                          </p>
                        )}
                      </div>
                      <button
                        className="text-link"
                        type="button"
                        disabled={cancellingId === appt.id}
                        onClick={() => handleCancelAppointment(appt.id)}
                      >
                        {cancellingId === appt.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    No upcoming appointments
                  </div>
                )}
              </div>

              {past.length > 0 && (
                <>
                  <p className="block-label" style={{ margin: '16px 0 8px' }}>
                    Past
                  </p>
                  {past.map((appt) => (
                    <div key={appt.id} className="appointment-row">
                      <div>
                        <p className="appointment-title">{appt.title || appt.type}</p>
                        <p className="text-muted" style={{ margin: '4px 0 0' }}>
                          {formatAppointmentDate(appt.dateTime)} · {appt.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </section>
          )}

          {activeTab === 'Chat' && (
            <section className="panel hcp-panel patient-chat-box">
              <div className="message-list" style={{ padding: 8, minHeight: '200px' }}>
                <div className="message-bubble message-from">
                  Good morning. I took my tablet but my head is heavy.
                  <div className="message-time">08:14</div>
                </div>
                <div className="message-bubble message-from">
                  I feel dizzy after the new medicine.
                  <div className="message-time">08:15</div>
                </div>
                <div className="message-bubble message-to">
                  Thank you for letting me know. Please sit and drink water. I will call you shortly.
                  <div className="message-time">08:22</div>
                </div>
              </div>

              <div className="chat-suggest-row">
                <span className="filter-pill">Thank you for the reading.</span>
                <span className="filter-pill">Drink water.</span>
                <span className="filter-pill">Come to the clinic tomorrow morning.</span>
              </div>

              <div className="chat-input-row" style={{ marginTop: 0 }}>
                <input
                  type="text"
                  placeholder="Write a short, warm reply..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
                <button className="primary small">
                  ➤
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
