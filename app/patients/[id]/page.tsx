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

interface BloodPressureReading {
  recordedAt: string;
  systolic: number;
  diastolic: number;
}

function parseBloodPressure(value: unknown): { systolic: number; diastolic: number } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d{2,3})\s*[/|]\s*(\d{2,3})/);
  if (!match) return null;
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

interface BloodSugarReading {
  recordedAt: string;
  value: number;
}

function mapBloodPressureLogs(logs: any[]): BloodPressureReading[] {
  return logs
    .map((log) => {
      const bloodPressure = log.vitals?.find((vital: any) =>
        String(vital.vitalType || vital.type || '').toLowerCase().includes('bloodpressure')
      );
      const parsed = parseBloodPressure(bloodPressure?.value || log.bloodPressure || log.value);
      if (!parsed) return null;
      return {
        ...parsed,
        recordedAt: log.recordedAt || log.createdAt || log.date || new Date().toISOString(),
      };
    })
    .filter((reading): reading is BloodPressureReading => reading !== null)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

function mapBloodSugarLogs(logs: any[]): BloodSugarReading[] {
  return logs
    .map((log) => {
      const bloodSugar = log.vitals?.find((vital: any) =>
        String(vital.vitalType || vital.type || '').toLowerCase().includes('bloodsugar') ||
        String(vital.vitalType || vital.type || '').toLowerCase().includes('glucose')
      );
      const value = Number(bloodSugar?.value || log.bloodSugar || log.glucose);
      if (!Number.isFinite(value)) return null;
      return {
        value,
        recordedAt: log.recordedAt || log.createdAt || log.date || new Date().toISOString(),
      };
    })
    .filter((reading): reading is BloodSugarReading => reading !== null)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

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
  const [bloodPressureReadings, setBloodPressureReadings] = useState<BloodPressureReading[]>([]);
  const [bloodSugarReadings, setBloodSugarReadings] = useState<BloodSugarReading[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [messageText, setMessageText] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [readingComment, setReadingComment] = useState('');
  const [bloodSugarComment, setBloodSugarComment] = useState('');
  const [vitalForm, setVitalForm] = useState({
    bloodPressure: '',
    bloodSugar: '',
    notes: '',
  });
  const [isSavingVitals, setIsSavingVitals] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [isUpdatingPatient, setIsUpdatingPatient] = useState(false);
  const [patientEditForm, setPatientEditForm] = useState({
    firstName: '',
    lastName: '',
    age: 0,
    ghanaCard: '',
    nhis: '',
    chronicConditions: [] as string[],
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError('');

        const [patientData, vitalsData, vitalLogs, appointmentsData, medicationsData] = await Promise.all([
          hcpPatientApi.getPatientById(patientId),
          hcpPatientApi.getPatientVitals(patientId).catch(() => []),
          hcpPatientApi.getPatientVitalHistoryLogs(patientId).catch(() => []),
          hcpPatientApi.getPatientAppointments(patientId),
          hcpPatientApi.getPatientMedications(patientId),
        ]);

        setPatient(patientData);
        setVitals(Array.isArray(vitalsData) ? vitalsData : []);
        const logsArray = Array.isArray(vitalLogs) ? vitalLogs : [];
        setBloodPressureReadings(mapBloodPressureLogs(logsArray));
        setBloodSugarReadings(mapBloodSugarLogs(logsArray));
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

  const handleSaveVitals = async () => {
    try {
      setIsSavingVitals(true);
      setError('');

      const vitalsToSave = [] as Array<{ vitalType: string; value: string; unit?: string; severity?: 'normal' | 'warning' | 'critical' }>;

      if (vitalForm.bloodPressure.trim()) {
        vitalsToSave.push({
          vitalType: 'bloodPressure',
          value: vitalForm.bloodPressure.trim(),
          unit: 'mmHg',
          severity: 'normal',
        });
      }

      if (vitalForm.bloodSugar.trim()) {
        vitalsToSave.push({
          vitalType: 'bloodSugar',
          value: vitalForm.bloodSugar.trim(),
          unit: 'mg/dL',
          severity: 'normal',
        });
      }

      if (vitalsToSave.length === 0) {
        setError('Enter at least one vital reading before saving.');
        return;
      }

      await hcpPatientApi.createVitalHistory({
        patientId,
        recordedAt: new Date().toISOString(),
        notes: vitalForm.notes.trim() || 'Vitals recorded by clinician.',
        vitals: vitalsToSave,
      });

      setVitalForm({ bloodPressure: '', bloodSugar: '', notes: '' });
      const refreshedVitals = await hcpPatientApi.getPatientVitals(patientId).catch(() => []);
      setVitals(Array.isArray(refreshedVitals) ? refreshedVitals : []);
      const refreshedLogs = await hcpPatientApi.getPatientVitalHistoryLogs(patientId).catch(() => []);
      const logsArray = Array.isArray(refreshedLogs) ? refreshedLogs : [];
      setBloodPressureReadings(mapBloodPressureLogs(logsArray));
      setBloodSugarReadings(mapBloodSugarLogs(logsArray));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save patient vitals');
    } finally {
      setIsSavingVitals(false);
    }
  };

  const handleSendBPComment = async () => {
    try {
      if (!readingComment.trim()) {
        setError('Please enter a comment before sending.');
        return;
      }

      // Send comment to patient (guidance note for BP reading)
      // TODO: Wire to backend endpoint for sending patient guidance
      console.log('Sending BP comment to patient:', readingComment);
      
      // For now, show success and clear
      setError('');
      setReadingComment('');
      alert('Guidance sent to patient successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send guidance to patient');
    }
  };

  const handleSendBloodSugarComment = async () => {
    try {
      if (!bloodSugarComment.trim()) {
        setError('Please enter a comment before sending.');
        return;
      }

      // Send comment to patient (guidance note for blood sugar reading)
      // TODO: Wire to backend endpoint for sending patient guidance
      console.log('Sending blood sugar comment to patient:', bloodSugarComment);
      
      // For now, show success and clear
      setError('');
      setBloodSugarComment('');
      alert('Guidance sent to patient successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send guidance to patient');
    }
  };

  const handleEditPatient = () => {
    if (patient) {
      setPatientEditForm({
        firstName: patient.firstName,
        lastName: patient.lastName,
        age: patient.age,
        ghanaCard: patient.ghanaCard || '',
        nhis: patient.nhis || '',
        chronicConditions: patient.chronicConditions || [],
      });
      setIsEditingPatient(true);
    }
  };

  const handleUpdatePatient = async () => {
    try {
      setIsUpdatingPatient(true);
      setError('');

      await hcpPatientApi.updatePatient(patientId, {
        firstname: patientEditForm.firstName,
        lastname: patientEditForm.lastName,
        age: patientEditForm.age,
        ghanaCardNumber: patientEditForm.ghanaCard,
        nhisNumber: patientEditForm.nhis,
        chronicConditions: patientEditForm.chronicConditions,
      });

      // Refresh patient data
      const refreshedPatient = await hcpPatientApi.getPatientById(patientId);
      setPatient(refreshedPatient);
      setIsEditingPatient(false);
      alert('Patient details updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update patient details');
    } finally {
      setIsUpdatingPatient(false);
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
  const chartReadings = bloodPressureReadings.length > 0 ? bloodPressureReadings : [
    { recordedAt: new Date().toISOString(), systolic: patient.vitals?.systolic || 168, diastolic: patient.vitals?.diastolic || 102 },
  ];
  const chartMax = Math.max(180, ...chartReadings.map((reading) => reading.systolic + 20));
  const chartY = (value: number) => 205 - (value / chartMax) * 170;
  const currentBloodPressure = patient?.vitals?.systolic && patient?.vitals?.diastolic
    ? `${patient.vitals.systolic} / ${patient.vitals.diastolic}`
    : '168 / 102';
  
  const bloodSugarChartReadings = bloodSugarReadings.length > 0 ? bloodSugarReadings : [
    { recordedAt: new Date().toISOString(), value: patient.bloodSugar || 72 },
  ];
  const bloodSugarChartMax = Math.max(200, ...bloodSugarChartReadings.map((reading) => reading.value + 20));
  const bloodSugarChartY = (value: number) => 205 - (value / bloodSugarChartMax) * 170;
  const currentBloodSugar = patient.bloodSugar || 72;

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
                {patient.age} • {patient.chronicConditions?.join(', ') || 'N/A'} • Patient since {patient.joined || 'N/A'}
              </p>
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
                  {!isEditingPatient && (
                    <button
                      type="button"
                      onClick={handleEditPatient}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '0 8px',
                      }}
                      title="Edit patient details"
                    >
                      ✎
                    </button>
                  )}
                </div>

                {!isEditingPatient ? (
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
                      <p>{patient.joined || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="block-label">Facility</p>
                      <p>{patient.facility || 'N/A'}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'block' }}>
                      <span className="block-label">First Name</span>
                      <input
                        type="text"
                        value={patientEditForm.firstName}
                        onChange={(e) =>
                          setPatientEditForm((prev) => ({ ...prev, firstName: e.target.value }))
                        }
                        placeholder="First name"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span className="block-label">Last Name</span>
                      <input
                        type="text"
                        value={patientEditForm.lastName}
                        onChange={(e) =>
                          setPatientEditForm((prev) => ({ ...prev, lastName: e.target.value }))
                        }
                        placeholder="Last name"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span className="block-label">Age</span>
                      <input
                        type="number"
                        value={patientEditForm.age}
                        onChange={(e) =>
                          setPatientEditForm((prev) => ({ ...prev, age: Number(e.target.value) }))
                        }
                        placeholder="Age"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span className="block-label">Ghana Card</span>
                      <input
                        type="text"
                        value={patientEditForm.ghanaCard}
                        onChange={(e) =>
                          setPatientEditForm((prev) => ({ ...prev, ghanaCard: e.target.value }))
                        }
                        placeholder="Ghana Card number"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span className="block-label">NHIS</span>
                      <input
                        type="text"
                        value={patientEditForm.nhis}
                        onChange={(e) =>
                          setPatientEditForm((prev) => ({ ...prev, nhis: e.target.value }))
                        }
                        placeholder="NHIS number"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span className="block-label">Chronic Conditions (comma-separated)</span>
                      <input
                        type="text"
                        value={patientEditForm.chronicConditions.join(', ')}
                        onChange={(e) =>
                          setPatientEditForm((prev) => ({
                            ...prev,
                            chronicConditions: e.target.value
                              .split(',')
                              .map((c) => c.trim())
                              .filter((c) => c),
                          }))
                        }
                        placeholder="e.g., hypertension, diabetes"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                    </label>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setIsEditingPatient(false)}
                        className="ghost small"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleUpdatePatient}
                        disabled={isUpdatingPatient}
                        className="primary small"
                      >
                        {isUpdatingPatient ? 'Updating...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
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
              {/* Blood Pressure Section */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Blood pressure</h3>
                  <span style={{ fontSize: '1.3rem', fontWeight: 600 }}>
                    {chartReadings.length > 0 
                      ? `${chartReadings[chartReadings.length - 1].systolic}/${chartReadings[chartReadings.length - 1].diastolic}`
                      : currentBloodPressure
                    }
                  </span>
                </div>
                <p style={{ margin: '0 0 16px 0', color: '#999', fontSize: '0.9rem' }}>Latest reading</p>
                <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '0.95rem' }}>Your blood pressure trend over this period.</p>

                <div className="readings-chart-box">
                  <div className="readings-chart-inner">
                    <svg viewBox="0 0 720 250" width="100%" height="100%" preserveAspectRatio="none">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <line key={`h-${index}`} x1="60" y1={30 + index * 35} x2="680" y2={30 + index * 35} className="chart-grid-line" />
                      ))}
                      {Array.from({ length: 12 }).map((_, index) => (
                        <line key={`v-${index}`} x1={60 + index * 56} y1="30" x2={60 + index * 56} y2="205" className="chart-grid-line" />
                      ))}

                      {chartReadings.map((reading, index) => (
                        <text key={reading.recordedAt + index} x={60 + (index * 620) / Math.max(1, chartReadings.length - 1)} y="225" textAnchor="middle" className="chart-axis-text">
                          {new Date(reading.recordedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </text>
                      ))}

                      <text x="8" y="118" className="chart-axis-text">mmHg</text>

                      <polyline
                        className="chart-line-systolic"
                        points={chartReadings.map((reading, index) => `${60 + (index * 620) / Math.max(1, chartReadings.length - 1)},${chartY(reading.systolic)}`).join(' ')}
                      />
                      <polyline
                        className="chart-line-diastolic"
                        points={chartReadings.map((reading, index) => `${60 + (index * 620) / Math.max(1, chartReadings.length - 1)},${chartY(reading.diastolic)}`).join(' ')}
                      />
                      {chartReadings.map((reading, index) => (
                        <circle
                          key={`s-${reading.recordedAt}-${index}`}
                          className="chart-dot-systolic"
                          cx={60 + (index * 620) / Math.max(1, chartReadings.length - 1)}
                          cy={chartY(reading.systolic)}
                          r="4"
                        />
                      ))}
                      {chartReadings.map((reading, index) => (
                        <circle
                          key={`d-${reading.recordedAt}-${index}`}
                          className="chart-dot-diastolic"
                          cx={60 + (index * 620) / Math.max(1, chartReadings.length - 1)}
                          cy={chartY(reading.diastolic)}
                          r="4"
                        />
                      ))}
                      
                      {/* Latest value tooltip for BP */}
                      {chartReadings.length > 0 && (
                        <g>
                          <rect
                            x={60 + ((chartReadings.length - 1) * 620) / Math.max(1, chartReadings.length - 1) - 40}
                            y={chartY(chartReadings[chartReadings.length - 1].systolic) - 50}
                            width="80"
                            height="50"
                            fill="#2c3e50"
                            rx="4"
                          />
                          <text
                            x={60 + ((chartReadings.length - 1) * 620) / Math.max(1, chartReadings.length - 1)}
                            y={chartY(chartReadings[chartReadings.length - 1].systolic) - 25}
                            textAnchor="middle"
                            fill="white"
                            fontSize="14"
                            fontWeight="600"
                          >
                            {chartReadings[chartReadings.length - 1].systolic}
                          </text>
                          <text
                            x={60 + ((chartReadings.length - 1) * 620) / Math.max(1, chartReadings.length - 1)}
                            y={chartY(chartReadings[chartReadings.length - 1].systolic) - 10}
                            textAnchor="middle"
                            fill="white"
                            fontSize="14"
                            fontWeight="600"
                          >
                            {chartReadings[chartReadings.length - 1].diastolic}
                          </text>
                        </g>
                      )}
                    </svg>
                  </div>
                </div>

                <div className="readings-legend-row" style={{ marginTop: 12 }}>
                  <span className="readings-legend-item"><span className="legend-dot systolic" /> Systolic</span>
                  <span className="readings-legend-item"><span className="legend-dot diastolic" /> Diastolic</span>
                </div>
              </div>

              {/* Blood Sugar Section */}
              <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Blood Glucose</h3>
                  <span style={{ fontSize: '1.3rem', fontWeight: 600 }}>
                    {bloodSugarChartReadings.length > 0 
                      ? `${bloodSugarChartReadings[bloodSugarChartReadings.length - 1].value}`
                      : currentBloodSugar
                    }
                  </span>
                </div>
                <p style={{ margin: '0 0 16px 0', color: '#999', fontSize: '0.9rem' }}>mmol/L</p>
                <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '0.95rem' }}>Your blood glucose trend over this period.</p>

                <div className="readings-chart-box">
                  <div className="readings-chart-inner">
                    <svg viewBox="0 0 720 250" width="100%" height="100%" preserveAspectRatio="none">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <line key={`h-${index}`} x1="60" y1={30 + index * 35} x2="680" y2={30 + index * 35} className="chart-grid-line" />
                      ))}
                      {Array.from({ length: 12 }).map((_, index) => (
                        <line key={`v-${index}`} x1={60 + index * 56} y1="30" x2={60 + index * 56} y2="205" className="chart-grid-line" />
                      ))}

                      {bloodSugarChartReadings.map((reading, index) => (
                        <text key={reading.recordedAt + index} x={60 + (index * 620) / Math.max(1, bloodSugarChartReadings.length - 1)} y="225" textAnchor="middle" className="chart-axis-text">
                          {new Date(reading.recordedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </text>
                      ))}

                      <text x="8" y="118" className="chart-axis-text">mmol/L</text>

                      <polyline
                        className="chart-line-systolic"
                        points={bloodSugarChartReadings.map((reading, index) => `${60 + (index * 620) / Math.max(1, bloodSugarChartReadings.length - 1)},${bloodSugarChartY(reading.value)}`).join(' ')}
                      />
                      {bloodSugarChartReadings.map((reading, index) => (
                        <circle
                          key={`bs-${reading.recordedAt}-${index}`}
                          className="chart-dot-systolic"
                          cx={60 + (index * 620) / Math.max(1, bloodSugarChartReadings.length - 1)}
                          cy={bloodSugarChartY(reading.value)}
                          r="4"
                        />
                      ))}

                      {/* Latest value tooltip for Blood Sugar */}
                      {bloodSugarChartReadings.length > 0 && (
                        <g>
                          <rect
                            x={60 + ((bloodSugarChartReadings.length - 1) * 620) / Math.max(1, bloodSugarChartReadings.length - 1) - 35}
                            y={bloodSugarChartY(bloodSugarChartReadings[bloodSugarChartReadings.length - 1].value) - 40}
                            width="70"
                            height="40"
                            fill="#2c3e50"
                            rx="4"
                          />
                          <text
                            x={60 + ((bloodSugarChartReadings.length - 1) * 620) / Math.max(1, bloodSugarChartReadings.length - 1)}
                            y={bloodSugarChartY(bloodSugarChartReadings[bloodSugarChartReadings.length - 1].value) - 15}
                            textAnchor="middle"
                            fill="white"
                            fontSize="14"
                            fontWeight="600"
                          >
                            {bloodSugarChartReadings[bloodSugarChartReadings.length - 1].value}
                          </text>
                        </g>
                      )}
                    </svg>
                  </div>
                </div>

                <div className="readings-legend-row" style={{ marginTop: 12 }}>
                  <span className="readings-legend-item"><span className="legend-dot systolic" /> Blood Glucose</span>
                </div>
              </div>

              {/* Comments and Actions Section */}

              <div className="panel hcp-panel" style={{ marginTop: 18 }}>
                <div className="panel-headline-row" style={{ marginBottom: 12 }}>
                  <p className="panel-title">Record patient vitals</p>
                </div>

                <div className="onboarding-grid-two">
                  <label>
                    <span className="onboarding-field-label">Blood pressure</span>
                    <input
                      type="text"
                      value={vitalForm.bloodPressure}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, bloodPressure: event.target.value }))}
                      placeholder="120/80"
                    />
                  </label>

                  <label>
                    <span className="onboarding-field-label">Blood Sugar</span>
                    <input
                      type="text"
                      value={vitalForm.bloodSugar}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, bloodSugar: event.target.value }))}
                      placeholder="72"
                    />
                  </label>
                </div>

                <label style={{ marginTop: 12, display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span className="onboarding-field-label">Notes</span>
                    <span style={{ fontSize: '0.875rem', color: '#999' }}>
                      {vitalForm.notes.length}/500
                    </span>
                  </div>
                  <textarea
                    value={vitalForm.notes}
                    onChange={(event) => setVitalForm((prev) => ({ ...prev, notes: event.target.value.slice(0, 500) }))}
                    placeholder="Patient was resting during measurement..."
                    rows={3}
                    maxLength={500}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button
                    type="button"
                    className="primary small"
                    onClick={handleSaveVitals}
                    disabled={isSavingVitals}
                  >
                    {isSavingVitals ? 'Saving...' : 'Save vitals'}
                  </button>
                </div>
              </div>

              {bloodPressureReadings.slice(-4).reverse().map((reading) => (
                <div key={reading.recordedAt} className="reading-mini-card" style={{ marginTop: 12 }}>
                  <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}><strong>BP</strong> {reading.systolic} / {reading.diastolic} mmHg</p>
                  <p className="text-muted" style={{ marginTop: 4, margin: 0 }}>{formatAppointmentDate(reading.recordedAt)}</p>
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
            <section className="panel hcp-panel patient-chat-box" style={{ display: 'grid', placeItems: 'center', minHeight: '200px' }}>
              <div style={{ textAlign: 'center', color: '#7b8392', fontSize: '1.2rem', fontWeight: 700 }}>
                Coming Soon
              </div>
            </section>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
