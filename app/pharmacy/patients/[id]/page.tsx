"use client";

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Sidebar } from '../../../components/Sidebar';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import { RecordVitalsModal, RecordVitalsSubmission } from '../../../components/RecordVitalsModal';
import { pharmacyPatientApi } from '../../../lib/api';
import type { Patient, VitalEntry } from '../../../lib/api';
import { formatConditions } from '../../../lib/format';
import {
  SEVERITY_LABEL,
  VITAL_BY_TYPE,
  VITAL_DEFINITIONS,
  VitalSeverity,
  VitalType,
  classifyVital,
  isVitalType,
  normalizeSeverity,
  parseBloodPressure,
} from '../../../lib/vitals';

type Tab = 'Overview' | 'Vitals';
type RangeKey = '7d' | '30d' | '90d' | 'all';

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string; days?: number }> = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
  { value: '90d', label: '90 days', days: 90 },
  { value: 'all', label: 'All' },
];

// Shaded "typical" band on single-value charts.
const NORMAL_BANDS: Partial<Record<VitalType, [number, number]>> = {
  bloodSugar: [4, 7.8],
  heartRate: [60, 100],
  temperature: [36.1, 37.5],
  oxygenSaturation: [95, 100],
  respirationRate: [12, 20],
};

interface LatestReading {
  type: VitalType;
  value: string;
  unit: string;
  severity: VitalSeverity;
  recordedAt?: string;
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelative(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function severityOf(type: VitalType, value: string, stored?: unknown): VitalSeverity {
  return normalizeSeverity(stored) ?? classifyVital(type, value);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function capitalize(value?: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—';
}

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="clinical-chart-tooltip">
      <p>{label}</p>
      {payload.map((item: any) => (
        <div key={item.dataKey}>
          <span style={{ backgroundColor: item.color }} />
          <strong>{item.name}</strong>
          <b>{item.value} {unit}</b>
        </div>
      ))}
    </div>
  );
}

function PharmacyPatientDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const patientId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [entries, setEntries] = useState<VitalEntry[]>([]);
  const [latestFromApi, setLatestFromApi] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(searchParams.get('registered') ? 'Patient registered. Record their first vitals to start tracking.' : '');
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [range, setRange] = useState<RangeKey>('30d');
  const [chartType, setChartType] = useState<VitalType>('bloodPressure');
  const [modalEntry, setModalEntry] = useState<VitalEntry | null | undefined>(undefined);
  const [entryToDelete, setEntryToDelete] = useState<VitalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);

  const loadVitals = useCallback(async () => {
    if (!patientId) return;
    const [log, latest] = await Promise.all([
      pharmacyPatientApi.getVitalLog(patientId).catch(() => [] as VitalEntry[]),
      pharmacyPatientApi.getLatestVitals(patientId).catch(() => []),
    ]);
    setEntries(log);
    setLatestFromApi(latest);
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError('');
        const patientData = await pharmacyPatientApi.getPatientById(patientId);
        if (cancelled) return;
        setPatient(patientData);
        await loadVitals();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load patient details');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, loadVitals]);

  // Latest value per vital: the log has timestamps, so prefer it; fill gaps from /vitals/latest.
  const latestByType = useMemo(() => {
    const latest = new Map<VitalType, LatestReading>();
    for (const entry of entries) {
      for (const vital of entry.vitals) {
        if (!isVitalType(vital.vitalType) || latest.has(vital.vitalType)) continue;
        latest.set(vital.vitalType, {
          type: vital.vitalType,
          value: vital.value,
          unit: vital.unit || VITAL_BY_TYPE[vital.vitalType].unit,
          severity: severityOf(vital.vitalType, vital.value, vital.severity),
          recordedAt: entry.recordedAt,
        });
      }
    }
    for (const vital of latestFromApi) {
      if (!isVitalType(vital?.vitalType) || latest.has(vital.vitalType)) continue;
      latest.set(vital.vitalType, {
        type: vital.vitalType,
        value: String(vital.value ?? ''),
        unit: vital.unit || VITAL_BY_TYPE[vital.vitalType as VitalType].unit,
        severity: severityOf(vital.vitalType, String(vital.value ?? ''), vital.severity),
      });
    }
    return latest;
  }, [entries, latestFromApi]);

  const rangeEntries = useMemo(() => {
    const days = RANGE_OPTIONS.find((option) => option.value === range)?.days;
    if (!days) return entries;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return entries.filter((entry) => new Date(entry.recordedAt).getTime() >= cutoff);
  }, [entries, range]);

  const chartData = useMemo(() => {
    type ChartPoint = { label: string; systolic?: number; diastolic?: number; value?: number };
    return [...rangeEntries]
      .reverse()
      .map((entry): ChartPoint | null => {
        const vital = entry.vitals.find((item) => item.vitalType === chartType);
        if (!vital) return null;
        const label = new Date(entry.recordedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        if (chartType === 'bloodPressure') {
          const reading = parseBloodPressure(vital.value);
          return reading ? { label, systolic: reading.systolic, diastolic: reading.diastolic } : null;
        }
        const value = Number(vital.value);
        return Number.isFinite(value) ? { label, value } : null;
      })
      .filter((point): point is ChartPoint => point !== null);
  }, [rangeEntries, chartType]);

  const chartedTypes = useMemo(
    () => VITAL_DEFINITIONS.filter((definition) => entries.some((entry) => entry.vitals.some((vital) => vital.vitalType === definition.type))),
    [entries]
  );

  useEffect(() => {
    if (chartedTypes.length > 0 && !chartedTypes.some((definition) => definition.type === chartType)) {
      setChartType(chartedTypes[0].type);
    }
  }, [chartedTypes, chartType]);

  const handleSaveVitals = async (submission: RecordVitalsSubmission) => {
    if (!patientId) return;
    if (modalEntry) {
      await pharmacyPatientApi.updateVitalEntry(modalEntry.id, submission);
      setNotice('Vitals updated.');
    } else {
      await pharmacyPatientApi.createVitalEntry({ patientId, ...submission });
      setNotice(`${submission.vitals.length === 1 ? 'Reading' : `${submission.vitals.length} readings`} saved.`);
    }
    setModalEntry(undefined);
    await loadVitals();
  };

  const handleDelete = async () => {
    if (!entryToDelete) return;
    try {
      setIsDeleting(true);
      await pharmacyPatientApi.deleteVitalEntry(entryToDelete.id);
      setEntryToDelete(null);
      setNotice('Entry deleted.');
      await loadVitals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this entry.');
      setEntryToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const name = patient?.name || `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';
  const criticalCount = Array.from(latestByType.values()).filter((reading) => reading.severity === 'critical').length;
  const lastReadingAt = entries[0]?.recordedAt;
  const visibleEntries = showAllEntries ? rangeEntries : rangeEntries.slice(0, 8);
  const chartDefinition = VITAL_BY_TYPE[chartType];
  const band = NORMAL_BANDS[chartType];

  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <Link href="/pharmacy/patients" className="back-link">← Back to patients</Link>

          {isLoading ? (
            <div className="loading-state" role="status">
              <span className="spinner" aria-hidden />
              Loading patient…
            </div>
          ) : !patient ? (
            <div className="alert alert-error" role="alert">{error || 'Patient not found.'}</div>
          ) : (
            <>
              <section className="patient-hero">
                <div className="patient-hero-main">
                  <div className="table-avatar patient-head-avatar">{initials(name)}</div>
                  <div className="patient-hero-text">
                    <div className="patient-hero-title-row">
                      <h1 className="patient-head-title">{name}</h1>
                      {criticalCount > 0 && (
                        <span className="status-pill status-critical">{criticalCount} critical {criticalCount === 1 ? 'reading' : 'readings'}</span>
                      )}
                    </div>
                    <p className="patient-head-meta">
                      {[patient.patientCode, patient.age ? `${patient.age} yrs` : null, patient.gender ? capitalize(patient.gender) : null, patient.chronicConditions?.length ? formatConditions(patient.chronicConditions) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="patient-hero-sub">
                      {lastReadingAt ? `Last vitals ${formatRelative(lastReadingAt)}` : 'No vitals recorded yet'}
                    </p>
                  </div>
                </div>
                <button type="button" className="primary" onClick={() => setModalEntry(null)}>
                  <span aria-hidden>+</span> Record vitals
                </button>
              </section>

              {notice && (
                <div className="alert alert-success alert-dismissible" role="status">
                  <span>{notice}</span>
                  <button type="button" className="alert-dismiss" onClick={() => setNotice('')} aria-label="Dismiss">×</button>
                </div>
              )}
              {error && <div className="alert alert-error" role="alert">{error}</div>}

              <nav className="patient-tab-nav" aria-label="Patient sections">
                {(['Overview', 'Vitals'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`patient-tab-btn ${activeTab === tab ? 'active' : ''}`}
                    aria-current={activeTab === tab ? 'page' : undefined}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'Vitals' ? `Vitals history${entries.length ? ` (${entries.length})` : ''}` : tab}
                  </button>
                ))}
              </nav>

              {activeTab === 'Overview' && (
                <>
                  <section className="panel hcp-panel">
                    <div className="panel-headline-row">
                      <div>
                        <p className="panel-title">Latest vitals</p>
                        <p className="panel-subtitle">Most recent reading for each measurement.</p>
                      </div>
                      {entries.length > 0 && (
                        <button type="button" className="text-link" onClick={() => setActiveTab('Vitals')}>View history</button>
                      )}
                    </div>
                    <div className="vital-card-grid">
                      {VITAL_DEFINITIONS.map((definition) => {
                        const reading = latestByType.get(definition.type);
                        return (
                          <div key={definition.type} className={`vital-card ${reading ? `tone-${reading.severity}` : 'is-empty'}`}>
                            <div className="vital-card-head">
                              <span className="vital-card-label">{definition.label}</span>
                            </div>
                            {reading ? (
                              <>
                                <p className="vital-card-value">
                                  {reading.value}
                                  <span>{reading.unit}</span>
                                </p>
                                <div className="vital-card-foot">
                                  <span>{reading.recordedAt ? formatRelative(reading.recordedAt) : 'Latest reading'}</span>
                                  <span className={`rd-pill vital-tone-${reading.severity}`}>{SEVERITY_LABEL[reading.severity]}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="vital-card-value muted">—</p>
                                <div className="vital-card-foot"><span>Not recorded</span></div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="panel hcp-panel">
                    <p className="panel-title">Patient information</p>
                    <div className="patient-kv-grid">
                      {[
                        ['Patient code', patient.patientCode],
                        ['Ghana Card', patient.ghanaCard],
                        ['NHIS number', patient.nhis],
                        ['Phone', patient.phoneNumber],
                        ['Date of birth', patient.dateOfBirth ? formatDate(patient.dateOfBirth) : undefined],
                        ['Gender', patient.gender ? capitalize(patient.gender) : undefined],
                        ['Conditions', patient.chronicConditions?.length ? formatConditions(patient.chronicConditions) : undefined],
                        ['Height', patient.height ? `${patient.height} cm` : undefined],
                        ['Weight', patient.weight ? `${patient.weight} kg` : undefined],
                        ['BMI', patient.bmi ? patient.bmi.toFixed(1) : undefined],
                        ['Medication adherence', patient.adherence],
                        ['Registered', patient.joined],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="block-label">{label}</p>
                          <p className={value ? undefined : 'kv-empty'}>{value || 'Not provided'}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {activeTab === 'Vitals' && (
                <section className="readings-workspace rd">
                  <div className="rd-toolbar">
                    <div>
                      <h2 className="rd-title">Vitals history</h2>
                      <p className="rd-subtitle">Trends and every reading recorded for {name}.</p>
                    </div>
                    <div className="rd-toolbar-actions">
                      <div className="rd-segmented" role="group" aria-label="Date range">
                        {RANGE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={range === option.value ? 'active' : ''}
                            aria-pressed={range === option.value}
                            onClick={() => setRange(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {entries.length === 0 ? (
                    <div className="panel hcp-panel">
                      <div className="empty-state empty-state-cta">
                        <p className="empty-title">No vitals recorded yet</p>
                        <p>Readings you record will appear here as charts and a full log.</p>
                        <button type="button" className="primary small" onClick={() => setModalEntry(null)}>
                          <span aria-hidden>+</span> Record vitals
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rd-card">
                        <div className="rd-card-head">
                          <div>
                            <h3>{chartDefinition.label}</h3>
                            <p>
                              {chartData.length} {chartData.length === 1 ? 'reading' : 'readings'} · {chartDefinition.unit}
                            </p>
                          </div>
                          <div className="chip-switch" role="group" aria-label="Measurement to chart">
                            {chartedTypes.map((definition) => (
                              <button
                                key={definition.type}
                                type="button"
                                className={chartType === definition.type ? 'active' : ''}
                                aria-pressed={chartType === definition.type}
                                onClick={() => setChartType(definition.type)}
                              >
                                {definition.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="rd-chart">
                          {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                <CartesianGrid stroke="#edf0f5" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#8290a2', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#d6dde7' }} interval="preserveStartEnd" minTickGap={24} padding={{ left: 12, right: 12 }} />
                                <YAxis tick={{ fill: '#8290a2', fontSize: 11 }} tickLine={false} axisLine={false} width={40} domain={['auto', 'auto']} />
                                <Tooltip content={<ChartTooltip unit={chartDefinition.unit} />} cursor={{ stroke: '#cbd5e1' }} />
                                {chartType === 'bloodPressure' ? (
                                  <>
                                    <ReferenceLine y={140} stroke="#e5a3a3" strokeDasharray="4 4" />
                                    <ReferenceLine y={90} stroke="#aebbd0" strokeDasharray="4 4" />
                                    <Line type="monotone" dataKey="systolic" name="Systolic" stroke="#ee9342" strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} isAnimationActive={false} />
                                    <Line type="monotone" dataKey="diastolic" name="Diastolic" stroke="#425876" strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} isAnimationActive={false} />
                                  </>
                                ) : (
                                  <>
                                    {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="#3fa36b" fillOpacity={0.08} stroke="none" />}
                                    <Line type="monotone" dataKey="value" name={chartDefinition.label} stroke="#0f8b8d" strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} isAnimationActive={false} />
                                  </>
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="rd-empty">No {chartDefinition.label.toLowerCase()} readings in this period.</div>
                          )}
                        </div>
                        <div className="rd-legend chart-legend-foot">
                          {chartType === 'bloodPressure' ? (
                            <>
                              <span><i style={{ background: '#ee9342' }} />Systolic</span>
                              <span><i style={{ background: '#425876' }} />Diastolic</span>
                              <span><i className="rd-legend-dash" />140 / 90 thresholds</span>
                            </>
                          ) : (
                            <>
                              <span><i style={{ background: '#0f8b8d' }} />{chartDefinition.label}</span>
                              {band && <span><i className="rd-legend-band" />Typical range {band[0]}–{band[1]}</span>}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="rd-card">
                        <div className="rd-card-head">
                          <div>
                            <h3>Reading log</h3>
                            <p>{rangeEntries.length} {rangeEntries.length === 1 ? 'entry' : 'entries'} in this period</p>
                          </div>
                        </div>
                        {rangeEntries.length > 0 ? (
                          <>
                            <div className="vital-log">
                              {visibleEntries.map((entry) => (
                                <article key={entry.id} className="vital-log-entry">
                                  <div className="vital-log-time">
                                    <strong>{formatDateTime(entry.recordedAt)}</strong>
                                    <span>{formatRelative(entry.recordedAt)}</span>
                                  </div>
                                  <div className="vital-log-body">
                                    <div className="vital-log-readings">
                                      {entry.vitals.length > 0 ? (
                                        entry.vitals.map((vital) => {
                                          const type = isVitalType(vital.vitalType) ? vital.vitalType : null;
                                          const severity = type ? severityOf(type, vital.value, vital.severity) : 'normal';
                                          return (
                                            <span key={vital.vitalType} className={`reading-chip vital-tone-${severity}`}>
                                              <span className="reading-chip-label">{type ? VITAL_BY_TYPE[type].label : vital.vitalType}</span>
                                              <strong>{vital.value}</strong>
                                              <span className="reading-chip-unit">{vital.unit}</span>
                                            </span>
                                          );
                                        })
                                      ) : (
                                        <span className="rd-muted">Readings unavailable</span>
                                      )}
                                    </div>
                                    {entry.notes && <p className="vital-log-notes">{entry.notes}</p>}
                                  </div>
                                  <div className="vital-log-actions">
                                    <button type="button" className="icon-button" onClick={() => setModalEntry(entry)} aria-label="Edit entry" title="Edit">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4z" />
                                      </svg>
                                    </button>
                                    <button type="button" className="icon-button danger" onClick={() => setEntryToDelete(entry)} aria-label="Delete entry" title="Delete">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                                      </svg>
                                    </button>
                                  </div>
                                </article>
                              ))}
                            </div>
                            {rangeEntries.length > 8 && (
                              <button type="button" className="rd-link" onClick={() => setShowAllEntries((value) => !value)}>
                                {showAllEntries ? 'Show fewer' : `Show all ${rangeEntries.length} entries`}
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="rd-empty rd-empty-inline">No entries in this period.</div>
                        )}
                      </div>
                    </>
                  )}
                </section>
              )}

              {modalEntry !== undefined && (
                <RecordVitalsModal
                  patientName={name}
                  entry={modalEntry}
                  onClose={() => setModalEntry(undefined)}
                  onSubmit={handleSaveVitals}
                />
              )}

              {entryToDelete && (
                <div className="modal-backdrop" onClick={() => !isDeleting && setEntryToDelete(null)}>
                  <div className="pf-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-entry-title" onClick={(event) => event.stopPropagation()}>
                    <div className="pf-modal-icon" aria-hidden>!</div>
                    <h3 id="delete-entry-title">Delete this entry?</h3>
                    <p className="pf-modal-body">
                      The readings taken on <strong>{formatDateTime(entryToDelete.recordedAt)}</strong> will be permanently removed from {name}&apos;s history.
                    </p>
                    <div className="pf-modal-actions">
                      <button type="button" className="pf-btn pf-btn-outline" onClick={() => setEntryToDelete(null)} disabled={isDeleting}>Cancel</button>
                      <button type="button" className="pf-btn pf-btn-danger-solid" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? 'Deleting…' : 'Delete entry'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function PharmacyPatientDetailPage() {
  return (
    <Suspense fallback={null}>
      <PharmacyPatientDetail />
    </Suspense>
  );
}
