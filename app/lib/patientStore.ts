import { patientDetail, patientList } from './dummy';

export type PatientStatus = 'Critical' | 'Caution' | 'Silent' | 'Stable';

export interface PatientRecord {
  id: string;
  name: string;
  initials: string;
  age: number;
  condition: string;
  lastCheckIn: string;
  adherence: string;
  status: PatientStatus;
  ghanaCard?: string;
  nhis?: string;
  facility?: string;
  joined?: string;
}

export interface VitalEntry {
  id: string;
  patientId: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  temperature?: number;
  weightKg?: number;
  note: string;
  takenAt: string;
}

interface RegisterPatientInput {
  fullName: string;
  age: number;
  condition: string;
  ghanaCard?: string;
  nhis?: string;
  facility?: string;
}

interface UpdatePatientInput {
  fullName?: string;
  age?: number;
  condition?: string;
  ghanaCard?: string;
  nhis?: string;
  facility?: string;
}

interface AddVitalInput {
  systolic: number;
  diastolic: number;
  pulse?: number;
  temperature?: number;
  weightKg?: number;
  note?: string;
}

const PATIENTS_KEY = 'hcp-patients';
const VITALS_KEY = 'hcp-vitals';

function toPatientStatus(status: string): PatientStatus {
  if (status === 'Critical' || status === 'Caution' || status === 'Silent' || status === 'Stable') {
    return status;
  }
  return 'Silent';
}

const basePatients: PatientRecord[] = patientList.map((patient) => ({
  ...patient,
  status: toPatientStatus(patient.status),
  ghanaCard: patient.id === 'akua-mensah' ? patientDetail.ghanaCard : undefined,
  nhis: patient.id === 'akua-mensah' ? patientDetail.nhis : undefined,
  facility: patient.id === 'akua-mensah' ? patientDetail.facility : 'Kumasi South Hospital',
  joined: patient.id === 'akua-mensah' ? patientDetail.joined : '2025',
}));

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function buildInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  const initials = parts.map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return initials || 'PT';
}

function deriveStatusFromVital(systolic: number, diastolic: number): PatientStatus {
  if (systolic >= 160 || diastolic >= 100) {
    return 'Critical';
  }
  if (systolic >= 140 || diastolic >= 90) {
    return 'Caution';
  }
  return 'Stable';
}

function getStoredPatients(): PatientRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeJsonParse<PatientRecord[]>(window.localStorage.getItem(PATIENTS_KEY), []);
}

function setStoredPatients(patients: PatientRecord[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(PATIENTS_KEY, JSON.stringify(patients));
}

function getStoredVitals(): VitalEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeJsonParse<VitalEntry[]>(window.localStorage.getItem(VITALS_KEY), []);
}

function setStoredVitals(vitals: VitalEntry[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(VITALS_KEY, JSON.stringify(vitals));
}

export function getAllPatients(): PatientRecord[] {
  const stored = getStoredPatients();
  const byId = new Map<string, PatientRecord>();

  for (const patient of basePatients) {
    byId.set(patient.id, patient);
  }

  for (const patient of stored) {
    byId.set(patient.id, patient);
  }

  return Array.from(byId.values());
}

export function getPatientById(id: string): PatientRecord | undefined {
  return getAllPatients().find((patient) => patient.id === id);
}

export function registerPatient(input: RegisterPatientInput): PatientRecord {
  const nowIso = new Date().toISOString();
  const patient: PatientRecord = {
    id: `${slugifyName(input.fullName)}-${Date.now()}`,
    name: input.fullName.trim(),
    initials: buildInitials(input.fullName),
    age: input.age,
    condition: input.condition,
    lastCheckIn: 'Not yet',
    adherence: 'N/A',
    status: 'Silent',
    ghanaCard: input.ghanaCard?.trim() || undefined,
    nhis: input.nhis?.trim() || undefined,
    facility: input.facility?.trim() || 'Kumasi South Hospital',
    joined: nowIso.slice(0, 10),
  };

  const patients = getStoredPatients();
  patients.unshift(patient);
  setStoredPatients(patients);

  return patient;
}

export function updatePatientDetails(patientId: string, input: UpdatePatientInput): PatientRecord | undefined {
  const existingPatient = getPatientById(patientId);
  if (!existingPatient) {
    return undefined;
  }

  const nextName = (input.fullName || existingPatient.name).trim();
  const updatedPatient: PatientRecord = {
    ...existingPatient,
    name: nextName,
    initials: buildInitials(nextName),
    age: input.age ?? existingPatient.age,
    condition: (input.condition || existingPatient.condition).trim(),
    ghanaCard: input.ghanaCard !== undefined ? input.ghanaCard.trim() || undefined : existingPatient.ghanaCard,
    nhis: input.nhis !== undefined ? input.nhis.trim() || undefined : existingPatient.nhis,
    facility: input.facility !== undefined ? input.facility.trim() || undefined : existingPatient.facility,
  };

  const storedPatients = getStoredPatients();
  const existingStoredIndex = storedPatients.findIndex((patient) => patient.id === patientId);

  if (existingStoredIndex >= 0) {
    storedPatients[existingStoredIndex] = updatedPatient;
  } else {
    storedPatients.unshift(updatedPatient);
  }

  setStoredPatients(storedPatients);
  return updatedPatient;
}

export function getVitalsForPatient(patientId: string): VitalEntry[] {
  return getStoredVitals()
    .filter((entry) => entry.patientId === patientId)
    .sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
}

export function addVital(patientId: string, input: AddVitalInput): VitalEntry {
  const nowIso = new Date().toISOString();
  const entry: VitalEntry = {
    id: `${patientId}-${Date.now()}`,
    patientId,
    systolic: input.systolic,
    diastolic: input.diastolic,
    pulse: input.pulse,
    temperature: input.temperature,
    weightKg: input.weightKg,
    note: input.note?.trim() || 'Captured by health worker',
    takenAt: nowIso,
  };

  const vitals = getStoredVitals();
  vitals.unshift(entry);
  setStoredVitals(vitals);

  const patients = getStoredPatients();
  const patientIndex = patients.findIndex((patient) => patient.id === patientId);

  if (patientIndex >= 0) {
    patients[patientIndex] = {
      ...patients[patientIndex],
      status: deriveStatusFromVital(input.systolic, input.diastolic),
      lastCheckIn: 'Just now',
    };
    setStoredPatients(patients);
  }

  return entry;
}
