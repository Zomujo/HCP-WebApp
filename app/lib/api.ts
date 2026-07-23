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

export interface AuthResponse {
  token: string;
  user: {
    id: string;
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
  firstName: string;
  lastName: string;
  name?: string;
  age: number;
  chronicConditions: string[];
  lastCheckIn?: string;
  adherence?: string;
  status?: string;
  ghanaCard?: string;
  nhis?: string;
  facility?: string;
  joined?: string;
  vitals?: {
    systolic: number;
    diastolic: number;
    note: string;
  };
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
  page?: number;
  pageSize?: number;
  filterBy?: 'hypertension' | 'diabetes' | 'both' | 'critical' | 'silent' | 'stable';
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  adherence?: string;
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
    id: raw.id,
    firstName,
    lastName,
    name,
    age: deriveAge(raw),
    chronicConditions: conditions,
    lastCheckIn: formatRelativeDate(raw.lastCheckInDate || raw.lastCheckIn),
    adherence,
    status: capitalizeStatus(raw.adherenceStatus || raw.status),
    ghanaCard: raw.ghanaCardNumber || raw.ghanaCard,
    nhis: raw.nhisNumber || raw.nhis,
    facility: raw.facility?.name || raw.facility,
  };
}

function mapRole(role?: string): 'health-worker' | 'pharmacy-personnel' {
  if (role === 'pharmacy-personnel' || role === 'pharmacy') {
    return 'pharmacy-personnel';
  }
  return 'health-worker';
}

function isLikelyJwt(token: string): boolean {
  // JWTs have 3 dot-separated base64url parts.
  return typeof token === 'string' && token.split('.').length === 3;
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

  return {
    token: resolvedToken,
    user: {
      id: profile?.id || jwtPayload.sub || '',
      email: profile?.email || jwtPayload.email || '',
      firstName: firstName || jwtPayload.firstName || jwtPayload.email?.split('@')[0] || '',
      lastName: lastName || jwtPayload.lastName || '',
      role: mapRole(jwtPayload.role || profile?.role),
      facilityId: profile?.facility?.id,
      facility: profile?.facility
        ? { id: profile.facility.id, name: profile.facility.name }
        : undefined,
      needsOnboarding: !profile?.facility,
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
    if (typeof body?.message === 'string' && body.message.trim()) {
      return body.message;
    }
    if (typeof body?.error === 'string' && body.error.trim()) {
      return body.error;
    }
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
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('hcp-auth-token');
        localStorage.removeItem('hcp-user');
        localStorage.removeItem('hcp-user-role');
        window.location.href = '/login';
      }
    }
    throw new Error(await parseErrorMessage(response));
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
    const response = await apiCall<ApiResponse<string>>(
      '/api/v1/personnel/auth/login',
      'POST',
      { email, password }
    );

    if (!response.data || typeof response.data !== 'string') {
      throw new Error(response.message || 'Login failed: no token returned');
    }

    if (!isLikelyJwt(response.data)) {
      throw new Error('Login returned an invalid token format. Please try again.');
    }

    // Persist token before calling /current
    if (typeof window !== 'undefined' && isLikelyJwt(response.data)) {
      localStorage.setItem('hcp-auth-token', response.data);
    }

    try {
      const profile = await authApi.getCurrent();
      return authFromToken(response.data, profile);
    } catch {
      return authFromToken(response.data);
    }
  },

  loginWithGoogle: async (googleToken: string): Promise<AuthResponse> => {
    const response = await apiCall<ApiResponse<string>>(
      '/api/v1/personnel/auth/login/google',
      'POST',
      {},
      { idtoken: googleToken }
    );

    if (!response.data || typeof response.data !== 'string') {
      throw new Error(response.message || 'Google login failed: no token returned');
    }

    if (!isLikelyJwt(response.data)) {
      throw new Error('Google login returned an invalid token format. Please try again.');
    }

    if (typeof window !== 'undefined' && isLikelyJwt(response.data)) {
      localStorage.setItem('hcp-auth-token', response.data);
    }

    try {
      const profile = await authApi.getCurrent();
      return authFromToken(response.data, profile);
    } catch {
      // New Google users may not be onboarded yet — /current can fail
      return authFromToken(response.data);
    }
  },

  signup: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await apiCall<ApiResponse<string>>(
      '/api/v1/personnel/auth/signup',
      'POST',
      { email: data.email, password: data.password }
    );

    if (!response.data || typeof response.data !== 'string') {
      throw new Error(response.message || 'Signup failed: no token returned');
    }

    // Some environments return an ID string from signup instead of JWT.
    // In that case, immediately login with credentials to obtain a valid token.
    if (!isLikelyJwt(response.data)) {
      const loggedIn = await authApi.login(data.email, data.password);
      return {
        ...loggedIn,
        user: {
          ...loggedIn.user,
          needsOnboarding: true,
        },
      };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('hcp-auth-token', response.data);
    }

    const auth = authFromToken(response.data);
    return {
      ...auth,
      user: {
        ...auth.user,
        email: data.email,
        needsOnboarding: true,
      },
    };
  },

  onboard: async (data: {
    firstname: string;
    lastname: string;
    phoneNumber: string;
    personnelIdNumber: string;
    facilityId: string;
    facilityName?: string;
  }): Promise<AuthResponse> => {
    const payload = {
      firstname: data.firstname.trim(),
      lastname: data.lastname.trim(),
      phoneNumber: normalizePhoneNumber(data.phoneNumber),
      personnelIdNumber: data.personnelIdNumber.trim(),
      facilityId: data.facilityId,
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
      if (!auth.token) {
        throw new Error('Onboarding completed but authentication token is invalid. Please sign in again.');
      }
      return {
        ...auth,
        user: {
          ...auth.user,
          firstName: payload.firstname,
          lastName: payload.lastname,
          facilityId: payload.facilityId,
          facility: data.facilityName
            ? { id: payload.facilityId, name: data.facilityName }
            : auth.user.facility,
          needsOnboarding: false,
        },
      };
    }
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
    if (options.page) params.set('page', String(options.page));
    if (options.pageSize) params.set('pageSize', String(options.pageSize));
    if (options.filterBy) params.set('filterBy', options.filterBy);
    if (options.orderBy) params.set('orderBy', options.orderBy);
    if (options.orderDirection) params.set('orderDirection', options.orderDirection);

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
