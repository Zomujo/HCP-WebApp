"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Sidebar } from '../../components/Sidebar';
import { patientDetail } from '../../lib/dummy';
import { addVital, getPatientById, getVitalsForPatient, VitalEntry } from '../../lib/patientStore';
import { ProtectedRoute } from '../../components/ProtectedRoute';

const tabs = ['Overview', 'Readings', 'Medication', 'Appointments', 'Chat'] as const;
type TabName = (typeof tabs)[number];

export default function PatientDetailsPage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [vitals, setVitals] = useState<VitalEntry[]>([]);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [note, setNote] = useState('');

  const patient = useMemo(() => {
    const loadedPatient = patientId ? getPatientById(patientId) : undefined;
    if (loadedPatient) {
      return loadedPatient;
    }

    return {
      id: 'akua-mensah',
      name: patientDetail.name,
      initials: patientDetail.initials,
      age: patientDetail.age,
      condition: patientDetail.condition,
      ghanaCard: patientDetail.ghanaCard,
      nhis: patientDetail.nhis,
      facility: patientDetail.facility,
      joined: patientDetail.joined,
      status: 'Critical' as const,
      adherence: patientDetail.adherence,
      lastCheckIn: 'Today',
    };
  }, [patientId]);

  useEffect(() => {
    if (!patientId) {
      return;
    }

    setVitals(getVitalsForPatient(patientId));
  }, [patientId]);

  const latestVital = vitals[0] || {
    systolic: patientDetail.vitals.systolic,
    diastolic: patientDetail.vitals.diastolic,
    note: patientDetail.vitals.note,
    takenAt: new Date().toISOString(),
  };

  const readingRows = vitals.length
    ? vitals
    : patientDetail.readings.map((reading, index) => {
        const parts = reading.value.split('/').map((value) => Number(value.trim()));
        return {
          id: `fallback-${index}`,
          patientId: patient.id,
          systolic: parts[0],
          diastolic: parts[1],
          note: reading.note,
          takenAt: reading.time,
        };
      });

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
                <p className="panel-title">Patient details</p>
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
              </div>

              <div className="panel hcp-panel">
                <p className="panel-title">Latest vitals</p>
                <div className="latest-vitals-box">
                  <p className="block-label" style={{ color: '#c14d4d' }}>{patient.status.toUpperCase()}</p>
                  <p className="latest-vitals-value">{latestVitalsLabel}</p>
                  <p className="text-muted">{latestVital.note}</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'Readings' && (
            <section className="panel hcp-panel">
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
                <p className="text-muted">{String(latestVital.takenAt)}</p>
              </div>

              {readingRows.slice(1).map((item) => (
                <div key={item.id} className="reading-mini-card">
                  <p><strong>BP {item.systolic} / {item.diastolic}</strong></p>
                  <p className="text-muted">{String(item.takenAt)}</p>
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
