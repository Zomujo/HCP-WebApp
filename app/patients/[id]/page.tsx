"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Sidebar } from '../../components/Sidebar';
import { patientDetail } from '../../lib/dummy';
import { addVital, getPatientById, getVitalsForPatient, PatientRecord, updatePatientDetails, VitalEntry } from '../../lib/patientStore';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const tabs = ['Overview', 'Readings', 'Medication', 'Appointments', 'Chat'] as const;
type TabName = (typeof tabs)[number];
type ChartMetric = 'bp' | 'pulse' | 'temperature' | 'weight';

const metricLabels: Record<ChartMetric, string> = {
  bp: 'Blood pressure trend',
  pulse: 'Pulse trend',
  temperature: 'Temperature trend',
  weight: 'Weight trend',
};

const metricUnits: Record<ChartMetric, string> = {
  bp: 'mmHg',
  pulse: 'bpm',
  temperature: '°C',
  weight: 'kg',
};

const fallbackPulseSeries = [92, 76, 88, 72, 90];
const fallbackTemperatureSeries = [36.9, 36.6, 37.1, 36.7, 37.0];
const fallbackWeightSeries = [72.4, 72.1, 72.7, 72.0, 72.5];

function formatMetricNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

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
  const [activeChartMetric, setActiveChartMetric] = useState<ChartMetric>('bp');

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
        pulse: fallbackPulseSeries[index] ?? undefined,
        temperature: fallbackTemperatureSeries[index] ?? undefined,
        weightKg: fallbackWeightSeries[index] ?? undefined,
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
  const chartSeriesValues =
    activeChartMetric === 'bp'
      ? chartRows.flatMap((row) => [row.systolic, row.diastolic])
      : chartRows
          .map((row) => {
            if (activeChartMetric === 'pulse') {
              return row.pulse;
            }
            if (activeChartMetric === 'temperature') {
              return row.temperature;
            }
            return row.weightKg;
          })
          .filter((value): value is number => typeof value === 'number');

  const defaultDomains: Record<ChartMetric, [number, number]> = {
    bp: [40, 220],
    pulse: [40, 140],
    temperature: [34, 41],
    weight: [35, 130],
  };

  const domainPadding: Record<ChartMetric, number> = {
    bp: 20,
    pulse: 10,
    temperature: 1,
    weight: 5,
  };

  const fallbackDomain = defaultDomains[activeChartMetric];
  const measuredMin = chartSeriesValues.length ? Math.min(...chartSeriesValues) : fallbackDomain[0];
  const measuredMax = chartSeriesValues.length ? Math.max(...chartSeriesValues) : fallbackDomain[1];
  const pad = domainPadding[activeChartMetric];
  const chartMin = Math.max(0, Math.floor((measuredMin - pad) * 10) / 10);
  const chartMax = Math.max(chartMin + 1, Math.ceil((measuredMax + pad) * 10) / 10);

  const chartData = chartRows.map((row) => ({
    id: row.id,
    label: formatVitalDateLabel(row.takenAt),
    systolic: row.systolic,
    diastolic: row.diastolic,
    pulse: row.pulse ?? null,
    temperature: row.temperature ?? null,
    weight: row.weightKg ?? null,
  }));

  const bpSummary = useMemo(() => {
    if (!chartRows.length) {
      return {
        latest: '--',
        average: '--',
        minimum: '--',
        maximum: '--',
      };
    }

    const systolicValues = chartRows.map((row) => row.systolic);
    const diastolicValues = chartRows.map((row) => row.diastolic);

    const avgSys = systolicValues.reduce((sum, value) => sum + value, 0) / systolicValues.length;
    const avgDia = diastolicValues.reduce((sum, value) => sum + value, 0) / diastolicValues.length;

    return {
      latest: `${chartRows[chartRows.length - 1].systolic} / ${chartRows[chartRows.length - 1].diastolic} ${metricUnits.bp}`,
      average: `${formatMetricNumber(avgSys)} / ${formatMetricNumber(avgDia)} ${metricUnits.bp}`,
      minimum: `${Math.min(...systolicValues)} / ${Math.min(...diastolicValues)} ${metricUnits.bp}`,
      maximum: `${Math.max(...systolicValues)} / ${Math.max(...diastolicValues)} ${metricUnits.bp}`,
    };
  }, [chartRows]);

  const singleMetricSummary = useMemo(() => {
    const values = chartRows
      .map((row) => {
        if (activeChartMetric === 'pulse') {
          return row.pulse;
        }

        if (activeChartMetric === 'temperature') {
          return row.temperature;
        }

        return row.weightKg;
      })
      .filter((value): value is number => typeof value === 'number');

    if (!values.length) {
      return {
        latest: '--',
        average: '--',
        minimum: '--',
        maximum: '--',
      };
    }

    const average = values.reduce((sum, value) => sum + value, 0) / values.length;

    return {
      latest: `${formatMetricNumber(values[values.length - 1])} ${metricUnits[activeChartMetric]}`,
      average: `${formatMetricNumber(average)} ${metricUnits[activeChartMetric]}`,
      minimum: `${formatMetricNumber(Math.min(...values))} ${metricUnits[activeChartMetric]}`,
      maximum: `${formatMetricNumber(Math.max(...values))} ${metricUnits[activeChartMetric]}`,
    };
  }, [activeChartMetric, chartRows]);

  const activeSummary = activeChartMetric === 'bp' ? bpSummary : singleMetricSummary;

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
                  <p className="panel-title" style={{ margin: 0 }}>{metricLabels[activeChartMetric]}</p>
                </div>

                <div className="metric-summary-grid">
                  <div className="metric-summary-card">
                    <p className="block-label">Latest</p>
                    <p>{activeSummary.latest}</p>
                  </div>
                  <div className="metric-summary-card">
                    <p className="block-label">Average</p>
                    <p>{activeSummary.average}</p>
                  </div>
                  <div className="metric-summary-card">
                    <p className="block-label">Min</p>
                    <p>{activeSummary.minimum}</p>
                  </div>
                  <div className="metric-summary-card">
                    <p className="block-label">Max</p>
                    <p>{activeSummary.maximum}</p>
                  </div>
                </div>

                <div className="metric-toggle-row" role="tablist" aria-label="Vitals chart metric">
                  <button type="button" className={`metric-toggle-btn ${activeChartMetric === 'bp' ? 'active' : ''}`} onClick={() => setActiveChartMetric('bp')}>
                    BP
                  </button>
                  <button type="button" className={`metric-toggle-btn ${activeChartMetric === 'pulse' ? 'active' : ''}`} onClick={() => setActiveChartMetric('pulse')}>
                    Pulse
                  </button>
                  <button type="button" className={`metric-toggle-btn ${activeChartMetric === 'temperature' ? 'active' : ''}`} onClick={() => setActiveChartMetric('temperature')}>
                    Temperature
                  </button>
                  <button type="button" className={`metric-toggle-btn ${activeChartMetric === 'weight' ? 'active' : ''}`} onClick={() => setActiveChartMetric('weight')}>
                    Weight
                  </button>
                </div>

                <div className="readings-chart-inner" aria-label="Blood pressure trend chart">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData} margin={{ top: 8, right: 18, left: 4, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#8a93a2', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: '#dbe2ea' }}
                        minTickGap={20}
                      />
                      <YAxis
                        domain={[chartMin, chartMax]}
                        tick={{ fill: '#8a93a2', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: '#dbe2ea' }}
                        width={34}
                        unit={metricUnits[activeChartMetric]}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, borderColor: '#e0e6ef' }}
                        labelStyle={{ color: '#374151', fontWeight: 700 }}
                        formatter={(value) => `${value} ${metricUnits[activeChartMetric]}`}
                      />
                      {activeChartMetric === 'bp' ? <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 8 }} /> : null}

                      {activeChartMetric === 'bp' ? (
                        <>
                          <Line type="natural" dataKey="systolic" name="Systolic" stroke="#ef9a4c" strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 5 }} />
                          <Line type="natural" dataKey="diastolic" name="Diastolic" stroke="#47586f" strokeWidth={2.2} dot={{ r: 3.5 }} activeDot={{ r: 5 }} />
                        </>
                      ) : null}

                      {activeChartMetric === 'pulse' ? (
                        <Line type="natural" dataKey="pulse" name="Pulse" stroke="#2f7f47" strokeWidth={2.4} dot={{ r: 3.5 }} activeDot={{ r: 5 }} connectNulls />
                      ) : null}

                      {activeChartMetric === 'temperature' ? (
                        <Line type="natural" dataKey="temperature" name="Temperature" stroke="#b85d3d" strokeWidth={2.4} dot={{ r: 3.5 }} activeDot={{ r: 5 }} connectNulls />
                      ) : null}

                      {activeChartMetric === 'weight' ? (
                        <Line type="natural" dataKey="weight" name="Weight" stroke="#5b4f9d" strokeWidth={2.4} dot={{ r: 3.5 }} activeDot={{ r: 5 }} connectNulls />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
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
