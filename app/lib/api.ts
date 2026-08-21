// API Configuration and Service Layer
import { decodeJWT } from './jwt';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://dnh-server-staging.up.railway.app';

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    personnelId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: 'health-worker' | 'pharmacy-personnel';
    facilityId?: string;
    facility?: {
      id: string;
      name: string;
    };
    needsOnboarding?: boolean;
  };
}

export interface Patient {
  id: string;
  patientCode?: string;
  firstName: string;
  lastName: string;
  name?: string;
  age: number;
  gender?: string;
  height?: number;
  weight?: number;
  bmi?: number;
  chronicConditions: string[];
  lastCheckIn?: string;
  lastCheckInAt?: string;
  adherence?: string;
  status?: string;
  ghanaCard?: string;
  nhis?: string;
  facility?: string;
  joined?: string;
  criticalReadingsCount?: number;
  assignedToYou?: boolean;
  vitals?: {
    systolic: number;
    diastolic: number;
    note: string;
  };
  bloodSugar?: number;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  dateTime: string;
  type: string;
  location?: string;
  note?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'active';
  title?: string;
  description?: string;
}

export interface PatientQueryOptions {
  search?: string;
  searchFields?: string[];
  page?: number;
  pageSize?: number;
  filterBy?: 'hypertension' | 'diabetes' | 'both' | 'critical' | 'silent' | 'stable';
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  facilityId?: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  adherence?: string;
}

export interface PharmacyAnalytics {
  patientsCount: number;
  vitalsRecordedCount: number;
  referralsCount: number;
}

export interface PharmacyVitalHistory {
  id: string;
  patientId: string;
  patientName: string;
  patientCode?: string;
  recordedAt: string;
}

interface AuthTokenPayload {
  personnelId?: string;
  token?: string;
}

function mapAppointment(row: any, patientId?: string): Appointment {
  return {
    id: row.id,
    patientId: patientId || row.patient?.id || '',
    patientName: row.patient?.name || row.hostPersonnel?.userName || '',
    dateTime: row.appointmentDate,
    type: row.title || 'Appointment',
    note: row.description,
    status: row.status || 'scheduled',
    title: row.title,
    description: row.description,
  };
}

/** Normalize Ghana local numbers (0XXXXXXXXX) to E.164 (+233XXXXXXXXX). */
export function normalizePhoneNumber(phone: string): string {
  const trimmed = phone.trim().replace(/[\s\-()]/g, '');
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('233') && trimmed.length >= 12) return `+${trimmed}`;
  if (trimmed.startsWith('0') && trimmed.length >= 10) return `+233${trimmed.slice(1)}`;
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

function capitalizeStatus(status?: string): string {
  if (!status) return 'Stable';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function splitName(fullName?: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function formatRelativeDate(iso?: string): string {
  if (!iso) return 'N/A';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString();
}

function deriveAge(raw: any): number {
  if (typeof raw.age === 'number' && raw.age > 0) {
    return raw.age;
  }

  if (typeof raw.yearOfBirth === 'number' && raw.yearOfBirth > 1900) {
    return Math.max(0, new Date().getFullYear() - raw.yearOfBirth);
  }

  if (typeof raw.dateOfBirth === 'string' && raw.dateOfBirth.trim()) {
    const parsed = new Date(raw.dateOfBirth);
    if (!Number.isNaN(parsed.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - parsed.getFullYear();
      const monthDiff = today.getMonth() - parsed.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
        age--;
      }
      return Math.max(0, age);
    }
  }

  return 0;
}

function mapPatient(raw: any): Patient {
  const name = raw.name || [raw.firstName, raw.lastName].filter(Boolean).join(' ') || 'Unknown';
  const { firstName, lastName } = raw.firstName
    ? { firstName: raw.firstName, lastName: raw.lastName || '' }
    : splitName(name);

  const conditions = Array.isArray(raw.chronicConditions)
    ? raw.chronicConditions
    : typeof raw.chronicConditions === 'string' && raw.chronicConditions
      ? [raw.chronicConditions]
      : [];

  const adherenceRate = raw.adherenceRate ?? raw.adherence;
  const adherence =
    typeof adherenceRate === 'number'
      ? `${Math.round(adherenceRate)}%`
      : adherenceRate || undefined;

  return {
    id: String(raw.id || raw._id || raw.patientId || ''),
    firstName,
    lastName,
    name,
    age: deriveAge(raw),
    chronicConditions: conditions,
    lastCheckIn: formatRelativeDate(raw.lastCheckInDate || raw.lastCheckIn),
    lastCheckInAt: raw.lastCheckInDate || raw.lastCheckIn,
    adherence,
    status: capitalizeStatus(raw.adherenceStatus || raw.status),
    patientCode: raw.patientCode,
    gender: raw.gender,
    height: typeof raw.height === 'number' ? raw.height : undefined,
    weight: typeof raw.weight === 'number' ? raw.weight : undefined,
    bmi: typeof raw.bmi === 'number' ? raw.bmi : undefined,
    ghanaCard: raw.ghanaCardNumber || raw.ghanaCard,
    nhis: raw.nhisNumber || raw.nhis,
    facility: raw.facility?.name || raw.facility,
    criticalReadingsCount: typeof raw.criticalReadingsCount === 'number' ? raw.criticalReadingsCount : undefined,
    assignedToYou: typeof raw.assignedToYou === 'boolean' ? raw.assignedToYou : undefined,
    bloodSugar: typeof raw.bloodSugar === 'number' ? raw.bloodSugar : undefined,
  };
}

function mapRole(role?: string): 'health-worker' | 'pharmacy-personnel' {
  if (role === 'pharmacy-personnel' || role === 'pharmacy') {
    return 'pharmacy-personnel';
  }
  return 'health-worker';
}

function hasCompletedOnboarding(profile: any, role: 'health-worker' | 'pharmacy-personnel'): boolean {
  if (profile?.facility) return true;
  if (role === 'pharmacy-personnel') {
    return Boolean(profile?.userName || profile?.firstname || profile?.firstName || profile?.pharmacyName || profile?.phoneNumber);
  }
  return false;
}

function isLikelyJwt(token: string): boolean {
  // JWTs have 3 dot-separated base64url parts.
  return typeof token === 'string' && token.split('.').length === 3;
}

function extractAuthTokenPayload(data: unknown): AuthTokenPayload {
  if (typeof data === 'string') {
    return isLikelyJwt(data) ? { token: data } : { personnelId: data };
  }

  if (data && typeof data === 'object') {
    const payload = data as Record<string, unknown>;
    return {
      personnelId: typeof payload.personnelId === 'string' ? payload.personnelId : undefined,
      token: typeof payload.token === 'string' ? payload.token : undefined,
    };
  }

  return {};
}

function getStoredJwt(): string {
  const token = getAuthToken();
  return token && isLikelyJwt(token) ? token : '';
}

function authFromToken(token: string, profile?: any, fallbackToken?: string): AuthResponse {
  const resolvedToken = isLikelyJwt(token)
    ? token
    : fallbackToken && isLikelyJwt(fallbackToken)
      ? fallbackToken
      : getStoredJwt();

  let jwtPayload: any = {};
  if (resolvedToken) {
    try {
      jwtPayload = decodeJWT(resolvedToken);
    } catch {
      jwtPayload = {};
    }
  }

  const userName = profile?.userName || '';
  const { firstName, lastName } = splitName(userName);

  const role = mapRole(jwtPayload.role || profile?.role);

  return {
    token: resolvedToken,
    user: {
      id: profile?.id || jwtPayload.sub || '',
      personnelId: profile?.personnelId || jwtPayload.personnelId || '',
      email: profile?.email || jwtPayload.email || '',
      firstName: firstName || jwtPayload.firstName || jwtPayload.email?.split('@')[0] || '',
      lastName: lastName || jwtPayload.lastName || '',
      role,
      facilityId: profile?.facility?.id,
      facility: profile?.facility
        ? { id: profile.facility.id, name: profile.facility.name }
        : undefined,
      needsOnboarding: !hasCompletedOnboarding(profile, role),
    },
  };
}

// Helper function to get auth token
const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('hcp-auth-token');
  }
  return null;
};

// Helper function to extract array from potentially paginated response
function extractArray<T>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  // Handle paginated response: { rows: T[], total: number, ... }
  if (data.rows && Array.isArray(data.rows)) return data.rows;

  // Handle data wrapper: { data: T[] | { rows: T[] } }
  if (data.data) {
    if (Array.isArray(data.data)) return data.data;
    if (data.data.rows && Array.isArray(data.data.rows)) return data.data.rows;
  }

  return [];
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const messages: string[] = [];
    const collect = (value: unknown) => {
      if (typeof value === 'string' && value.trim()) {
        messages.push(value.trim());
      } else if (Array.isArray(value)) {
        value.forEach(collect);
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, nestedValue]) => {
          if (typeof nestedValue === 'string') messages.push(`${key}: ${nestedValue}`);
          else collect(nestedValue);
        });
      }
    };

    collect(body?.message);
    collect(body?.error);
    collect(body?.errors);

    const uniqueMessages = [...new Set(messages)];
    if (uniqueMessages.length > 0) return uniqueMessages.join(': ');
  } catch {
    // ignore parse failures
  }
  return `API Error: ${response.status}`;
}

// Base API call function
async function apiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'GET',
  body?: any,
  customHeaders?: Record<string, string>
): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined && body !== null) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    if (response.status === 401 && token) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('hcp-auth-token');
        localStorage.removeItem('hcp-user');
        localStorage.removeItem('hcp-user-role');
        window.location.href = '/login';
      }
    }
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  // Some endpoints may return empty bodies
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

// Authentication APIs
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiCall<ApiResponse<string | AuthTokenPayload>>(
      '/api/v1/personnel/auth/login',
      'POST',
      { email, password }
    );

    const authPayload = extractAuthTokenPayload(response.data);

    if (!authPayload.token) {
      throw new Error(response.message || 'Login failed: no token returned');
    }

    if (!isLikelyJwt(authPayload.token)) {
      throw new Error('Login returned an invalid token format. Please try again.');
    }

    // Persist token before calling /current
    if (typeof window !== 'undefined' && isLikelyJwt(authPayload.token)) {
      localStorage.setItem('hcp-auth-token', authPayload.token);
    }

    try {
      const profile = await authApi.getCurrent();
      const auth = authFromToken(authPayload.token, profile);
      return {
        ...auth,
        user: {
          ...auth.user,
          personnelId: authPayload.personnelId || auth.user.personnelId,
        },
      };
    } catch {
      const auth = authFromToken(authPayload.token);
      return {
        ...auth,
        user: {
          ...auth.user,
          personnelId: authPayload.personnelId || auth.user.personnelId,
        },
      };
    }
  },

  verifyOtp: async (identifier: string, code: number): Promise<ApiResponse<unknown>> => {
    return apiCall<ApiResponse<unknown>>(
      '/api/v1/personnel/auth/otp/verify',
      'POST',
      { identifier, code }
    );
  },

  resendOtp: async (identifier: string): Promise<ApiResponse<unknown>> => {
    return apiCall<ApiResponse<unknown>>(
      '/api/v1/personnel/auth/otp/re-send',
      'POST',
      { identifier }
    );
  },

  linkGoogleAccount: async (googleToken: string): Promise<ApiResponse<unknown>> => {
    return apiCall<ApiResponse<unknown>>(
      '/api/v1/personnel-accounts/google-link',
      'POST',
      undefined,
      { idtoken: googleToken }
    );
  },

  loginWithGoogle: async (googleToken: string): Promise<AuthResponse> => {
    const response = await apiCall<ApiResponse<string | AuthTokenPayload>>(
      '/api/v1/personnel/auth/login/google',
      'POST',
      {},
      { idtoken: googleToken }
    );

    const authPayload = extractAuthTokenPayload(response.data);

    if (!authPayload.token) {
      throw new Error(response.message || 'Google login failed: no token returned');
    }

    if (!isLikelyJwt(authPayload.token)) {
      throw new Error('Google login returned an invalid token format. Please try again.');
    }

    if (typeof window !== 'undefined' && isLikelyJwt(authPayload.token)) {
      localStorage.setItem('hcp-auth-token', authPayload.token);
    }

    try {
      const profile = await authApi.getCurrent();
      const auth = authFromToken(authPayload.token, profile);
      return {
        ...auth,
        user: {
          ...auth.user,
          personnelId: authPayload.personnelId || auth.user.personnelId,
        },
      };
    } catch {
      // New Google users may not be onboarded yet — /current can fail
      const auth = authFromToken(authPayload.token);
      return {
        ...auth,
        user: {
          ...auth.user,
          personnelId: authPayload.personnelId || auth.user.personnelId,
        },
      };
    }
  },

  signup: async (data: { email: string; password: string; role: 'health-worker' | 'pharmacy-personnel' }): Promise<AuthResponse> => {
    const response = await apiCall<ApiResponse<string | AuthTokenPayload>>(
      '/api/v1/personnel/auth/signup',
      'POST',
      { email: data.email, password: data.password }
    );

    const authPayload = extractAuthTokenPayload(response.data);

    if (!authPayload.personnelId && !authPayload.token) {
      throw new Error(response.message || 'Signup failed: no token returned');
    }

    if (!authPayload.token || !isLikelyJwt(authPayload.token)) {
      return {
        token: '',
        user: {
          id: '',
          personnelId: authPayload.personnelId || '',
          email: data.email,
          role: data.role,
          needsOnboarding: true,
        },
      };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('hcp-auth-token', authPayload.token);
    }

    const auth = authFromToken(authPayload.token);
    return {
      ...auth,
      user: {
        ...auth.user,
        personnelId: authPayload.personnelId || auth.user.personnelId,
        email: data.email,
        needsOnboarding: true,
      },
    };
  },

  onboard: async (data: {
    personnelId: string;
    role: 'health-worker' | 'pharmacy-personnel';
    pharmacyName?: string;
    firstname: string;
    lastname: string | null;
    phoneNumber: string;
    personnelIdNumber: string | null;
    facilityId?: string | null;
    facilityName?: string;
  }): Promise<AuthResponse> => {
    const payload = {
      personnelId: data.personnelId,
      role: data.role === 'pharmacy-personnel' ? 'pharmacy' : 'clinician',
      ...(data.role === 'pharmacy-personnel' && data.pharmacyName
        ? { pharmacyName: data.pharmacyName.trim() }
        : {}),
      firstname: data.firstname.trim(),
      lastname: data.lastname?.trim() || null,
      phoneNumber: normalizePhoneNumber(data.phoneNumber),
      personnelIdNumber: data.personnelIdNumber?.trim() || null,
      facilityId: data.role === 'health-worker' ? data.facilityId || null : null,
    };

    const response = await apiCall<ApiResponse<string>>(
      '/api/v1/personnel/auth/onboard',
      'POST',
      payload
    );

    if (!response.data || typeof response.data !== 'string') {
      throw new Error(response.message || 'Onboarding failed: no token returned');
    }

    // Do not replace a valid existing token with non-JWT onboarding IDs.
    if (typeof window !== 'undefined' && isLikelyJwt(response.data)) {
      localStorage.setItem('hcp-auth-token', response.data);
    }

    const existingJwt = getStoredJwt();

    try {
      const profile = await authApi.getCurrent();
      return authFromToken(response.data, profile, existingJwt);
    } catch {
      const auth = authFromToken(response.data, undefined, existingJwt);
      return {
        ...auth,
        user: {
          ...auth.user,
          personnelId: data.personnelId || auth.user.personnelId,
          role: data.role,
          firstName: payload.firstname,
          lastName: payload.lastname || undefined,
          facilityId: payload.facilityId || undefined,
          facility: data.facilityName && data.facilityId
            ? { id: data.facilityId, name: data.facilityName }
            : auth.user.facility,
          needsOnboarding: false,
        },
      };
    }
  },

  deleteAccount: async (): Promise<ApiResponse<unknown>> => {
    return apiCall<ApiResponse<unknown>>('/api/v1/personnel/auth', 'DELETE');
  },

  getCurrent: async (): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      '/api/v1/personnel/auth/current',
      'GET'
    );
    return response.data;
  },

  getCurrentFacilities: async (): Promise<any[]> => {
    const response = await apiCall<ApiResponse<any>>(
      '/api/v1/personnel/auth/currentFacilities',
      'GET'
    );
    return extractArray<any>(response.data);
  },
};

// HCP Patient APIs
export const hcpPatientApi = {
  createPatient: async (data: {
    ghanaCardNumber: string;
    nhisNumber: string;
    phoneNumber: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    chronicConditions: string[];
    firstname: string;
    lastname: string;
    age: number;
    facilityId: string;
  }): Promise<string> => {
    const response = await apiCall<ApiResponse<string | { id?: string; _id?: string }>>(
      '/api/v1/hcp/patients',
      'POST',
      data
    );
    if (typeof response.data === 'string') return response.data;
    return response.data?.id || response.data?._id || '';
  },

  getPatients: async (page = 1, limit = 50): Promise<Patient[]> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients?page=${page}&pageSize=${limit}`,
      'GET'
    );

    return extractArray<any>(response.data).map(mapPatient);
  },

  getPatientsWithOptions: async (options: PatientQueryOptions = {}): Promise<Patient[]> => {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.searchFields?.length) params.set('searchFields', options.searchFields.join(','));
    if (options.page) params.set('page', String(options.page));
    if (options.pageSize) params.set('pageSize', String(options.pageSize));
    if (options.filterBy) params.set('filterBy', options.filterBy);
    if (options.orderBy) params.set('orderBy', options.orderBy);
    if (options.orderDirection) params.set('orderDirection', options.orderDirection);
    if (options.facilityId) params.set('facilityId', options.facilityId);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients${qs}`,
      'GET'
    );

    return extractArray<any>(response.data).map(mapPatient);
  },

  getPatientsNoPaginate: async (search?: string): Promise<Array<{ id: string; name: string; patientCode?: string }>> => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/no-paginate${qs}`,
      'GET'
    );

    return extractArray<any>(response.data).map((row: any) => ({
      id: row.id,
      name: row.name || [row.firstName, row.lastName].filter(Boolean).join(' ').trim(),
      patientCode: row.patientCode,
    }));
  },

  getPatientById: async (patientId: string): Promise<Patient> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}`,
      'GET'
    );
    return mapPatient(response.data);
  },

  updatePatient: async (patientId: string, data: Record<string, unknown>): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}`,
      'PATCH',
      data
    );
    return response.data;
  },

  createVitalHistory: async (data: {
    patientId: string;
    recordedAt: string;
    notes?: string;
    vitals: Array<{ vitalType: string; value: string; unit?: string; severity?: string }>;
  }): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      '/api/v1/hcp/vital-histories',
      'POST',
      data
    );
    return response.data;
  },

  getPatientAppointments: async (
    patientId: string,
    filter?: 'upcoming' | 'past',
    status?: 'scheduled' | 'rescheduled' | 'active' | 'completed' | 'cancelled',
    page = 1,
    pageSize = 10
  ): Promise<Appointment[]> => {
    const params = new URLSearchParams();
    if (filter) params.set('filter', filter);
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/appointments${qs}`,
      'GET'
    );

    return extractArray<any>(response.data).map((row: any) => mapAppointment(row, patientId));
  },

  createAppointment: async (
    patientId: string,
    data: {
      title: string;
      description?: string;
      appointmentDate: string;
    }
  ): Promise<string> => {
    const response = await apiCall<ApiResponse<string>>(
      `/api/v1/hcp/patients/${patientId}/appointments`,
      'POST',
      data
    );
    return response.data || '';
  },

  getPatientMedications: async (patientId: string): Promise<Medication[]> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/medications`,
      'GET'
    );

    return extractArray<any>(response.data).map((med: any) => {
      const freq = med.frequency;
      const frequencyLabel =
        typeof freq === 'object' && freq
          ? `Every ${freq.repeatEvery} ${freq.repetitionType || 'day(s)'}`
          : freq || '';

      return {
        id: med.id,
        name: med.name,
        dose: med.dosage || med.dose || '',
        frequency: frequencyLabel,
        adherence: med.adherence,
      };
    });
  },

  getPatientVitals: async (patientId: string): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/vitals/latest`,
      'GET'
    );
    return response.data;
  },

  getVitalHistoryTrends: async (
    patientId: string,
    vitalType: 'heartRate' | 'bloodSugar',
    dateRange: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth'
  ): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/vital-histories/trends?vitalType=${vitalType}&dateRange=${dateRange}`,
      'GET'
    );
    return response.data;
  },

  getBloodPressureTrends: async (
    patientId: string,
    dateRange: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth'
  ): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/vital-histories/trends/bp?dateRange=${dateRange}`,
      'GET'
    );
    return response.data;
  },

  getPatientVitalHistoryLogs: async (patientId: string): Promise<any[]> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/vital-histories/logs`,
      'GET'
    );
    return extractArray<any>(response.data);
  },

  getVitalHistoryLogById: async (patientId: string, logId: string): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/vital-histories/logs/${logId}`,
      'GET'
    );
    return response.data;
  },

  getMedicationAdherence: async (
    patientId: string,
    medicationId: string,
    date: string
  ): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/medications/${medicationId}/adherence?date=${encodeURIComponent(date)}`,
      'GET'
    );
    return response.data;
  },

  updateVitalLog: async (
    patientId: string,
    logId: string,
    data: { severity?: string; notes?: string }
  ): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/vital-histories/logs/${logId}`,
      'PATCH',
      data
    );
    return response.data!;
  },

  cancelAppointment: async (
    patientId: string,
    appointmentId: string,
    reason = 'Cancelled by clinician'
  ): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/appointments/${appointmentId}/cancel`,
      'PATCH',
      { reason }
    );
    return response.data!;
  },

  completeAppointment: async (patientId: string, appointmentId: string): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/appointments/${appointmentId}/complete`,
      'PUT'
    );
    return response.data!;
  },

  rescheduleAppointment: async (
    patientId: string,
    appointmentId: string,
    reason: string
  ): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/hcp/patients/${patientId}/appointments/${appointmentId}/reschedule`,
      'PATCH',
      { reason }
    );
    return response.data!;
  },
};

export const pharmacyPatientApi = {
  getPatients: async (page = 1, limit = 50): Promise<Patient[]> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/personnel/pharmacies/patients?page=${page}&pageSize=${limit}`,
      'GET'
    );

    return extractArray<any>(response.data).map(mapPatient);
  },

  getPatientsWithOptions: async (options: PatientQueryOptions = {}): Promise<Patient[]> => {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.page) params.set('page', String(options.page));
    if (options.pageSize) params.set('pageSize', String(options.pageSize));
    if (options.filterBy) params.set('filterBy', options.filterBy);
    if (options.orderBy) params.set('orderBy', options.orderBy);
    if (options.orderDirection) params.set('orderDirection', options.orderDirection);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/personnel/pharmacies/patients${qs}`,
      'GET'
    );

    return extractArray<any>(response.data).map(mapPatient);
  },

  getPatientsNoPaginate: async (search?: string): Promise<Array<{ id: string; name: string; patientCode?: string }>> => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/personnel/pharmacies/patients/no-paginate${qs}`,
      'GET'
    );

    return extractArray<any>(response.data).map((row: any) => ({
      id: row.id,
      name: row.name || [row.firstName, row.lastName].filter(Boolean).join(' ').trim(),
      patientCode: row.patientCode,
    }));
  },

  getPatientById: async (patientId: string): Promise<Patient> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/personnel/pharmacies/patients/${patientId}`,
      'GET'
    );
    return mapPatient(response.data);
  },

  getLatestVitals: async (patientId: string): Promise<any[]> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/personnel/pharmacies/patients/${patientId}/vitals/latest`,
      'GET'
    );
    return extractArray<any>(response.data);
  },

  getVitalHistories: async (page = 1, pageSize = 10): Promise<PharmacyVitalHistory[]> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/personnel/pharmacies/vital-histories?page=${page}&pageSize=${pageSize}`,
      'GET'
    );

    return extractArray<any>(response.data).map((row: any) => ({
      id: row.id,
      patientId: row.patientId,
      patientName: row.patient?.name || 'Unknown patient',
      patientCode: row.patient?.patientCode,
      recordedAt: row.recordedAt,
    }));
  },

  getAnalytics: async (
    dateRange?: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'last30Days' | 'lastThreeMonths' | 'thisYear'
  ): Promise<PharmacyAnalytics> => {
    const qs = dateRange ? `?dateRange=${encodeURIComponent(dateRange)}` : '';
    const response = await apiCall<ApiResponse<PharmacyAnalytics>>(
      `/api/v1/personnel/pharmacies/analytics${qs}`,
      'GET'
    );

    return response.data || { patientsCount: 0, vitalsRecordedCount: 0, referralsCount: 0 };
  },

  getReferralCode: async (): Promise<string> => {
    const response = await apiCall<ApiResponse<string>>(
      '/api/v1/personnel/pharmacies/referral-code',
      'GET'
    );
    return response.data || '';
  },
};

// Facility APIs
export const facilityApi = {
  getFacilities: async (): Promise<any[]> => {
    const response = await apiCall<ApiResponse<any>>(
      '/api/v1/facilities',
      'GET'
    );
    return extractArray<any>(response.data);
  },

  getFacilityById: async (facilityId: string): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/facilities/${facilityId}`,
      'GET'
    );
    return response.data!;
  },
};

// Chat APIs (basic endpoints)
export const chatApi = {
  getHcpSessions: async (): Promise<any[]> => {
    const response = await apiCall<ApiResponse<any>>(
      '/api/v1/chat/hcp/sessions',
      'GET'
    );
    return extractArray<any>(response.data).map((session: any) => {
      const patientName =
        session.patient?.name ||
        [session.patient?.firstName, session.patient?.lastName].filter(Boolean).join(' ').trim() ||
        session.name ||
        session.title ||
        session.roomName ||
        'Unknown patient';

      const latestText =
        session.latestMessage?.message ||
        session.latestMessage?.text ||
        session.lastMessage?.message ||
        session.lastMessage?.text ||
        session.latest ||
        'No messages yet';

      const latestTimeRaw =
        session.latestMessage?.createdAt ||
        session.lastMessage?.createdAt ||
        session.updatedAt ||
        session.createdAt;

      const latestTime = latestTimeRaw
        ? new Date(latestTimeRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

      return {
        id: session.id || session.roomId || session._id,
        name: patientName,
        latest: latestText,
        time: latestTime,
      };
    }).filter((session: any) => session.id);
  },

  getMessages: async (roomId: string): Promise<any[]> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/chat/hcp/rooms/${roomId}/messages`,
      'GET'
    );
    return extractArray<any>(response.data).map((message: any) => ({
      id: message.id || message._id,
      type:
        message.direction === 'outgoing' ||
        message.senderType === 'hcp' ||
        message.fromMe === true
          ? 'to'
          : 'from',
      text: message.message || message.text || '',
      time: message.createdAt
        ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
    })).filter((message: any) => message.text);
  },
};

// Appointment Request APIs
export const appointmentRequestApi = {
  getAppointmentRequests: async (): Promise<any[]> => {
    const response = await apiCall<ApiResponse<any>>(
      '/api/v1/appointment-requests',
      'GET'
    );
    return extractArray<any>(response.data);
  },

  getAppointmentRequestById: async (id: string): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/appointment-requests/${id}`,
      'GET'
    );
    return response.data!;
  },

  updateAppointmentRequest: async (id: string, data: any): Promise<any> => {
    const response = await apiCall<ApiResponse<any>>(
      `/api/v1/appointment-requests/${id}`,
      'PATCH',
      data
    );
    return response.data!;
  },
};
