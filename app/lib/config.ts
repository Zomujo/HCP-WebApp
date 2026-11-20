// Environment and Configuration
//
// NEXT_PUBLIC_* values are inlined when the app is built, so each environment
// gets its own build. There are deliberately no fallbacks: a build missing one
// would otherwise talk to the wrong API. next.config.mjs fails the build
// when either is unset.
export const CONFIG = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL as string,
  GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string,
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
