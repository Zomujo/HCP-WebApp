// Environment and Configuration
export const CONFIG = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://dnh-server-staging.up.railway.app',
  GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '701397813152-0mkq23772vd5qpllcl4opt9bvidgsfm7.apps.googleusercontent.com',
  APP_NAME: 'YELIMA',
  APP_TAGLINE: 'Health Worker Portal',
};

export const ROLE_CONFIG = {
  'health-worker': {
    label: 'Health Worker',
    defaultRoute: '/dashboard',
  },
  'pharmacy-personnel': {
    label: 'Pharmacy Personnel',
    defaultRoute: '/pharmacy/dashboard',
  },
} as const;
