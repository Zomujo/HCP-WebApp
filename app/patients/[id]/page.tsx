"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Sidebar } from '../../components/Sidebar';
import { patientDetail } from '../../lib/dummy';
import { addVital, getPatientById, getVitalsForPatient, PatientRecord, updatePatientDetails, VitalEntry } from '../../lib/patientStore';
import { ProtectedRoute } from '../../components/ProtectedRoute';

const tabs = ['Overview', 'Readings', 'Medication', 'Appointments', 'Chat'] as const;
type TabName = (typeof tabs)[number];

const CHART_WIDTH = 760;
const CHART_HEIGHT = 220;
const CHART_PADDING = { top: 18, right: 24, bottom: 32, left: 42 };

function formatVitalTime(value?: string): string {
  if (!value || typeof value !== 'string') {
    return 'Unknown time';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatVitalDateLabel(value?: string): string {
  const formatted = formatVitalTime(value);
  return formatted.includes(',') ? formatted.split(',')[0] : formatted;
}

const fallbackPatient: PatientRecord = {
  id: 'akua-mensah',
  name: patientDetail.name,
  initials: patientDetail.initials,
  age: patientDetail.age,
  condition: patientDetail.condition,
  ghanaCard: patientDetail.ghanaCard,
  nhis: patientDetail.nhis,
  facility: patientDetail.facility,
  joined: patientDetail.joined,
  status: 'Critical',
  adherence: patientDetail.adherence,
  lastCheckIn: 'Today',
};

export default function PatientDetailsPage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [patient, setPatient] = useState<PatientRecord>(fallbackPatient);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editName, setEditName] = useState(fallbackPatient.name);
  const [editAge, setEditAge] = useState(String(fallbackPatient.age));
  const [editCondition, setEditCondition] = useState(fallbackPatient.condition);
  const [editGhanaCard, setEditGhanaCard] = useState(fallbackPatient.ghanaCard || '');
  const [editNhis, setEditNhis] = useState(fallbackPatient.nhis || '');
  const [editFacility, setEditFacility] = useState(fallbackPatient.facility || '');
  const [vitals, setVitals] = useState<VitalEntry[]>([]);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!patientId) {
      setPatient(fallbackPatient);
      return;
    }

    const loadedPatient = getPatientById(patientId);
    setPatient(loadedPatient || fallbackPatient);
  }, [patientId, vitals.length]);

  useEffect(() => {
    setEditName(patient.name);
    setEditAge(String(patient.age));
    setEditCondition(patient.condition);
    setEditGhanaCard(patient.ghanaCard || '');
    setEditNhis(patient.nhis || '');
    setEditFacility(patient.facility || '');
  }, [patient]);

  useEffect(() => {
    if (!patientId) {
      return;
    }

    setVitals(getVitalsForPatient(patientId));
  }, [patientId]);

  const readingRows = useMemo(() => {
    if (vitals.length) {
      return vitals;
    }

    return patientDetail.readings.map((reading, index) => {
      const parts = reading.value.split('/').map((value) => Number(value.trim()));
      return {
        id: `fallback-${index}`,
        patientId: patient.id,
        systolic: parts[0],
        diastolic: parts[1],
        pulse: undefined,
        temperature: undefined,
        weightKg: undefined,
        note: reading.note,
        takenAt: reading.time,
      };
    });
  }, [patient.id, vitals]);

  const latestVital = readingRows[0] || {
    id: 'fallback-latest',
    patientId: patient.id,
    systolic: patientDetail.vitals.systolic,
    diastolic: patientDetail.vitals.diastolic,
    pulse: undefined,
    temperature: undefined,
    weightKg: undefined,
    note: patientDetail.vitals.note,
    takenAt: new Date().toISOString(),
  };

  const chartRows = [...readingRows].reverse().slice(-10);
  const chartSeriesValues = chartRows.flatMap((row) => [row.systolic, row.diastolic]);
  const measuredMin = chartSeriesValues.length ? Math.min(...chartSeriesValues) : 60;
  const measuredMax = chartSeriesValues.length ? Math.max(...chartSeriesValues) : 180;
  const chartMin = Math.max(40, Math.floor((measuredMin - 20) / 10) * 10);
  const chartMax = Math.max(chartMin + 40, Math.ceil((measuredMax + 20) / 10) * 10);
  const chartInnerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const chartInnerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const getY = (value: number) => {
    const ratio = (value - chartMin) / (chartMax - chartMin);
    return CHART_HEIGHT - CHART_PADDING.bottom - ratio * chartInnerHeight;
  };

  const getX = (index: number) => {
    if (chartRows.length <= 1) {
      return CHART_PADDING.left + chartInnerWidth / 2;
    }
    const step = chartInnerWidth / (chartRows.length - 1);
    return CHART_PADDING.left + index * step;
  };

  const systolicPoints = chartRows.map((row, index) => `${getX(index)},${getY(row.systolic)}`).join(' ');
  const diastolicPoints = chartRows.map((row, index) => `${getX(index)},${getY(row.diastolic)}`).join(' ');

  const handleSaveVitals = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!patientId) {
      return;
    }

    const parsedSystolic = Number(systolic);
    const parsedDiastolic = Number(diastolic);

    if (Number.isNaN(parsedSystolic) || Number.isNaN(parsedDiastolic)) {
      alert('Please enter valid systolic and diastolic values.');
      return;
    }

    addVital(patientId, {
      systolic: parsedSystolic,
      diastolic: parsedDiastolic,
      pulse: pulse ? Number(pulse) : undefined,
      temperature: temperature ? Number(temperature) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      note,
    });

    setVitals(getVitalsForPatient(patientId));
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setTemperature('');
    setWeightKg('');
    setNote('');
  };

  const latestVitalsLabel = `${latestVital.systolic} / ${latestVital.diastolic}`;
  const latestPulseLabel = latestVital.pulse ? `${latestVital.pulse} bpm` : '--';
  const latestTemperatureLabel = latestVital.temperature ? `${latestVital.temperature.toFixed(1)} °C` : '--';
  const latestWeightLabel = latestVital.weightKg ? `${latestVital.weightKg.toFixed(1)} kg` : '--';

  const handleSaveDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedAge = Number(editAge);
    if (!editName.trim() || Number.isNaN(parsedAge) || parsedAge <= 0 || !editCondition.trim()) {
      alert('Please provide a valid name, age, and condition.');
      return;
    }

    if (!patientId) {
      return;
    }

    const updatedPatient = updatePatientDetails(patientId, {
      fullName: editName,
      age: parsedAge,
      condition: editCondition,
      ghanaCard: editGhanaCard,
      nhis: editNhis,
      facility: editFacility,
    });

    if (updatedPatient) {
      setPatient(updatedPatient);
      setIsEditingDetails(false);
    }
  };

  const handleCancelDetailsEdit = () => {
    setEditName(patient.name);
    setEditAge(String(patient.age));
    setEditCondition(patient.condition);
    setEditGhanaCard(patient.ghanaCard || '');
    setEditNhis(patient.nhis || '');
    setEditFacility(patient.facility || '');
    setIsEditingDetails(false);
  };

  return (
    <ProtectedRoute requiredRole="health-worker">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <section className="patient-head-figma">
            <div className="table-avatar patient-head-avatar">{patient.initials}</div>
            <div>
              <h1 className="patient-head-title">{patient.name}</h1>
              <p className="text-muted" style={{ margin: '4px 0 0' }}>{patient.age} • {patient.condition} • Patient since {patient.joined || '2025'}</p>
              <div className="patient-chip-row">
                <span className="badge badge-critical">Status {patient.status}</span>
                <span className="badge badge-caution">Adherence {patient.adherence}</span>
                <span className="badge" style={{ background: '#f3efe8', color: '#525a67' }}>Assigned to you</span>
              </div>
            </div>
          </section>

          <nav className="patient-tab-nav" aria-label="Patient tabs">
            {tabs.map((tab) => (
              <button key={tab} type="button" className={`patient-tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </nav>

          {activeTab === 'Overview' && (
            <section className="patient-overview-grid">
              <div className="panel hcp-panel">
                <div className="panel-headline-row" style={{ marginBottom: 12 }}>
                  <p className="panel-title">Patient details</p>
                  {!isEditingDetails ? (
                    <button
                      type="button"
                      aria-label="Edit patient details"
                      title="Edit patient details"
                      onClick={() => setIsEditingDetails(true)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        border: '1px solid #d49b3f',
                        background: '#fff7ea',
                        color: '#a96a0b',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14.06 4.94l3.75 3.75" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}
                </div>

                {!isEditingDetails ? (
                  <div className="patient-kv-grid">
                    <div>
                      <p className="block-label">Full name</p>
                      <p>{patient.name}</p>
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
                      <p>{patient.condition}</p>
                    </div>
                    <div>
                      <p className="block-label">Registered</p>
                      <p>{patient.joined || '2025'}</p>
                    </div>
                    <div>
                      <p className="block-label">Facility</p>
                      <p>{patient.facility || 'Kumasi South Hospital'}</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveDetails}>
                    <div className="onboarding-grid-two">
                      <label>
                        <span className="onboarding-field-label">Full name</span>
                        <input value={editName} onChange={(event) => setEditName(event.target.value)} required />
                      </label>
                      <label>
                        <span className="onboarding-field-label">Age</span>
                        <input type="number" min={1} value={editAge} onChange={(event) => setEditAge(event.target.value)} required />
                      </label>
                    </div>

                    <div className="onboarding-grid-two">
                      <label>
                        <span className="onboarding-field-label">Condition</span>
                        <input value={editCondition} onChange={(event) => setEditCondition(event.target.value)} required />
                      </label>
                      <label>
                        <span className="onboarding-field-label">Facility</span>
                        <input value={editFacility} onChange={(event) => setEditFacility(event.target.value)} />
                      </label>
                    </div>

                    <div className="onboarding-grid-two">
                      <label>
                        <span className="onboarding-field-label">Ghana Card</span>
                        <input value={editGhanaCard} onChange={(event) => setEditGhanaCard(event.target.value)} />
                      </label>
                      <label>
                        <span className="onboarding-field-label">NHIS</span>
                        <input value={editNhis} onChange={(event) => setEditNhis(event.target.value)} />
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                      <button type="button" className="ghost small" onClick={handleCancelDetailsEdit}>Cancel</button>
                      <button type="submit" className="primary small">Save changes</button>
                    </div>
                  </form>
                )}
              </div>

              <div className="panel hcp-panel">
                <p className="panel-title">Latest vitals</p>
                <div className="latest-vitals-box">
                  <p className="block-label" style={{ color: '#c14d4d' }}>{patient.status.toUpperCase()}</p>
                  <p className="latest-vitals-value">{latestVitalsLabel}</p>
                  <p className="text-muted">{latestVital.note}</p>
                  <div className="latest-vitals-meta-grid">
                    <div>
                      <p className="block-label">Pulse</p>
                      <p>{latestPulseLabel}</p>
                    </div>
                    <div>
                      <p className="block-label">Temperature</p>
                      <p>{latestTemperatureLabel}</p>
                    </div>
                    <div>
                      <p className="block-label">Weight</p>
                      <p>{latestWeightLabel}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'Readings' && (
            <section className="panel hcp-panel">
              <div className="readings-chart-box">
                <div className="panel-headline-row" style={{ marginBottom: 8 }}>
                  <p className="panel-title" style={{ margin: 0 }}>Blood pressure trend</p>
                  <div className="readings-legend-row">
                    <span className="readings-legend-item"><i className="legend-dot systolic" />Systolic</span>
                    <span className="readings-legend-item"><i className="legend-dot diastolic" />Diastolic</span>
                  </div>
                </div>

                <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" className="readings-chart-svg" aria-label="Blood pressure trend chart">
                  {[0, 1, 2, 3, 4].map((tick) => {
                    const y = CHART_PADDING.top + (chartInnerHeight / 4) * tick;
                    const value = Math.round(chartMax - ((chartMax - chartMin) / 4) * tick);
                    return (
                      <g key={tick}>
                        <line x1={CHART_PADDING.left} y1={y} x2={CHART_WIDTH - CHART_PADDING.right} y2={y} className="chart-grid-line" />
                        <text x={8} y={y + 4} className="chart-axis-text">{value}</text>
                      </g>
                    );
                  })}

                  {chartRows.map((row, index) => (
                    <text key={row.id} x={getX(index)} y={CHART_HEIGHT - 10} textAnchor="middle" className="chart-axis-text">
                      {formatVitalDateLabel(row.takenAt)}
                    </text>
                  ))}

                  <polyline points={diastolicPoints} className="chart-line-diastolic" />
                  <polyline points={systolicPoints} className="chart-line-systolic" />

                  {chartRows.map((row, index) => (
                    <g key={`dot-${row.id}`}>
                      <circle cx={getX(index)} cy={getY(row.systolic)} r={3.5} className="chart-dot-systolic" />
                      <circle cx={getX(index)} cy={getY(row.diastolic)} r={3.5} className="chart-dot-diastolic" />
                    </g>
                  ))}
                </svg>
              </div>

              <div className="panel-headline-row" style={{ marginBottom: 12 }}>
                <p className="panel-title">Record new vitals</p>
              </div>

              <form onSubmit={handleSaveVitals}>
                <div className="onboarding-grid-two">
                  <label>
                    <span className="onboarding-field-label">Systolic (mmHg)</span>
                    <input type="number" min={50} required value={systolic} onChange={(event) => setSystolic(event.target.value)} />
                  </label>
                  <label>
                    <span className="onboarding-field-label">Diastolic (mmHg)</span>
                    <input type="number" min={30} required value={diastolic} onChange={(event) => setDiastolic(event.target.value)} />
                  </label>
                </div>

                <div className="onboarding-grid-two">
                  <label>
                    <span className="onboarding-field-label">Pulse (optional)</span>
                    <input type="number" min={20} value={pulse} onChange={(event) => setPulse(event.target.value)} />
                  </label>
                  <label>
                    <span className="onboarding-field-label">Temperature (optional)</span>
                    <input type="number" min={30} step="0.1" value={temperature} onChange={(event) => setTemperature(event.target.value)} />
                  </label>
                </div>

                <div className="onboarding-grid-two">
                  <label>
                    <span className="onboarding-field-label">Weight kg (optional)</span>
                    <input type="number" min={1} step="0.1" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
                  </label>
                  <label>
                    <span className="onboarding-field-label">Note</span>
                    <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="primary small" type="submit">Save vitals</button>
                </div>
              </form>

              <div className="panel-headline-row" style={{ margin: '20px 0 12px' }}>
                <p className="panel-title">Vital history</p>
              </div>

              <div className="reading-card">
                <p><strong>BP {latestVitalsLabel}</strong> <span className={`status-pill status-${patient.status.toLowerCase()}`}>{patient.status}</span></p>
                <p className="text-muted">{formatVitalTime(String(latestVital.takenAt))}</p>
                <div className="vitals-inline-list">
                  <span>Pulse: {latestPulseLabel}</span>
                  <span>Temp: {latestTemperatureLabel}</span>
                  <span>Weight: {latestWeightLabel}</span>
                </div>
              </div>

              {readingRows.slice(1).map((item) => (
                <div key={item.id} className="reading-mini-card">
                  <p><strong>BP {item.systolic} / {item.diastolic}</strong></p>
                  <p className="text-muted">{formatVitalTime(String(item.takenAt))}</p>
                  <div className="vitals-inline-list">
                    <span>Pulse: {item.pulse ? `${item.pulse} bpm` : '--'}</span>
                    <span>Temp: {item.temperature ? `${item.temperature.toFixed(1)} °C` : '--'}</span>
                    <span>Weight: {item.weightKg ? `${item.weightKg.toFixed(1)} kg` : '--'}</span>
                  </div>
                </div>
              ))}
            </section>
          )}

          {activeTab === 'Medication' && (
          <section className="patient-overview-grid">
            <div className="panel hcp-panel">
              <div className="panel-headline-row">
                <p className="panel-title">30-day adherence</p>
                <p className="panel-title" style={{ color: '#f0a950' }}>64% overall</p>
              </div>
              <div className="adherence-grid">
                {Array.from({ length: 30 }).map((_, index) => (
                  <span key={index} className={`adherence-cell-dot ${(index + 1) % 6 === 0 || index === 3 || index === 12 ? 'missed' : ''}`} />
                ))}
              </div>
              <label style={{ marginTop: 16, display: 'block' }}>
                <span className="onboarding-field-label">Note to patient about adherence</span>
                <textarea rows={3} placeholder="Write a short, warm note in plain language..." />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="primary small">Send & notify patient</button>
              </div>
            </div>

            <div className="panel hcp-panel">
              <p className="panel-title">Prescription</p>
              {patientDetail.medication.map((item) => (
                <div key={item.name} className="prescription-card">
                  <p style={{ margin: 0, fontWeight: 700 }}>{item.name}</p>
                  <p className="text-muted" style={{ margin: '4px 0 0' }}>{item.dose}</p>
                  <p style={{ margin: '6px 0 0', color: '#ef6b6b', fontWeight: 700, fontSize: '0.82rem' }}>Adherence {item.adherence}</p>
                </div>
              ))}
            </div>
          </section>
        )}

          {activeTab === 'Appointments' && (
          <section className="panel hcp-panel">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="primary small">+ New Appointment</button>
            </div>

            <p className="block-label" style={{ marginBottom: 8 }}>Upcoming</p>
            <div className="list-card">
              <div className="appointment-row">
                <div>
                  <p className="appointment-title">Wed 3 Jun • 09:00 • Clinic</p>
                  <p className="text-muted" style={{ margin: '4px 0 0' }}>BP review — bring your diary.</p>
                </div>
                <button className="text-link">Cancel</button>
              </div>
              <div className="appointment-row">
                <div>
                  <p className="appointment-title">Mon 8 Jun • 14:00 • Phone</p>
                  <p className="text-muted" style={{ margin: '4px 0 0' }}>Adherence check-in call.</p>
                </div>
                <button className="text-link">Cancel</button>
              </div>
            </div>

            <p className="block-label" style={{ margin: '16px 0 8px' }}>Past</p>
            <div className="appointment-row">
              <div>
                <p className="appointment-title">Mon 13 May • 09:30 • Clinic</p>
                <p className="text-muted" style={{ margin: '4px 0 0' }}>Medication review.</p>
              </div>
            </div>
          </section>
        )}

          {activeTab === 'Chat' && (
          <section className="panel hcp-panel patient-chat-box">
            <div className="message-list" style={{ padding: 8 }}>
              {patientDetail.messages.map((message, index) => (
                <div key={index} className={`message-bubble ${message.type === 'to' ? 'message-to' : 'message-from'}`}>
                  {message.text}
                  <div className="message-time">{message.time}</div>
                </div>
              ))}
            </div>

            <div className="chat-input-row" style={{ marginTop: 0 }}>
              <input type="text" placeholder="Write a short, warm reply..." />
              <button className="primary small">➤</button>
            </div>
          </section>
        )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
