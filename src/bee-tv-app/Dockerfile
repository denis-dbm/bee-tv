# syntax=docker/dockerfile:1

# ---- Dependencies: locked install (dev dependencies included: needed by the gate and the build) ----
FROM oven/bun:1.3 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Quality gate: mandatory for every build. Any failure aborts the image build ----
FROM deps AS test

COPY . .
RUN set -e; \
    bun run lint; \
    bun run typecheck; \
    bun run test:coverage; \
    { echo "bee-tv-app quality gate: PASSED"; \
      echo "checks: eslint (feature boundaries + a11y), tsc, vitest (coverage thresholds)"; } > /quality-gate.txt

# ---- Build: only reachable through the gate (FROM test) ----
FROM test AS build
RUN bunx vite build

# ---- Runtime stage: unprivileged nginx serving the SPA and proxying /api to the backend ----
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

LABEL org.opencontainers.image.title="bee-tv-app" \
      org.opencontainers.image.description="Bee TV single-page application" \
      org.opencontainers.image.source="https://github.com/denis-dbm/bee-tv"

# Default upstream (Compose derives it from BEE_API_PORT); expose the runtime DNS resolver to nginx.
ENV BEE_API_UPSTREAM=http://api:8000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

# The official image renders /etc/nginx/templates/*.template with envsubst at start-up.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /quality-gate.txt /usr/share/nginx/quality-gate.txt

EXPOSE 7777

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:7777/healthz"]
