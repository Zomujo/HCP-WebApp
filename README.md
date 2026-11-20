# HCP-WebApp

The YELIMA health worker portal: a Next.js (App Router, TypeScript) web app for health workers and pharmacy personnel. It signs staff in and reads and writes patient data through the DNH API (`dnh-server`); it has no database of its own.

| Pages | For |
|---|---|
| `/login`, `/signup`, `/auth/otp`, `/login/google-link`, `/onboarding` | Staff sign-up, email verification code, Google sign-in, choosing a role and facility |
| `/dashboard`, `/patients`, `/patients/[id]`, `/appointments`, `/profile` | Health workers |
| `/pharmacy/dashboard`, `/pharmacy/patients`, `/pharmacy/patients/[id]` | Pharmacy personnel |

## Run locally

Needs Node 20.9 or newer (22 LTS recommended) and a running DNH API.

```bash
cp .env.example .env.local      # then fill in both values
npm install
npm run dev                     # http://localhost:3000
```

| Setting | What |
|---|---|
| `NEXT_PUBLIC_API_URL` | The DNH API's origin, e.g. `http://localhost:4815` or `https://api-staging.example.gov.gh`. No path, no trailing slash. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The OAuth web client ID for Google sign-in. Must also be in the API's `GOOGLE_CLIENT_ID`. |

Both are compiled into the browser bundle, so they are public and must never hold a secret. `npm run build` refuses to build without them, and there are no built-in defaults: a build always says which API it calls.

| Command | Does |
|---|---|
| `npm run dev` | Development server with reload |
| `npm run build` | Production build into `.next/` (standalone server) |
| `npm run lint` | ESLint with the Next.js rules |

## Deploy

The site runs as a Docker container on the VPS next to the API, with staging and production side by side:

| | Staging | Production |
|---|---|---|
| Branch | `staging` | `master` |
| VPS address | `127.0.0.1:3001` | `127.0.0.1:3000` |

`deploy/deploy.sh <staging|production>` builds the image with that environment's settings, swaps the container and checks it's healthy; `--rollback <sha>` goes back to a kept image. The whole procedure, first-time VPS setup and the reverse proxy are in [deploy/RUNBOOK.md](deploy/RUNBOOK.md).

Because settings are baked in at build time, each environment gets its own image, and changing a setting takes a deploy.

## Security

- Every response carries `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy` (set in `next.config.mjs`). The reverse proxy adds HSTS.
- Next.js image optimization is turned off (`images.unoptimized`), so the server has no image-processing endpoint.
- The API limits sign-in attempts and verification-code emails; see its README.
