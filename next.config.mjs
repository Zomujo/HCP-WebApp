import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants.js';

// NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so a
// build without them would ship a broken app. Refuse to build instead.
const REQUIRED_AT_BUILD = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID'];

function settingsProblems() {
  const problems = [];
  for (const key of REQUIRED_AT_BUILD) {
    const value = process.env[key];
    if (!value?.trim()) {
      problems.push(`${key} must be set`);
    } else if (/\s/.test(value)) {
      // Next inlines the raw value, so a stray space or "# comment" would
      // ship inside every API call or the Google client ID.
      problems.push(`${key} must not contain spaces (check for a trailing space or a # comment)`);
    }
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && !/\s/.test(apiUrl) && !/^https?:\/\/[^/]+$/.test(apiUrl)) {
    problems.push(
      'NEXT_PUBLIC_API_URL must be the API origin only, e.g. https://api.example.gov.gh (no path, no trailing slash)',
    );
  }
  return problems;
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
  const problems =
    phase === PHASE_PRODUCTION_BUILD || phase === PHASE_DEVELOPMENT_SERVER ? settingsProblems() : [];
  if (problems.length > 0) {
    const list = `\n  - ${problems.join('\n  - ')}`;
    if (phase === PHASE_PRODUCTION_BUILD) {
      throw new Error(`Cannot build the web app:${list}`);
    }
    // The dev server still starts, but every API call would fail.
    console.warn(`\n⚠ Web app settings are incomplete (copy .env.example to .env.local):${list}\n`);
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
