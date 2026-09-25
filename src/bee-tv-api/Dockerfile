# syntax=docker/dockerfile:1

ARG PYTHON_VERSION=3.13

# ---- Build stage: resolve the locked dependency set into a self-contained venv ----
FROM python:${PYTHON_VERSION}-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /build
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

# ---- Quality gate: mandatory for every build. Any failure aborts the image build ----
# Branches off the builder so dev tooling never reaches the runtime image.
FROM builder AS test

ENV PATH="/opt/venv/bin:${PATH}"
RUN uv sync --frozen --no-install-project

COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app
COPY tests ./tests

# pytest output is not piped into tee: /bin/sh has no pipefail, so a pipe would hide failures.
RUN set -e; \
    ruff check .; \
    ruff format --check .; \
    mypy; \
    if ! pytest --cov --cov-report=term -p no:cacheprovider > /tmp/pytest.log 2>&1; then \
        cat /tmp/pytest.log; exit 1; \
    fi; \
    cat /tmp/pytest.log; \
    { echo "bee-tv-api quality gate: PASSED"; \
      echo "checks: ruff check, ruff format --check, mypy --strict, pytest (coverage >= 95%)"; \
      tail -n 1 /tmp/pytest.log; } > /quality-gate.txt

# ---- Runtime stage: slim image, no build tooling, non-root ----
FROM python:${PYTHON_VERSION}-slim AS runtime

LABEL org.opencontainers.image.title="bee-tv-api" \
      org.opencontainers.image.description="Bee TV REST API (FastAPI)" \
      org.opencontainers.image.source="https://github.com/denis-dbm/bee-tv"

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    BEE_API_PORT=8000

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
# Depending on the gate's report is what forces BuildKit to run the test stage.
COPY --from=test /quality-gate.txt ./quality-gate.txt
COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app
COPY --chmod=0755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER app
# Default port; override at runtime with BEE_API_PORT (server and healthcheck both follow it).
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
    CMD ["python", "-c", "import os,sys,urllib.request; url=f\"http://127.0.0.1:{os.environ.get('BEE_API_PORT', '8000')}/api/health\"; sys.exit(0 if urllib.request.urlopen(url, timeout=2).status == 200 else 1)"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["python", "-m", "app"]
