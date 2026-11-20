import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

// NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so a
// build without them would ship a broken app. Refuse to build instead.
const REQUIRED_AT_BUILD = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID'];

function checkBuildSettings() {
  const problems = REQUIRED_AT_BUILD.filter((key) => !process.env[key]?.trim()).map(
    (key) => `${key} must be set`,
  );
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiUrl && !/^https?:\/\/[^/]+$/.test(apiUrl)) {
    problems.push(
      'NEXT_PUBLIC_API_URL must be the API origin only, e.g. https://api.example.gov.gh (no path, no trailing slash)',
    );
  }
  if (problems.length > 0) {
    throw new Error(`Cannot build the web app:\n  - ${problems.join('\n  - ')}`);
  }
}

// Applied to every response. The reverse proxy adds HSTS, since it is the one
// that terminates TLS.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

export default function nextConfig(phase) {
  if (phase === PHASE_PRODUCTION_BUILD) {
    checkBuildSettings();
  }

  return {
    reactStrictMode: true,
    // A self-contained server in .next/standalone, which the Docker image runs.
    output: 'standalone',
    poweredByHeader: false,
    // The app only shows a few small images from public/. Serving them as-is
    // turns off the image optimization endpoint, which has had several
    // security advisories.
    images: { unoptimized: true },
    async headers() {
      return [{ source: '/:path*', headers: securityHeaders }];
    },
  };
}
