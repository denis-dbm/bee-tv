# syntax=docker/dockerfile:1

# ---- Build stage: Bun installs the locked dependencies, Vite builds the static bundle ----
FROM oven/bun:1.3 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---- Runtime stage: unprivileged nginx serving the SPA and proxying /api to the backend ----
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

LABEL org.opencontainers.image.title="bee-tv-app" \
      org.opencontainers.image.description="Bee TV single-page application" \
      org.opencontainers.image.source="https://github.com/denis-dbm/bee-tv"

# Default upstream; Compose derives it from BEE_API_PORT.
ENV BEE_API_UPSTREAM=http://api:8000

# The official image renders /etc/nginx/templates/*.template with envsubst at start-up.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 7777

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:7777/healthz"]
