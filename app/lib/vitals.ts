// Shared definitions for the vital signs the backend accepts (VitalHistoryInputDto.vitalType).
// Thresholds are general adult screening ranges used to flag readings for review, not diagnoses.

export type VitalType =
  | 'bloodPressure'
  | 'bloodSugar'
  | 'heartRate'
  | 'temperature'
  | 'oxygenSaturation'
  | 'respirationRate'
  | 'weight';

/** Matches the backend's severity enum. */
export type VitalSeverity = 'normal' | 'elevated' | 'critical';

export interface VitalDefinition {
  type: VitalType;
  label: string;
  unit: string;
  placeholder: string;
  /** Short hint shown under the input. */
  hint: string;
}

export const VITAL_DEFINITIONS: VitalDefinition[] = [
  { type: 'bloodPressure', label: 'Blood pressure', unit: 'mmHg', placeholder: '120/80', hint: 'Systolic/diastolic' },
  { type: 'bloodSugar', label: 'Blood sugar', unit: 'mmol/L', placeholder: '5.6', hint: 'Random glucose' },
  { type: 'heartRate', label: 'Heart rate', unit: 'bpm', placeholder: '72', hint: 'Beats per minute' },
  { type: 'temperature', label: 'Temperature', unit: '°C', placeholder: '36.8', hint: 'Body temperature' },
  { type: 'oxygenSaturation', label: 'Oxygen saturation', unit: '%', placeholder: '98', hint: 'SpO₂' },
  { type: 'respirationRate', label: 'Respiration rate', unit: 'breaths/min', placeholder: '16', hint: 'Breaths per minute' },
  { type: 'weight', label: 'Weight', unit: 'kg', placeholder: '70', hint: 'Kilograms' },
];

export const VITAL_BY_TYPE = Object.fromEntries(VITAL_DEFINITIONS.map((definition) => [definition.type, definition])) as Record<
  VitalType,
  VitalDefinition
>;

export function isVitalType(value: unknown): value is VitalType {
  return typeof value === 'string' && value in VITAL_BY_TYPE;
}

/** Returns `{ systolic, diastolic }` for values like "120/80" or "120 / 80". */
export function parseBloodPressure(value: string): { systolic: number; diastolic: number } | null {
  const match = value.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
  if (!match) return null;
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

/** Returns an error message for an invalid entry, or null when the value is acceptable. */
export function validateVitalValue(type: VitalType, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (type === 'bloodPressure') {
    const reading = parseBloodPressure(value);
    if (!reading) return 'Enter as systolic/diastolic, e.g. 120/80.';
    if (reading.systolic <= reading.diastolic) return 'Systolic should be higher than diastolic.';
    if (reading.systolic > 300 || reading.diastolic < 20) return 'This reading looks out of range.';
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 'Enter a number.';

  const limits: Record<Exclude<VitalType, 'bloodPressure'>, [number, number]> = {
    bloodSugar: [0.5, 50],
    heartRate: [20, 250],
    temperature: [30, 45],
    oxygenSaturation: [40, 100],
    respirationRate: [4, 70],
    weight: [1, 400],
  };
  const [min, max] = limits[type];
  if (number < min || number > max) return `Expected between ${min} and ${max} ${VITAL_BY_TYPE[type].unit}.`;
  return null;
}

/** Flags a reading so the backend and UI can highlight values that need attention. */
export function classifyVital(type: VitalType, raw: string): VitalSeverity {
  if (type === 'bloodPressure') {
    const reading = parseBloodPressure(raw);
    if (!reading) return 'normal';
    const { systolic, diastolic } = reading;
    if (systolic >= 180 || diastolic >= 120 || systolic < 90 || diastolic < 60) return 'critical';
    if (systolic >= 130 || diastolic >= 80) return 'elevated';
    return 'normal';
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) return 'normal';

  switch (type) {
    case 'bloodSugar':
      if (value < 4 || value >= 11.1) return 'critical';
      return value > 7.8 ? 'elevated' : 'normal';
    case 'heartRate':
      if (value < 50 || value > 120) return 'critical';
      return value > 100 || value < 60 ? 'elevated' : 'normal';
    case 'temperature':
      if (value < 35 || value >= 39) return 'critical';
      return value >= 37.5 ? 'elevated' : 'normal';
    case 'oxygenSaturation':
      if (value < 92) return 'critical';
      return value < 95 ? 'elevated' : 'normal';
    case 'respirationRate':
      if (value < 10 || value > 24) return 'critical';
      return value > 20 || value < 12 ? 'elevated' : 'normal';
    default:
      return 'normal';
  }
}

export const SEVERITY_LABEL: Record<VitalSeverity, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  critical: 'Critical',
};

export function normalizeSeverity(value: unknown): VitalSeverity | null {
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  if (lower === 'normal' || lower === 'elevated' || lower === 'critical') return lower;
  if (lower === 'warning' || lower === 'high') return 'elevated';
  return null;
}
