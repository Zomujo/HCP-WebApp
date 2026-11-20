# syntax=docker/dockerfile:1

# Production image for the HCP web app.
#
#   docker build \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.gov.gh \
#     --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=<client id> \
#     -t hcp-web .
#   docker run --init -p 3000:3000 hcp-web
#
# The two NEXT_PUBLIC_* values are baked into the browser bundle, so every
# environment needs its own image; they cannot be changed at run time.
# deploy/deploy.sh passes them from /opt/hcp-web/.env.<environment>.

# Node 22 LTS; pin a full version (e.g. 22.21.1) for fully reproducible builds.
ARG NODE_VERSION=22

# --- deps: exact dependencies from the lockfile ---
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- build: next build -> .next/standalone ---
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
	NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
	NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next.config.mjs refuses to build when either NEXT_PUBLIC_* value is missing.
# next/font downloads the Inter font here, so the build needs internet access.
RUN npm run build

# --- runtime: only the standalone server and its static files ---
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PORT=3000 \
	HOSTNAME=0.0.0.0 \
	TZ=Africa/Accra
WORKDIR /app

# Files stay owned by root and read-only to the app; it writes nothing to disk.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/login').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
