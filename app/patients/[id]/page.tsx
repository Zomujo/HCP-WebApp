"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { hcpPatientApi } from '../../lib/api';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import type { Patient, Appointment, Medication } from '../../lib/api';

const tabs = ['Overview', 'Medication', 'Appointments', 'Chat'] as const;
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
                {patient.age} years • {patient.chronicConditions?.join(', ') || 'N/A'}
              </p>
              <div className="patient-chip-row">
                <span className="badge badge-critical">Status {patient.status || 'Stable'}</span>
                <span className="badge badge-caution">Adherence {patient.adherence || 'N/A'}</span>
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
                    <p className="block-label">Facility</p>
                    <p>{patient.facility || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="panel hcp-panel">
                <p className="panel-title">Latest vitals</p>
                {vitals.length > 0 ? (
                  <div className="latest-vitals-box">
                    <p className="block-label" style={{ color: '#c14d4d' }}>
                      {(patient.status || 'Stable').toUpperCase()}
                    </p>
                    <div className="latest-vitals-meta-grid">
                      {vitals.map((vital) => (
                        <div key={vital.id || vital.vitalType}>
                          <p className="block-label">{vital.vitalName || vital.vitalType}</p>
                          <p>
                            {vital.value}
                            {vital.unit ? ` ${vital.unit}` : ''}
                          </p>
                          {vital.severity && (
                            <p className="text-muted" style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>
                              {vital.severity}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    No vitals recorded
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'Medication' && (
            <section className="panel hcp-panel">
              <p className="panel-title">Medications</p>
              {medications.length > 0 ? (
                medications.map((med) => (
                  <div key={med.id} className="prescription-card">
                    <p style={{ margin: 0, fontWeight: 700 }}>{med.name}</p>
                    <p className="text-muted" style={{ margin: '4px 0 0' }}>
                      {[med.dose, med.frequency].filter(Boolean).join(' • ')}
                    </p>
                    {med.adherence && (
                      <p style={{ margin: '6px 0 0', color: '#ef6b6b', fontWeight: 700, fontSize: '0.82rem' }}>
                        Adherence {med.adherence}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  No medications recorded
                </div>
              )}
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
              <div
                className="message-list"
                style={{
                  padding: 8,
                  minHeight: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                }}
              >
                Chat feature integration in progress
              </div>

              <div className="chat-input-row" style={{ marginTop: 0 }}>
                <input
                  type="text"
                  placeholder="Write a short, warm reply..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled
                />
                <button className="primary small" disabled>
                  Send
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
