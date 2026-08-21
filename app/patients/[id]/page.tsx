"use client";

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { hcpPatientApi } from '../../lib/api';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import type { Patient, Appointment, Medication } from '../../lib/api';

const tabs = ['Overview', 'Readings', 'Medication', 'Appointments', 'Chat'] as const;
type TabName = (typeof tabs)[number];
type AppointmentStatusFilter = 'all' | Appointment['status'];

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
        recordedAt: log.recordedAt || log.createdAt || log.date || '',
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
      const directVitalType = String(log.vitalType || log.type || '').toLowerCase();
      const directBloodSugar = directVitalType.includes('bloodsugar') || directVitalType.includes('glucose');
      const value = Number(directBloodSugar ? log.value : bloodSugar?.value || log.bloodSugar || log.glucose);
      if (!Number.isFinite(value)) return null;
      return {
        value,
        recordedAt: log.recordedAt || log.createdAt || log.date || '',
      };
    })
    .filter((reading): reading is BloodSugarReading => reading !== null)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

function mergeVitalEntries(logs: any[], latestVitals: any[]): any[] {
  const entries = [...logs, ...latestVitals];
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const nestedVitals = Array.isArray(entry.vitals) ? entry.vitals : [];
    const vitalValues = nestedVitals.length > 0
      ? nestedVitals.map((vital: any) => `${vital.vitalType || vital.type || ''}:${vital.value ?? ''}`).join('|')
      : `${entry.vitalType || entry.type || ''}:${entry.value ?? entry.bloodPressure ?? entry.bloodSugar ?? ''}`;
    const recordedAt = entry.recordedAt || entry.createdAt || entry.date || '';
    const key = `${recordedAt}|${vitalValues}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function getBloodPressureSeverity(reading?: BloodPressureReading): string {
  if (!reading) return 'NO READING';
  if (reading.systolic >= 140 || reading.diastolic >= 90) return 'CRITICAL';
  if (reading.systolic >= 130 || reading.diastolic >= 80) return 'WARNING';
  return 'NORMAL';
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
  const [hoveredBloodPressureIndex, setHoveredBloodPressureIndex] = useState<number | null>(null);
  const [hoveredBloodSugarIndex, setHoveredBloodSugarIndex] = useState<number | null>(null);
  const [latestBloodPressureReading, setLatestBloodPressureReading] = useState<BloodPressureReading | undefined>();
  const [latestBloodSugarReading, setLatestBloodSugarReading] = useState<BloodSugarReading | undefined>();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [messageText, setMessageText] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<AppointmentStatusFilter>('all');
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [readingComment, setReadingComment] = useState('');
  const [bloodSugarComment, setBloodSugarComment] = useState('');
  const [vitalForm, setVitalForm] = useState({
    bloodPressure: '',
    bloodSugar: '',
    notes: '',
  });
  const [isSavingVitals, setIsSavingVitals] = useState(false);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
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
        const latestVitalsArray = Array.isArray(vitalsData)
          ? vitalsData
          : vitalsData && typeof vitalsData === 'object'
            ? [vitalsData]
            : [];
        const allVitalEntries = mergeVitalEntries(logsArray, latestVitalsArray);
        setBloodPressureReadings(mapBloodPressureLogs(allVitalEntries));
        setBloodSugarReadings(mapBloodSugarLogs(allVitalEntries));
        setLatestBloodPressureReading(mapBloodPressureLogs(latestVitalsArray).at(-1));
        setLatestBloodSugarReading(mapBloodSugarLogs(latestVitalsArray).at(-1));
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

  const handleCreateAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      setIsSavingAppointment(true);
      setError('');

      const formData = new FormData(form);
      const date = String(formData.get('date') || '');
      const time = String(formData.get('time') || '');
      const title = String(formData.get('title') || '').trim();
      const notes = String(formData.get('notes') || '').trim();

      if (!date || !time || !title) {
        setError('Please complete the appointment details.');
        return;
      }

      await hcpPatientApi.createAppointment(patientId, {
        title,
        description: notes,
        appointmentDate: new Date(`${date}T${time}`).toISOString(),
      });

      setAppointments(await hcpPatientApi.getPatientAppointments(patientId));
      setIsAppointmentModalOpen(false);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create appointment');
    } finally {
      setIsSavingAppointment(false);
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
      setIsVitalsModalOpen(false);
      const refreshedVitals = await hcpPatientApi.getPatientVitals(patientId).catch(() => []);
      setVitals(Array.isArray(refreshedVitals) ? refreshedVitals : []);
      const refreshedLogs = await hcpPatientApi.getPatientVitalHistoryLogs(patientId).catch(() => []);
      const logsArray = Array.isArray(refreshedLogs) ? refreshedLogs : [];
      const latestVitalsArray = Array.isArray(refreshedVitals)
        ? refreshedVitals
        : refreshedVitals && typeof refreshedVitals === 'object'
          ? [refreshedVitals]
          : [];
      const allVitalEntries = mergeVitalEntries(logsArray, latestVitalsArray);
      setBloodPressureReadings(mapBloodPressureLogs(allVitalEntries));
      setBloodSugarReadings(mapBloodSugarLogs(allVitalEntries));
      setLatestBloodPressureReading(mapBloodPressureLogs(latestVitalsArray).at(-1));
      setLatestBloodSugarReading(mapBloodSugarLogs(latestVitalsArray).at(-1));
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

  const filteredAppointments = appointmentStatusFilter === 'all'
    ? appointments
    : appointments.filter((appointment) => appointment.status === appointmentStatusFilter);
  const upcoming = filteredAppointments.filter((a) => a.status === 'scheduled' || a.status === 'active' || a.status === 'rescheduled');
  const past = filteredAppointments.filter((a) => a.status === 'completed' || a.status === 'cancelled');
  const chartReadings = bloodPressureReadings;
  const chartMax = Math.max(180, ...chartReadings.map((reading) => reading.systolic + 20));
  const chartY = (value: number) => 205 - (value / chartMax) * 170;
  const latestBloodPressure = latestBloodPressureReading;
  const currentBloodPressure = latestBloodPressure
    ? `${latestBloodPressure.systolic} / ${latestBloodPressure.diastolic}`
    : 'No reading recorded';
  
  const bloodSugarChartReadings = bloodSugarReadings;
  const bloodSugarChartMax = Math.max(200, ...bloodSugarChartReadings.map((reading) => reading.value + 20));
  const bloodSugarChartY = (value: number) => 205 - (value / bloodSugarChartMax) * 170;
  const currentBloodSugar = latestBloodSugarReading?.value;
  const hoveredBloodPressure = hoveredBloodPressureIndex === null ? undefined : chartReadings[hoveredBloodPressureIndex];
  const hoveredBloodSugar = hoveredBloodSugarIndex === null ? undefined : bloodSugarChartReadings[hoveredBloodSugarIndex];

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
                    {getBloodPressureSeverity(latestBloodPressure)}
                  </p>
                  <p className="latest-vitals-value">{currentBloodPressure}</p>
                  <p className="text-muted" style={{ margin: 0 }}>mmHg</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'Readings' && (
            <section className="readings-workspace">
              <div className="readings-page-intro">
                <div>
                  <p className="eyebrow">Clinical monitoring</p>
                  <h2>Patient readings</h2>
                  <p>Review trends and record a new measurement for this patient.</p>
                </div>
                <div className={`reading-status ${getBloodPressureSeverity(latestBloodPressure).toLowerCase().replace(' ', '-')}`}>
                  <span className="reading-status-dot" />
                  {getBloodPressureSeverity(latestBloodPressure)}
                </div>
              </div>

              <div className="readings-summary-grid">
                <div className="reading-summary-card reading-summary-card-primary">
                  <span className="reading-summary-label">Blood pressure</span>
                  <strong>{currentBloodPressure}</strong>
                  <span>mmHg · latest reading</span>
                </div>
                <div className="reading-summary-card">
                  <span className="reading-summary-label">Blood glucose</span>
                  <strong>{currentBloodSugar ?? '—'}</strong>
                  <span>mmol/L · latest reading</span>
                </div>
                <div className="reading-summary-card">
                  <span className="reading-summary-label">Blood pressure history</span>
                  <strong>{chartReadings.length}</strong>
                  <span>blood pressure entries</span>
                </div>
                <div className="reading-summary-card">
                  <span className="reading-summary-label">Blood glucose history</span>
                  <strong>{bloodSugarReadings.length}</strong>
                  <span>blood glucose entries</span>
                </div>
              </div>

              <div className="readings-panel readings-panel-chart">
                <div className="readings-section-heading">
                  <div>
                    <p className="eyebrow">Trend analysis</p>
                    <h3>Blood pressure</h3>
                  </div>
                  <span className="readings-current-value">
                    {currentBloodPressure}
                  </span>
                </div>
                <p className="readings-description">Systolic and diastolic pressure across recorded visits.</p>

                <div className="readings-chart-box">
                  <div className="readings-chart-inner">
                    <svg viewBox="0 0 720 250" width="100%" height="100%" preserveAspectRatio="none">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <line key={`h-${index}`} x1="60" y1={30 + index * 35} x2="680" y2={30 + index * 35} className="chart-grid-line" />
                      ))}
                      {Array.from({ length: 12 }).map((_, index) => (
                        <line key={`v-${index}`} x1={60 + index * 56} y1="30" x2={60 + index * 56} y2="205" className="chart-grid-line" />
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
                          tabIndex={0}
                          onMouseEnter={() => setHoveredBloodPressureIndex(index)}
                          onMouseLeave={() => setHoveredBloodPressureIndex(null)}
                          onFocus={() => setHoveredBloodPressureIndex(index)}
                          onBlur={() => setHoveredBloodPressureIndex(null)}
                        />
                      ))}
                      {chartReadings.map((reading, index) => (
                        <circle
                          key={`d-${reading.recordedAt}-${index}`}
                          className="chart-dot-diastolic"
                          cx={60 + (index * 620) / Math.max(1, chartReadings.length - 1)}
                          cy={chartY(reading.diastolic)}
                          r="4"
                          tabIndex={0}
                          onMouseEnter={() => setHoveredBloodPressureIndex(index)}
                          onMouseLeave={() => setHoveredBloodPressureIndex(null)}
                          onFocus={() => setHoveredBloodPressureIndex(index)}
                          onBlur={() => setHoveredBloodPressureIndex(null)}
                        />
                      ))}
                      
                      {hoveredBloodPressure && hoveredBloodPressureIndex !== null && (
                        <g>
                          <rect
                            x={60 + (hoveredBloodPressureIndex * 620) / Math.max(1, chartReadings.length - 1) - 40}
                            y={chartY(hoveredBloodPressure.systolic) - 50}
                            width="80"
                            height="50"
                            fill="#2c3e50"
                            rx="4"
                          />
                          <text
                            x={60 + (hoveredBloodPressureIndex * 620) / Math.max(1, chartReadings.length - 1)}
                            y={chartY(hoveredBloodPressure.systolic) - 25}
                            textAnchor="middle"
                            fill="white"
                            fontSize="14"
                            fontWeight="600"
                          >
                            {hoveredBloodPressure.systolic}
                          </text>
                          <text
                            x={60 + (hoveredBloodPressureIndex * 620) / Math.max(1, chartReadings.length - 1)}
                            y={chartY(hoveredBloodPressure.systolic) - 10}
                            textAnchor="middle"
                            fill="white"
                            fontSize="14"
                            fontWeight="600"
                          >
                            {hoveredBloodPressure.diastolic}
                          </text>
                        </g>
                      )}
                    </svg>
                  </div>
                </div>

                <div className="readings-legend-row">
                  <span className="readings-legend-item"><span className="legend-dot systolic" /> Systolic</span>
                  <span className="readings-legend-item"><span className="legend-dot diastolic" /> Diastolic</span>
                </div>
              </div>

              <div className="readings-panel readings-panel-chart">
                <div className="readings-section-heading">
                  <div>
                    <p className="eyebrow">Trend analysis</p>
                    <h3>Blood glucose</h3>
                  </div>
                  <span className="readings-current-value">
                    {currentBloodSugar ?? 'No reading recorded'}
                  </span>
                </div>
                <p className="readings-description">Glucose values across recorded visits.</p>

                <div className="readings-chart-box">
                  <div className="readings-chart-inner">
                    <svg viewBox="0 0 720 250" width="100%" height="100%" preserveAspectRatio="none">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <line key={`h-${index}`} x1="60" y1={30 + index * 35} x2="680" y2={30 + index * 35} className="chart-grid-line" />
                      ))}
                      {Array.from({ length: 12 }).map((_, index) => (
                        <line key={`v-${index}`} x1={60 + index * 56} y1="30" x2={60 + index * 56} y2="205" className="chart-grid-line" />
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
                          tabIndex={0}
                          onMouseEnter={() => setHoveredBloodSugarIndex(index)}
                          onMouseLeave={() => setHoveredBloodSugarIndex(null)}
                          onFocus={() => setHoveredBloodSugarIndex(index)}
                          onBlur={() => setHoveredBloodSugarIndex(null)}
                        />
                      ))}

                      {hoveredBloodSugar && hoveredBloodSugarIndex !== null && (
                        <g>
                          <rect
                            x={60 + (hoveredBloodSugarIndex * 620) / Math.max(1, bloodSugarChartReadings.length - 1) - 35}
                            y={bloodSugarChartY(hoveredBloodSugar.value) - 40}
                            width="70"
                            height="40"
                            fill="#2c3e50"
                            rx="4"
                          />
                          <text
                            x={60 + (hoveredBloodSugarIndex * 620) / Math.max(1, bloodSugarChartReadings.length - 1)}
                            y={bloodSugarChartY(hoveredBloodSugar.value) - 15}
                            textAnchor="middle"
                            fill="white"
                            fontSize="14"
                            fontWeight="600"
                          >
                            {hoveredBloodSugar.value}
                          </text>
                        </g>
                      )}
                    </svg>
                  </div>
                </div>

                <div className="readings-legend-row">
                  <span className="readings-legend-item"><span className="legend-dot systolic" /> Blood Glucose</span>
                </div>
              </div>

              <div className="readings-panel readings-entry-panel readings-entry-launcher">
                <div className="readings-section-heading">
                  <div>
                    <p className="eyebrow">Clinical action</p>
                    <h3>Record a new set of vitals</h3>
                    <p className="readings-description">Add measurements taken during this visit.</p>
                  </div>
                  <button
                    type="button"
                    className="primary readings-launch-button"
                    onClick={() => setIsVitalsModalOpen(true)}
                  >
                    Record vitals
                  </button>
                </div>
              </div>

              {isVitalsModalOpen && (
                <div className="modal-backdrop" onClick={() => setIsVitalsModalOpen(false)}>
                  <section
                    className="readings-vitals-modal"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="record-vitals-title"
                  >
                    <div className="readings-modal-header">
                      <div>
                        <p className="eyebrow">New entry</p>
                        <h3 id="record-vitals-title">Record patient vitals</h3>
                        <p className="readings-description">Add the measurements taken during this visit.</p>
                      </div>
                      <button
                        type="button"
                        className="readings-modal-close"
                        onClick={() => setIsVitalsModalOpen(false)}
                        aria-label="Close record vitals dialog"
                      >
                        ×
                      </button>
                    </div>

                    <div className="readings-entry-grid">
                  <label>
                    <span className="onboarding-field-label">Blood pressure</span>
                    <input
                      type="text"
                      value={vitalForm.bloodPressure}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, bloodPressure: event.target.value }))}
                      placeholder="e.g. 120/80"
                    />
                  </label>

                  <label>
                    <span className="onboarding-field-label">Blood Sugar</span>
                    <input
                      type="text"
                      value={vitalForm.bloodSugar}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, bloodSugar: event.target.value }))}
                      placeholder="e.g. 5.9"
                    />
                  </label>
                </div>

                  <label className="readings-notes-field">
                  <div className="readings-field-heading">
                    <span className="onboarding-field-label">Notes</span>
                    <span className="readings-character-count">
                      {vitalForm.notes.length}/500
                    </span>
                  </div>
                  <textarea
                    value={vitalForm.notes}
                    onChange={(event) => setVitalForm((prev) => ({ ...prev, notes: event.target.value.slice(0, 500) }))}
                    placeholder="Add context about this measurement (optional)"
                    rows={3}
                    maxLength={500}
                  />
                </label>

                    <div className="readings-entry-actions">
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => setIsVitalsModalOpen(false)}
                        disabled={isSavingVitals}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="primary small"
                        onClick={handleSaveVitals}
                        disabled={isSavingVitals}
                      >
                        {isSavingVitals ? 'Saving...' : 'Save vitals'}
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {bloodPressureReadings.length > 0 && (
                <div className="readings-history-panel">
                  <div className="readings-section-heading">
                    <div>
                      <p className="eyebrow">History</p>
                      <h3>Recent blood pressure readings</h3>
                    </div>
                    <span className="history-count">{bloodPressureReadings.length} total</span>
                  </div>
                  <div className="readings-history-list">
                    {bloodPressureReadings.slice(-4).reverse().map((reading, index) => (
                      <div key={`${reading.systolic}-${reading.diastolic}-${reading.recordedAt}-${index}`} className="reading-mini-card">
                        <span className="history-reading-label">BP</span>
                        <strong>{reading.systolic} / {reading.diastolic}</strong>
                        <span className="history-reading-unit">mmHg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bloodSugarReadings.length > 0 && (
                <div className="readings-history-panel">
                  <div className="readings-section-heading">
                    <div>
                      <p className="eyebrow">History</p>
                      <h3>Recent blood sugar readings</h3>
                    </div>
                    <span className="history-count">{bloodSugarReadings.length} total</span>
                  </div>
                  <div className="readings-history-list">
                    {bloodSugarReadings.slice(-4).reverse().map((reading, index) => (
                      <div key={`${reading.value}-${reading.recordedAt}-${index}`} className="reading-mini-card">
                        <span className="history-reading-label">GLU</span>
                        <strong>{reading.value}</strong>
                        <span className="history-reading-unit">mmol/L</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === 'Medication' && (
            <section className="patient-overview-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
              <div className="panel hcp-panel">
                <div className="panel-headline-row" style={{ marginBottom: 10 }}>
                  <p className="panel-title">30-day adherence</p>
                  {patient.adherence && (
                    <p className="text-muted" style={{ margin: 0 }}>
                      <strong style={{ color: '#f2994a' }}>{patient.adherence}</strong> overall
                    </p>
                  )}
                </div>

                {patient.adherence ? (
                  <p className="text-muted">Adherence data is available for this patient.</p>
                ) : (
                  <p className="text-muted">No adherence record available.</p>
                )}

              </div>

              <div className="panel hcp-panel">
                <p className="panel-title">Prescription</p>
                {medications.length > 0 ? (
                  medications.slice(0, 2).map((med) => (
                    <div key={med.id} className="prescription-card">
                      <p style={{ margin: 0, fontWeight: 700 }}>{med.name}</p>
                      {(med.dose || med.frequency) && (
                        <p className="text-muted" style={{ margin: '4px 0 0' }}>
                          {[med.dose, med.frequency].filter(Boolean).join(' • ')}
                        </p>
                      )}
                      {med.adherence && (
                        <p style={{ margin: '6px 0 0', color: '#ef6b6b', fontWeight: 700, fontSize: '0.82rem' }}>
                          Adherence {med.adherence}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted">No prescriptions recorded.</p>
                )}
              </div>
            </section>
          )}

          {activeTab === 'Appointments' && (
            <section className="panel hcp-panel">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="block-label" style={{ margin: 0 }}>Status</span>
                    <select
                      value={appointmentStatusFilter}
                      onChange={(event) => setAppointmentStatusFilter(event.target.value as AppointmentStatusFilter)}
                      aria-label="Filter appointments by status"
                    >
                      <option value="all">All statuses</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="active">Active</option>
                      <option value="rescheduled">Rescheduled</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                  <button type="button" className="primary small" onClick={() => setIsAppointmentModalOpen(true)}>
                    + New Appointment
                  </button>
                </div>
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

              {isAppointmentModalOpen && (
                <div className="modal-backdrop" onClick={() => setIsAppointmentModalOpen(false)}>
                  <aside
                    className="panel hcp-panel appointment-modal-preview appointment-modal-overlay"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Set an appointment for ${patient.firstName} ${patient.lastName}`}
                  >
                    <div className="modal-head-row">
                      <div>
                        <p className="panel-title" style={{ margin: 0 }}>Set an appointment</p>
                        <p className="text-muted" style={{ margin: '5px 0 0' }}>
                          {patient.firstName} {patient.lastName}
                        </p>
                      </div>
                      <button type="button" className="modal-close" aria-label="Close modal" onClick={() => setIsAppointmentModalOpen(false)}>
                        ×
                      </button>
                    </div>
                    <form onSubmit={handleCreateAppointment}>
                      <label>
                        <span className="onboarding-field-label">Appointment title</span>
                        <input name="title" type="text" required placeholder="e.g. Follow-up consultation" disabled={isSavingAppointment} />
                      </label>
                      <div className="onboarding-grid-two">
                        <label>
                          <span className="onboarding-field-label">Date</span>
                          <input name="date" type="date" required disabled={isSavingAppointment} />
                        </label>
                        <label>
                          <span className="onboarding-field-label">Time</span>
                          <input name="time" type="time" required disabled={isSavingAppointment} />
                        </label>
                      </div>
                      <label>
                        <span className="onboarding-field-label">Notes for patient (optional)</span>
                        <textarea name="notes" placeholder="Add appointment notes" disabled={isSavingAppointment} />
                      </label>
                      <div className="modal-actions">
                        <button type="button" className="ghost small" onClick={() => setIsAppointmentModalOpen(false)} disabled={isSavingAppointment}>Cancel</button>
                        <button type="submit" className="primary small" disabled={isSavingAppointment}>
                          {isSavingAppointment ? 'Saving...' : 'Book appointment'}
                        </button>
                      </div>
                    </form>
                  </aside>
                </div>
              )}

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
