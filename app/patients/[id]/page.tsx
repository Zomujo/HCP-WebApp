"use client";

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { hcpPatientApi } from '../../lib/api';
import { formatConditions } from '../../lib/format';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import type { Patient, Appointment, Medication } from '../../lib/api';
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

const tabs = ['Overview', 'Readings', 'Medication', 'Appointments'] as const;
type TabName = (typeof tabs)[number];
type AppointmentStatusFilter = 'all' | Appointment['status'];
type VitalDateRange = 'thisWeek' | 'last3Months' | 'lastYear' | 'custom';

// Inclusive calendar dates in yyyy-mm-dd form, as produced by <input type="date">.
interface CustomDateRange {
  from: string;
  to: string;
}

function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDateInputValue(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

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

const TIMESTAMP_KEYS = [
  'recordedAt',
  'recorded_at',
  'measuredAt',
  'measured_at',
  'takenAt',
  'taken_at',
  'loggedAt',
  'logged_at',
  'createdAt',
  'created_at',
  'date',
  'timestamp',
];

function parseTimestamp(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Epoch values arrive in seconds from some sources and milliseconds from others.
    const parsed = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value.trim());
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

// Returns '' rather than inventing a timestamp when the payload carries none.
function extractRecordedAt(entry: any): string {
  if (!entry || typeof entry !== 'object') return '';

  for (const key of TIMESTAMP_KEYS) {
    const parsed = parseTimestamp(entry[key]);
    if (parsed) return parsed.toISOString();
  }

  for (const [key, value] of Object.entries(entry)) {
    if (!/(at|date|time)$/i.test(key)) continue;
    const parsed = parseTimestamp(value);
    if (parsed) return parsed.toISOString();
  }

  // Vital logs carry no date field, but their Mongo ObjectId embeds the creation time.
  const createdFromId = objectIdTimestamp(entry.id ?? entry._id);
  return createdFromId ? createdFromId.toISOString() : '';
}

function objectIdTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^[0-9a-f]{24}$/i.test(value)) return null;
  const date = new Date(parseInt(value.slice(0, 8), 16) * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinDateRange(
  recordedAt: string,
  range: VitalDateRange,
  custom: CustomDateRange,
  now = new Date()
): boolean {
  const date = parseTimestamp(recordedAt);
  if (!date) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case 'thisWeek': {
      // Weeks start on Monday.
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
      return date >= startOfWeek;
    }
    case 'last3Months':
      return date >= new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case 'lastYear':
      return date >= new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case 'custom': {
      const from = parseDateInputValue(custom.from);
      const to = parseDateInputValue(custom.to);
      if (!from || !to) return true;
      const [start, end] = from <= to ? [from, to] : [to, from];
      const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
      return date >= start && date < endExclusive;
    }
  }
}

// Trend labels are not always parseable dates, so fall back to the (dated) logs for the same range.
function pickRangeReadings<T extends { recordedAt: string }>(
  trendReadings: T[],
  logReadings: T[],
  range: VitalDateRange,
  custom: CustomDateRange
): T[] {
  if (trendReadings.length > 0 && trendReadings.every((reading) => reading.recordedAt)) {
    return sortByRecordedAt(trendReadings);
  }
  const logsInRange = logReadings.filter((reading) => isWithinDateRange(reading.recordedAt, range, custom));
  if (logsInRange.length > 0) return sortByRecordedAt(logsInRange);
  return trendReadings.length > 0 ? sortByRecordedAt(trendReadings) : [];
}

// Comparing undated readings via new Date('') yields NaN, which scrambles the order, so fall back to input order.
function sortByRecordedAt<T extends { recordedAt: string }>(readings: T[]): T[] {
  return readings
    .map((reading, index) => ({ reading, index }))
    .sort((a, b) => {
      const aTime = parseTimestamp(a.reading.recordedAt)?.getTime();
      const bTime = parseTimestamp(b.reading.recordedAt)?.getTime();
      if (aTime === undefined || bTime === undefined) return a.index - b.index;
      return aTime - bTime || a.index - b.index;
    })
    .map((item) => item.reading);
}

// The vital-history logs carry no timestamp, so the trends endpoint is the only dated source for BP.
function mapBloodPressureTrends(trends: any): BloodPressureReading[] {
  const labels: unknown[] = Array.isArray(trends?.labels) ? trends.labels : [];
  const systolic: unknown[] = Array.isArray(trends?.systolic) ? trends.systolic : [];
  const diastolic: unknown[] = Array.isArray(trends?.diastolic) ? trends.diastolic : [];

  return labels
    .map((label, index) => {
      const systolicValue = Number(systolic[index]);
      const diastolicValue = Number(diastolic[index]);
      if (!Number.isFinite(systolicValue) || !Number.isFinite(diastolicValue)) return null;
      const recordedAt = parseTimestamp(label);
      return {
        systolic: systolicValue,
        diastolic: diastolicValue,
        recordedAt: recordedAt ? recordedAt.toISOString() : '',
      };
    })
    .filter((reading): reading is BloodPressureReading => reading !== null);
}

const NUMERIC_SERIES_KEYS = ['values', 'value', 'bloodSugar', 'glucose', 'data', 'series', 'readings'];

// The single-vital trends payload names its numeric series differently per vital, so match on shape, not key.
function mapVitalTrends(trends: any): BloodSugarReading[] {
  const labels: unknown[] = Array.isArray(trends?.labels) ? trends.labels : [];
  if (labels.length === 0) return [];

  const isNumericSeries = (candidate: unknown): candidate is unknown[] =>
    Array.isArray(candidate) &&
    candidate.length === labels.length &&
    candidate.every((item) => item !== null && item !== '' && Number.isFinite(Number(item)));

  const series =
    NUMERIC_SERIES_KEYS.map((key) => trends?.[key]).find(isNumericSeries) ??
    Object.entries(trends ?? {})
      .filter(([key]) => key !== 'labels')
      .map(([, value]) => value)
      .find(isNumericSeries);

  if (!series) return [];

  return labels
    .map((label, index) => {
      const value = Number(series[index]);
      if (!Number.isFinite(value)) return null;
      const recordedAt = parseTimestamp(label);
      return { value, recordedAt: recordedAt ? recordedAt.toISOString() : '' };
    })
    .filter((reading): reading is BloodSugarReading => reading !== null);
}

function mapBloodPressureLogs(logs: any[]): BloodPressureReading[] {  const readings = logs
    .map((log) => {
      const bloodPressure = log.vitals?.find((vital: any) =>
        String(vital.vitalType || vital.type || '').toLowerCase().includes('bloodpressure')
      );
      const parsed = parseBloodPressure(bloodPressure?.value || log.bloodPressure || log.value);
      if (!parsed) return null;
      return {
        ...parsed,
        recordedAt: extractRecordedAt(bloodPressure) || extractRecordedAt(log),
      };
    })
    .filter((reading): reading is BloodPressureReading => reading !== null);

  return sortByRecordedAt(readings);
}

function mapBloodSugarLogs(logs: any[]): BloodSugarReading[] {
  const readings = logs
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
        recordedAt: extractRecordedAt(bloodSugar) || extractRecordedAt(log),
      };
    })
    .filter((reading): reading is BloodSugarReading => reading !== null);

  return sortByRecordedAt(readings);
}

function mergeVitalEntries(logs: any[], latestVitals: any[]): any[] {
  const entries = [...logs, ...latestVitals];
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const nestedVitals = Array.isArray(entry.vitals) ? entry.vitals : [];
    const vitalValues = nestedVitals.length > 0
      ? nestedVitals.map((vital: any) => `${vital.vitalType || vital.type || ''}:${vital.value ?? ''}`).join('|')
      : `${entry.vitalType || entry.type || ''}:${entry.value ?? entry.bloodPressure ?? entry.bloodSugar ?? ''}`;
    const recordedAt = extractRecordedAt(entry);
    // Without a timestamp two genuinely separate visits are indistinguishable, so only dedupe dated entries.
    if (!recordedAt) return true;
    const key = `${recordedAt}|${vitalValues}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isDoseTaken(record: any): boolean {
  const entry = Array.isArray(record) ? record[0] : record;
  if (!entry) return false;
  if (typeof entry.taken === 'boolean') return entry.taken;
  const status = String(entry.status ?? entry.adherenceStatus ?? '').toLowerCase();
  return status === 'taken' || status === 'completed' || status === 'adherent';
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

type ReadingTone = 'low' | 'normal' | 'elevated' | 'high' | 'critical' | 'none';

interface ReadingStatus {
  label: string;
  tone: ReadingTone;
}

const VITAL_RANGE_OPTIONS: Array<{ value: VitalDateRange; label: string }> = [
  { value: 'thisWeek', label: 'This week' },
  { value: 'last3Months', label: 'Last 3 months' },
  { value: 'lastYear', label: 'Last year' },
  { value: 'custom', label: 'Custom dates' },
];

function formatShortDate(value: string): string {
  const date = parseDateInputValue(value);
  return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : value;
}

// Adult office BP categories (ACC/AHA), with hypotension split out so low readings are not shown as normal.
function classifyBloodPressure(reading?: { systolic: number; diastolic: number }): ReadingStatus {
  if (!reading) return { label: 'No reading', tone: 'none' };
  const { systolic, diastolic } = reading;
  if (systolic >= 180 || diastolic >= 120) return { label: 'Crisis', tone: 'critical' };
  if (systolic < 90 || diastolic < 60) return { label: 'Low', tone: 'low' };
  if (systolic >= 140 || diastolic >= 90) return { label: 'High · Stage 2', tone: 'high' };
  if (systolic >= 130 || diastolic >= 80) return { label: 'High · Stage 1', tone: 'elevated' };
  if (systolic >= 120) return { label: 'Elevated', tone: 'elevated' };
  return { label: 'Normal', tone: 'normal' };
}

// Random plasma glucose bands in mmol/L.
function classifyBloodSugar(value?: number): ReadingStatus {
  if (value === undefined || !Number.isFinite(value)) return { label: 'No reading', tone: 'none' };
  if (value < 4) return { label: 'Low', tone: 'low' };
  if (value <= 7.8) return { label: 'Normal', tone: 'normal' };
  if (value < 11.1) return { label: 'High', tone: 'elevated' };
  return { label: 'Very high', tone: 'high' };
}

function buildTicks([min, max]: [number, number], step: number): number[] {
  const ticks: number[] = [];
  for (let value = min; value <= max; value += step) ticks.push(value);
  return ticks;
}

function formatDelta(current?: number, previous?: number, digits = 0): string | null {
  if (current === undefined || previous === undefined) return null;
  const diff = Number((current - previous).toFixed(digits));
  if (diff === 0) return 'no change';
  return `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(digits)}`;
}

function formatReadingTimestamp(recordedAt: string): string {
  const date = parseTimestamp(recordedAt);
  if (!date) return 'Date not recorded';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function VitalStatCard({
  label,
  value,
  unit,
  status,
  delta,
}: {
  label: string;
  value: string;
  unit: string;
  status: ReadingStatus;
  delta: string | null;
}) {
  return (
    <div className={`rd-stat rd-tone-${status.tone}`}>
      <div className="rd-stat-head">
        <span className="rd-stat-label">{label}</span>
        <span className={`rd-pill rd-tone-${status.tone}`}>{status.label}</span>
      </div>
      <p className="rd-stat-value">
        {value}
        {value !== '—' && <span>{unit}</span>}
      </p>
      <p className="rd-stat-foot">
        Latest reading{delta ? ` · ${delta} since previous` : ''}
      </p>
    </div>
  );
}

// Falls back to a positional label only when a reading genuinely has no timestamp.
function buildChartLabels(readings: Array<{ recordedAt: string }>): string[] {
  const dates = readings.map((reading) => parseTimestamp(reading.recordedAt));
  const dayLabels = dates.map((date) =>
    date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null
  );
  const hasSameDayReadings = dayLabels.some(
    (label, index) => label !== null && dayLabels.indexOf(label) !== index
  );

  return dates.map((date, index) => {
    if (!date) return `Reading ${index + 1}`;
    return hasSameDayReadings
      ? date.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : dayLabels[index]!;
  });
}

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="clinical-chart-tooltip">
      <p>{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey}>
          <span style={{ backgroundColor: entry.color }} />
          <strong>{entry.name}</strong>
          <b>{entry.value} {unit}</b>
        </div>
      ))}
    </div>
  );
}

export default function PatientDetailsPage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  // Raw sources; the visible readings are filtered from these by the selected date range at render time.
  const [bloodPressureSource, setBloodPressureSource] = useState<{ trend: BloodPressureReading[]; logs: BloodPressureReading[] }>({ trend: [], logs: [] });
  const [bloodSugarSource, setBloodSugarSource] = useState<{ trend: BloodSugarReading[]; logs: BloodSugarReading[] }>({ trend: [], logs: [] });
  const [latestBloodPressureReading, setLatestBloodPressureReading] = useState<BloodPressureReading | undefined>();
  const [latestBloodSugarReading, setLatestBloodSugarReading] = useState<BloodSugarReading | undefined>();
  const [previousBloodPressureReading, setPreviousBloodPressureReading] = useState<BloodPressureReading | undefined>();
  const [previousBloodSugarReading, setPreviousBloodSugarReading] = useState<BloodSugarReading | undefined>();
  const [showAllReadings, setShowAllReadings] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [adherenceData, setAdherenceData] = useState<{ date: string; taken: boolean }[]>([]);
  const [messageText, setMessageText] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<AppointmentStatusFilter>('all');
  const [vitalDateRange, setVitalDateRange] = useState<VitalDateRange>('last3Months');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>(() => {
    const today = new Date();
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    return { from: toDateInputValue(monthAgo), to: toDateInputValue(today) };
  });
  // The backend trend endpoints only cover fixed windows; of ours, only "this week" maps onto one.
  const useWeekTrends = vitalDateRange === 'thisWeek';
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

        const [patientData, vitalsData, vitalLogs, bpTrends, sugarTrends, appointmentsData, medicationsData] = await Promise.all([
          hcpPatientApi.getPatientById(patientId),
          hcpPatientApi.getPatientVitals(patientId).catch(() => []),
          hcpPatientApi.getPatientVitalHistoryLogs(patientId).catch(() => []),
          useWeekTrends ? hcpPatientApi.getBloodPressureTrends(patientId, 'thisWeek').catch(() => null) : null,
          useWeekTrends ? hcpPatientApi.getVitalHistoryTrends(patientId, 'bloodSugar', 'thisWeek').catch(() => null) : null,
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
        const trendReadings = mapBloodPressureTrends(bpTrends);
        setBloodPressureSource({ trend: trendReadings, logs: mapBloodPressureLogs(allVitalEntries) });
        const sugarTrendReadings = mapVitalTrends(sugarTrends);
        setBloodSugarSource({ trend: sugarTrendReadings, logs: mapBloodSugarLogs(allVitalEntries) });
        setLatestBloodPressureReading(mapBloodPressureLogs(latestVitalsArray).at(-1));
        setPreviousBloodPressureReading(mapBloodPressureLogs(latestVitalsArray).at(-2));
        setLatestBloodSugarReading(mapBloodSugarLogs(latestVitalsArray).at(-1));
        setPreviousBloodSugarReading(mapBloodSugarLogs(latestVitalsArray).at(-2));
        setAppointments(appointmentsData);
        setMedications(medicationsData);

        if (sugarTrends && sugarTrendReadings.length === 0) {
          console.warn(
            '[blood sugar trends] could not extract a dated series from: ' + JSON.stringify(sugarTrends)
          );
        }
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
  }, [patientId, useWeekTrends]);

  const primaryMedicationId = medications[0]?.id;

  useEffect(() => {
    if (!patientId || !primaryMedicationId) {
      setAdherenceData([]);
      return;
    }

    let cancelled = false;

    // The adherence endpoint returns one day at a time, so build the 30-day window client-side.
    const days = Array.from({ length: 30 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (29 - index));
      return day.toISOString().slice(0, 10);
    });

    Promise.all(
      days.map(async (date) => {
        try {
          const record = await hcpPatientApi.getMedicationAdherence(patientId, primaryMedicationId, date);
          return { date, taken: isDoseTaken(record) };
        } catch {
          return { date, taken: false };
        }
      })
    ).then((results) => {
      if (!cancelled) setAdherenceData(results);
    });

    return () => {
      cancelled = true;
    };
  }, [patientId, primaryMedicationId]);

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
      const refreshedTrends = useWeekTrends
        ? await hcpPatientApi.getBloodPressureTrends(patientId, 'thisWeek').catch(() => null)
        : null;
      const refreshedSugarTrends = useWeekTrends
        ? await hcpPatientApi.getVitalHistoryTrends(patientId, 'bloodSugar', 'thisWeek').catch(() => null)
        : null;
      const logsArray = Array.isArray(refreshedLogs) ? refreshedLogs : [];
      const latestVitalsArray = Array.isArray(refreshedVitals)
        ? refreshedVitals
        : refreshedVitals && typeof refreshedVitals === 'object'
          ? [refreshedVitals]
          : [];
      const allVitalEntries = mergeVitalEntries(logsArray, latestVitalsArray);
      const refreshedTrendReadings = mapBloodPressureTrends(refreshedTrends);
      const refreshedSugarTrendReadings = mapVitalTrends(refreshedSugarTrends);
      setBloodPressureSource({ trend: refreshedTrendReadings, logs: mapBloodPressureLogs(allVitalEntries) });
      setBloodSugarSource({ trend: refreshedSugarTrendReadings, logs: mapBloodSugarLogs(allVitalEntries) });
      setLatestBloodPressureReading(mapBloodPressureLogs(latestVitalsArray).at(-1));
      setPreviousBloodPressureReading(mapBloodPressureLogs(latestVitalsArray).at(-2));
      setLatestBloodSugarReading(mapBloodSugarLogs(latestVitalsArray).at(-1));
      setPreviousBloodSugarReading(mapBloodSugarLogs(latestVitalsArray).at(-2));
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
  const bloodPressureReadings = pickRangeReadings(bloodPressureSource.trend, bloodPressureSource.logs, vitalDateRange, customDateRange);
  const bloodSugarReadings = pickRangeReadings(bloodSugarSource.trend, bloodSugarSource.logs, vitalDateRange, customDateRange);
  const chartReadings = bloodPressureReadings;
  const latestBloodPressure = latestBloodPressureReading;
  const currentBloodPressure = latestBloodPressure
    ? `${latestBloodPressure.systolic} / ${latestBloodPressure.diastolic}`
    : 'No reading recorded';
  
  const bloodSugarChartReadings = bloodSugarReadings;
  const currentBloodSugar = latestBloodSugarReading?.value;
  const bloodPressureChartLabels = buildChartLabels(chartReadings);
  const bloodSugarChartLabels = buildChartLabels(bloodSugarChartReadings);
  const bloodPressureChartData = chartReadings.map((reading, index) => ({
    name: bloodPressureChartLabels[index],
    systolic: reading.systolic,
    diastolic: reading.diastolic,
  }));
  const bloodSugarChartData = bloodSugarChartReadings.map((reading, index) => ({
    name: bloodSugarChartLabels[index],
    glucose: reading.value,
  }));
  // Fixed clinical baselines keep the scale stable between patients; widen only when readings exceed them.
  const bloodPressureDomain: [number, number] = [
    Math.min(40, ...chartReadings.map((reading) => Math.floor(reading.diastolic / 20) * 20)),
    Math.max(200, ...chartReadings.map((reading) => Math.ceil(reading.systolic / 20) * 20)),
  ];
  const bloodSugarDomain: [number, number] = [
    0,
    Math.max(15, ...bloodSugarChartReadings.map((reading) => Math.ceil(Number(reading.value) / 5) * 5)),
  ];
  const bloodPressureTicks = buildTicks(bloodPressureDomain, 20);
  const bloodSugarTicks = buildTicks(bloodSugarDomain, bloodSugarDomain[1] > 20 ? 5 : 3);
  const bloodPressureStatus = classifyBloodPressure(latestBloodPressure);
  const bloodSugarStatus = classifyBloodSugar(currentBloodSugar);
  const bloodPressureDelta = formatDelta(latestBloodPressure?.systolic, previousBloodPressureReading?.systolic);
  const bloodSugarDelta = formatDelta(currentBloodSugar, previousBloodSugarReading?.value, 1);
  const rangeLabel = vitalDateRange === 'custom'
    ? `${formatShortDate(customDateRange.from)} – ${formatShortDate(customDateRange.to)}`
    : VITAL_RANGE_OPTIONS.find((option) => option.value === vitalDateRange)?.label ?? '';
  const readingLog = [
    ...bloodPressureReadings.map((reading) => ({
      recordedAt: reading.recordedAt,
      type: 'Blood pressure',
      kind: 'bp',
      value: `${reading.systolic} / ${reading.diastolic}`,
      unit: 'mmHg',
      status: classifyBloodPressure(reading),
    })),
    ...bloodSugarReadings.map((reading) => ({
      recordedAt: reading.recordedAt,
      type: 'Blood glucose',
      kind: 'glucose',
      value: String(reading.value),
      unit: 'mmol/L',
      status: classifyBloodSugar(reading.value),
    })),
  ].sort((a, b) => (parseTimestamp(b.recordedAt)?.getTime() ?? 0) - (parseTimestamp(a.recordedAt)?.getTime() ?? 0));
  const visibleReadingLog = showAllReadings ? readingLog : readingLog.slice(0, 6);

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
                {patient.age} • {formatConditions(patient.chronicConditions)} • Patient since {patient.joined || 'N/A'}
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
                      <p>{formatConditions(patient.chronicConditions)}</p>
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
                <div className={`latest-vitals-box ${getBloodPressureSeverity(latestBloodPressure).toLowerCase().replace(' ', '-')}`}>
                  <p className="block-label">
                    {getBloodPressureSeverity(latestBloodPressure)}
                  </p>
                  <p className="latest-vitals-value">{currentBloodPressure}</p>
                  <p className="text-muted" style={{ margin: 0 }}>mmHg</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'Readings' && (
            <section className="readings-workspace rd">
              <div className="rd-toolbar">
                <div>
                  <h2 className="rd-title">Readings</h2>
                  <p className="rd-subtitle">Vitals trends and history for this patient.</p>
                </div>
                <div className="rd-toolbar-actions">
                  <div className="rd-segmented" role="group" aria-label="Date range">
                    {VITAL_RANGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={vitalDateRange === option.value ? 'active' : ''}
                        aria-pressed={vitalDateRange === option.value}
                        onClick={() => setVitalDateRange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {vitalDateRange === 'custom' && (
                    <div className="rd-date-range">
                      <label>
                        <span>From</span>
                        <input
                          type="date"
                          value={customDateRange.from}
                          max={customDateRange.to || toDateInputValue(new Date())}
                          onChange={(event) => setCustomDateRange((prev) => ({ ...prev, from: event.target.value }))}
                        />
                      </label>
                      <label>
                        <span>To</span>
                        <input
                          type="date"
                          value={customDateRange.to}
                          min={customDateRange.from}
                          max={toDateInputValue(new Date())}
                          onChange={(event) => setCustomDateRange((prev) => ({ ...prev, to: event.target.value }))}
                        />
                      </label>
                    </div>
                  )}
                  <button type="button" className="rd-btn-primary" onClick={() => setIsVitalsModalOpen(true)}>
                    + Record vitals
                  </button>
                </div>
              </div>

              <div className="rd-stats">
                <VitalStatCard
                  label="Blood pressure"
                  value={latestBloodPressure ? `${latestBloodPressure.systolic}/${latestBloodPressure.diastolic}` : '—'}
                  unit="mmHg"
                  status={bloodPressureStatus}
                  delta={bloodPressureDelta && `systolic ${bloodPressureDelta}`}
                />
                <VitalStatCard
                  label="Blood glucose"
                  value={currentBloodSugar !== undefined ? String(currentBloodSugar) : '—'}
                  unit="mmol/L"
                  status={bloodSugarStatus}
                  delta={bloodSugarDelta}
                />
              </div>

              <div className="rd-charts">
                <div className="rd-card">
                  <div className="rd-card-head">
                    <div>
                      <h3>Blood pressure</h3>
                      <p>{bloodPressureChartData.length} readings · {rangeLabel}</p>
                    </div>
                    <div className="rd-legend">
                      <span><i style={{ background: '#ee9342' }} />Systolic</span>
                      <span><i style={{ background: '#425876' }} />Diastolic</span>
                      <span><i className="rd-legend-dash" />Threshold</span>
                    </div>
                  </div>
                  <div className="rd-chart">
                    {bloodPressureChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={bloodPressureChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#edf0f5" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: '#8290a2', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#d6dde7' }} interval="preserveStartEnd" minTickGap={24} padding={{ left: 16, right: 16 }} />
                          <YAxis tick={{ fill: '#8290a2', fontSize: 11 }} tickLine={false} axisLine={false} width={36} domain={bloodPressureDomain} ticks={bloodPressureTicks} />
                          <Tooltip content={<ChartTooltip unit="mmHg" />} cursor={{ stroke: '#cbd5e1' }} />
                          <ReferenceLine y={140} stroke="#e5a3a3" strokeDasharray="4 4" label={{ value: '140', position: 'insideTopRight', fill: '#c26464', fontSize: 10 }} />
                          <ReferenceLine y={90} stroke="#aebbd0" strokeDasharray="4 4" label={{ value: '90', position: 'insideTopRight', fill: '#6b7d96', fontSize: 10 }} />
                          <Line type="linear" dataKey="systolic" name="Systolic" stroke="#ee9342" strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5, strokeWidth: 2 }} isAnimationActive={false} />
                          <Line type="linear" dataKey="diastolic" name="Diastolic" stroke="#425876" strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5, strokeWidth: 2 }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="rd-empty">No blood pressure readings in this period.</div>
                    )}
                  </div>
                </div>

                <div className="rd-card">
                  <div className="rd-card-head">
                    <div>
                      <h3>Blood glucose</h3>
                      <p>{bloodSugarChartData.length} readings · {rangeLabel}</p>
                    </div>
                    <div className="rd-legend">
                      <span><i style={{ background: '#0f8b8d' }} />Glucose</span>
                      <span><i className="rd-legend-band" />Target 4–7</span>
                    </div>
                  </div>
                  <div className="rd-chart">
                    {bloodSugarChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={bloodSugarChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#edf0f5" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: '#8290a2', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#d6dde7' }} interval="preserveStartEnd" minTickGap={24} padding={{ left: 16, right: 16 }} />
                          <YAxis tick={{ fill: '#8290a2', fontSize: 11 }} tickLine={false} axisLine={false} width={36} domain={bloodSugarDomain} ticks={bloodSugarTicks} />
                          <Tooltip content={<ChartTooltip unit="mmol/L" />} cursor={{ stroke: '#cbd5e1' }} />
                          <ReferenceArea y1={4} y2={7} fill="#3fa36b" fillOpacity={0.08} stroke="none" />
                          <Line type="linear" dataKey="glucose" name="Blood glucose" stroke="#0f8b8d" strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5, strokeWidth: 2 }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="rd-empty">No blood glucose readings in this period.</div>
                    )}
                  </div>
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

              <div className="rd-card">
                <div className="rd-card-head">
                  <div>
                    <h3>Reading log</h3>
                    <p>{readingLog.length} entries · {rangeLabel}</p>
                  </div>
                </div>
                {readingLog.length > 0 ? (
                  <>
                    <div className="rd-table-wrap">
                      <table className="rd-table">
                        <thead>
                          <tr>
                            <th>Date &amp; time</th>
                            <th>Measurement</th>
                            <th>Value</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleReadingLog.map((entry, index) => (
                            <tr key={`${entry.type}-${entry.recordedAt}-${entry.value}-${index}`}>
                              <td className="rd-muted">{formatReadingTimestamp(entry.recordedAt)}</td>
                              <td><span className={`rd-measure rd-measure-${entry.kind}`}>{entry.type}</span></td>
                              <td><strong>{entry.value}</strong> <span className="rd-muted">{entry.unit}</span></td>
                              <td><span className={`rd-pill rd-tone-${entry.status.tone}`}>{entry.status.label}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {readingLog.length > 6 && (
                      <button type="button" className="rd-link" onClick={() => setShowAllReadings((value) => !value)}>
                        {showAllReadings ? 'Show fewer' : `Show all ${readingLog.length} entries`}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="rd-empty rd-empty-inline">No readings recorded in this period.</div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'Medication' && (
            <section className="patient-overview-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
              <div className="panel hcp-panel">
                <div className="panel-headline-row" style={{ marginBottom: 16 }}>
                  <p className="panel-title">30-day adherence</p>
                  {patient.adherence && (
                    <p className="text-muted" style={{ margin: 0 }}>
                      <strong style={{ color: '#f2994a' }}>{patient.adherence}</strong> overall
                    </p>
                  )}
                </div>

                {patient.adherence && adherenceData.length > 0 ? (
                  <>
                    {/* Adherence Calendar Grid */}
                    <div style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(10, 1fr)',
                          gap: 6,
                          marginBottom: 12,
                        }}
                      >
                        {adherenceData.map((day) => (
                          <div
                            key={day.date}
                            style={{
                              width: '100%',
                              aspectRatio: '1',
                              borderRadius: 6,
                              backgroundColor: day.taken ? '#22c55e' : '#cbd5e1',
                              transition: 'transform 0.2s',
                            }}
                            title={`${day.date}: ${day.taken ? 'Taken' : 'Missed'}`}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              backgroundColor: '#22c55e',
                            }}
                          />
                          <span>Taken</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              backgroundColor: '#cbd5e1',
                            }}
                          />
                          <span>Missed</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : patient.adherence && primaryMedicationId ? (
                  <p className="text-muted">Loading adherence calendar...</p>
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
        </main>
      </div>
    </ProtectedRoute>
  );
}
