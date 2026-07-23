// Simple JWT decoder (doesn't verify signature, just decodes payload)
export interface JWTPayload {
  sub?: string;
  email?: string;
  role?: 'health-worker' | 'pharmacy-personnel' | 'clinician';
  iat?: number;
  exp?: number;
  [key: string]: any;
}

export function decodeJWT(token: string): JWTPayload {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Decode the payload (second part)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    throw new Error('Invalid token format');
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJWT(token);
    if (!payload.exp) return false;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch {
    return true;
  }
}
