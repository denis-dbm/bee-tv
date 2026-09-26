# Bee TV: Patterns and Choices

This document records every design pattern, architecture technique, clean-code concept and
engineering practice used in Bee TV. It follows the structure of
[`technical-architecture.md`](technical-architecture.md): each **principle or driver** from the
specification lists the **implementation decisions** derived from it, with a brief reasoning.

Use it as the engineering review baseline and as the reference for keeping new work consistent.

**How to read**

- Each decision is written as **Name**: what it is and where it lives. *Why:* the reasoning.
- Paths are relative to `src/bee-tv-api/` (**API**) or `src/bee-tv-app/` (**App**), unless stated.
- [Pattern index](#pattern-index) at the end maps every pattern to its section and location.

**Contents**

0. [Guiding principle: robust platform, pragmatic MVP](#0-guiding-principle-robust-platform-pragmatic-mvp)
1. [Architecture](#1-architecture)
2. [Backend tier](#2-backend-tier)
3. [Application database](#3-application-database)
4. [Frontend tier](#4-frontend-tier)
5. [DevOps practices](#5-devops-practices)
6. [Cross-cutting practices](#6-cross-cutting-practices)
7. [Consistency checklist](#7-consistency-checklist)
8. [Pattern index](#pattern-index)

---

## 0. Guiding principle: robust platform, pragmatic MVP

> *"Bee TV is designed and engineered to be a robust platform based on pragmatic choices. [...]
> The principles, technical drivers, and decisions take into account its lifecycle."*

- **YAGNI with explicit extension points.** Build only what the MVP needs, and leave a clean seam
  where growth is expected: the identity dependency, the catalog port, the insight port and the
  collection envelope. *Why:* speed now, without paying a rewrite later.
- **In-process caches instead of a distributed cache.** `cachetools.TTLCache` for the catalog and
  insights. *Why:* one API replica in the MVP; no Redis to operate. The decorator seam
  ([§2.3](#23-vertical-slice-architecture-self-contained-features-no-cross-dependencies)) lets a shared cache replace it with no feature change.
- **Migrate on container start.** Alembic runs in the API entrypoint
  ([§3](#3-application-database)). *Why:* single command, single replica. It is documented as the
  point to change (`BEE_SKIP_MIGRATIONS`) when scaling out.
- **Mocked identity, real seams.** A `guest` user flows through a single dependency, and tables
  already carry `user_id` ([§2.13](#213-authentication-out-of-scope-mocked-guest)). *Why:* authentication
  can be added without a schema or feature redesign.
- **Graceful degradation over hard failure.** Every partner (catalog, LLM, database) has a defined
  degraded mode: 503 problem details, a rule-based fallback, friendly UI states. *Why:* robustness
  is how the system behaves when things fail, not only when they work.
- **Zero-configuration defaults.** Every setting has a working default, so the stack runs without
  a `.env`. *Why:* the first run for Operations must just work.

---

## 1. Architecture

### 1.1 Two-tier: RESTful backend and a Single-Page Application

- **Same-origin reverse proxy.** nginx serves the SPA and proxies `/api/*` to the API
  (App `nginx.conf.template`). *Why:* no CORS configuration, a single public origin, and the API
  stays private to the container network.
- **Backend as the only integration point.** The SPA never calls TVMaze or the LLM; only
  poster images load from `static.tvmaze.com` (allowed by the CSP `img-src`). *Why:* rate limits,
  caching, vendor independence and secrets (`HF_TOKEN`) are all handled server-side.
- **Contract-first boundary.** The SPA types mirror the API DTOs per feature (App
  `features/*/api.ts`), and the API publishes OpenAPI at `/api/docs`. *Why:* both tiers evolve
  against an explicit, discoverable contract.

### 1.2 Infrastructure and deployables are containers (OCI)

- **One OCI image per deployable** (`api`, `web`) plus the official `mysql:8.4`. See [§5](#5-devops-practices).
- **OCI image labels** (`org.opencontainers.image.*`) in both Dockerfiles. *Why:* traceability of
  images back to the source repository.

### 1.3 No data (analytics) tier

- **Logs to stdout only** (12-factor). No analytics store or event pipeline. *Why:* out of scope;
  the platform's log driver can collect stdout later without code changes.

### 1.4 A simple relational database is required and enough

- **Two application tables**, `comments` and `watched_episodes`, and nothing speculative. See [§3](#3-application-database).

---

## 2. Backend tier

### 2.1 Python and FastAPI; endpoints are lightweight functions

- **Plain `async def` handlers per `APIRouter`**, one router per slice
  (API `app/features/*/endpoints.py`). *Why:* the spec's "lightweight functions"; no controller classes.
- **Application Factory.** `create_app(settings)` builds a fresh app (API `app/main.py`).
  *Why:* each test gets an isolated app with injected settings; no import-time side effects.
- **Composition Root.** `main.py` is the only place where concrete implementations are wired:
  database, HTTP clients, catalog provider, insight generator. *Why:* dependency choices stay
  visible in one place, and features only see abstractions.
- **Lifespan-managed resources with `AsyncExitStack`.** HTTP clients and the engine are opened at
  startup and closed in reverse order at shutdown. *Why:* deterministic cleanup; no leaked
  connections or sockets.
- **Settings object (12-factor config).** `pydantic-settings` with the `BEE_` prefix, typed and
  validated (`api_port` range 1–65535, blank `HF_TOKEN` normalized to "unset"), memoized with
  `@lru_cache` (API `app/core/config.py`). *Why:* one typed, validated source of configuration,
  overridable by environment.
- **`python -m app` server entrypoint** reads host and port from settings (API `app/__main__.py`).
  *Why:* the port is configurable (`BEE_API_PORT`) without editing the image command.

### 2.2 REST over HTTP; all common REST conventions observed

- **Resource-oriented URIs with plural nouns and sub-resources:**
  `/shows`, `/shows/{id}`, `/shows/{id}/seasons`, `/shows/{id}/watched-episodes/{episode_id}`,
  `/shows/{id}/episodes/{episode_id}/comments`, `/comments/{id}`.
  *Why:* the hierarchy mirrors ownership (an episode comment belongs to an episode of a show).
- **Verb semantics:**
  - `GET` is safe. Reviews are `GET` because generating an insight changes no server state.
  - `PUT` and `DELETE` on `watched-episodes/{id}` set and clear state **idempotently**. There is
    no toggle endpoint, which makes retries and double-clicks harmless.
  - `DELETE` returns `204` even when the entry is already absent.
  - `POST` creates a comment and returns **`201 Created` with a `Location` header** pointing to the
    canonical resource `GET /comments/{id}`, which exists so that `Location` always resolves.
- **Query parameters for filtering and options:** `?q=` for search, `?includeComments=` for reviews.
- **Aggregation as a resource:** `/shows/{id}/episodes/comment-counts`. *Why:* one request instead
  of N count calls from the episode grid.
- **Status codes by meaning:** `404` (unknown resource), `422` (invalid input), `503` (partner or
  database outage), `500` (unexpected). The payload is never a raw stack trace.
- **RFC 9457 Problem Details** (`application/problem+json` with `type`, `title`, `status`,
  `detail`, `code`, `instance`). *Why:* a standard, machine-readable error contract. The SPA
  classifies errors by `status`.
- **Collection envelope `Page[T] { items }`** (API `app/core/schemas.py`). *Why:* pagination
  metadata can be added later without breaking clients.
- **camelCase on the wire, snake_case in Python.** A `to_camel` alias generator on the DTO base
  `ApiModel`. *Why:* idiomatic on both sides with no manual mapping.
- **URI versioning `/api/v1`**, with operational endpoints unversioned (`/api/health`). *Why:* the
  contract can evolve; probes stay stable.
- **Validation at the edge.** Path parameters are constrained by length and a
  `^[A-Za-z0-9_-]+$` pattern (API `app/core/params.py`); query length limits; request bodies
  through Pydantic `Field` constraints plus a blank-after-trim validator. *Why:* fail fast with a
  `422`, before any I/O.
- **Self-documenting API.** OpenAPI/Swagger at `/api/docs`, with a `summary` on every route.

### 2.3 Vertical Slice Architecture: self-contained features, no cross dependencies

- **Package-by-feature.** `app/features/{search, show_details, watch_tracking, comments,
  bee_review, health}`; each slice owns its endpoints, DTOs, repository and domain helpers.
  *Why:* a change to one capability touches one folder.
- **Shared kernel, not shared features.** `app/core` (config, errors, logging, db, identity,
  resilience, schemas, params) and `app/integrations/catalog` (the partner port) are
  infrastructure that every slice may use. They are not features. *Why:* cross-cutting concerns
  are defined once, and business logic is never shared between slices.
- **Share the data model, not the code.** Slices share the ORM tables (API
  `app/persistence/models.py`) and each owns its own queries. For example, Bee Review reads
  comments through its own `SqlOpinionSource` (API `app/features/bee_review/opinions.py`)
  instead of importing the comments slice. *Why:* the "no cross dependencies" rule holds while
  still reading shared data.
- **Slice-local DTOs.** `ShowSearchResult`, `ShowDetails`, `EpisodeItem`, `CommentResponse`,
  `BeeReviewResponse`, each with a `from_domain` factory. *Why:* slices evolve their wire
  contracts independently.
- **Tests mirror slices** (`tests/features/<slice>/`). *Why:* the slice and its proof sit side by side.

### 2.4 Use-cases implemented within the endpoint handler

- **Transaction Script per endpoint.** Each handler reads as the use case: validate, load, act,
  log, respond. For example `create_episode_comment` verifies the episode exists, persists, logs
  and returns `201`. *Why:* per the spec, no service layer indirection for simple flows.
- **Pure domain helpers next to the handler** for logic worth testing in isolation, such as
  `group_by_season` (show_details). *Why:* handlers stay thin, and the logic gets unit tests
  without HTTP.
- **Existence checks before writes.** Marking watched or commenting first confirms the
  show/episode with the catalog. *Why:* no orphan rows for ids that don't exist at the partner.
  This is a conscious trade-off: writes fail with `503` during a catalog outage.

### 2.5 SOLID

- **Single Responsibility:**
  - `TvMazeMapper` translates, `TvMazeCatalogProvider` talks HTTP, and `CachedCatalogProvider` caches.
  - `PromptBuilder` builds prompts and `LexiconSentimentAnalyzer` scores sentiment.
  - The LLM, fallback and cache generators each do one thing.
- **Open/Closed:**
  - Errors carry their own HTTP metadata (`ClassVar` status/code/title), so a new error type needs
    no handler change (API `app/core/errors.py`).
  - New behavior is added by wrapping (Decorators), not by editing.
  - A new catalog partner means a new adapter; slices are untouched.
- **Liskov Substitution.** Every `CatalogProvider` (TVMaze, cached, test fake) and every
  `InsightGenerator` (LLM, rules, fallback chain, cache, fake) is interchangeable, and the tests
  prove it by running the same endpoints against fakes.
- **Interface Segregation.** Small ports: `CatalogProvider` (4 methods), `InsightGenerator` (1),
  `OpinionSource` (1), one repository port per slice. *Why:* consumers depend only on what they use.
- **Dependency Inversion.** Handlers depend on abstractions resolved by FastAPI `Depends`
  (`CatalogDep`, `RepositoryDep`, `GeneratorDep`); concretions are chosen in the composition root.

### 2.6 Idiomatic Python, Object-Oriented Paradigm

- **Ports as `abc.ABC` abstract classes:** `CatalogProvider`, `InsightGenerator`, `OpinionSource`,
  `CommentRepository`, `WatchedEpisodeRepository`.
- **Value objects as `@dataclass(frozen=True, slots=True)`:** `Show`, `Episode`, `ShowSummary`,
  `Insight`, `InsightSubject`, `Comment`, `CurrentUser`. *Why:* they are immutable, hashable (so
  `InsightSubject` doubles as a cache key) and memory-lean.
- **Pydantic models for the wire, dataclasses for the domain.** *Why:* validation and serialization
  stay at the boundary; the domain has no framework coupling.
- **`StrEnum`** for closed vocabularies: `SubjectKind`, `InsightSource`, `CircuitState`, `Sentiment`.
- **Modern typing (PEP 695):** `class Page[T]`, `async def call[T]`, `type Clock = Callable[[], float]`.
- **`Annotated` dependency aliases** (`CatalogDep`, `SessionDep`, `CurrentUserDep`). *Why:*
  signatures stay short and dependencies are declared once.
- **Factory classmethods:** `from_domain(...)` on DTOs, `Database.from_url(...)`.
- **Properties for derived state:** `CircuitBreaker.state` is computed from the clock and the
  failure history, never stored stale.
- **Context managers** for resource scopes: sessions and the `AsyncExitStack` lifespan.

### 2.7 Lint and code analysis tools

- **Ruff (lint and format)** with a broad rule set: pycodestyle, pyflakes, isort, naming,
  pyupgrade, bugbear, builtins, comprehensions, simplify, Ruff-specific, async, **bandit security
  (`S`)**, pytest style, return, unused args, pylint, tryceratops, logging-format. Configured in
  API `pyproject.toml`. *Why:* one fast tool that enforces style, correctness and security smells.
- **mypy `--strict`** with the Pydantic plugin over both `app` and `tests`. *Why:* tests are code
  too; typed fakes catch contract drift.
- **Coverage floor** `fail_under = 95` in `pyproject.toml`, enforced locally and in the build gate.

### 2.8 Types are testable and mockable

- **Dependency Injection** everywhere: FastAPI `Depends`, plus `app.state` holding the wired ports.
  Tests replace ports by assigning fakes on `app.state`.
- **Injectable time and sleep:** `CircuitBreaker(clock=...)`, `RetryPolicy(sleep=...)`, the TTL
  caches' `timer=...`, and `wait_for_database(sleep=...)`. *Why:* resilience logic is tested
  deterministically, with no real waiting.
- **Fakes over mocks.** `FakeCatalogProvider` and `FakeInsightGenerator` are real implementations
  of the ports (API `tests/fakes.py`). *Why:* they behave like production code and survive
  refactors better than call-assertion mocks.
- **Transport-level HTTP stubbing** with `respx` for the TVMaze and LLM adapters. *Why:* the real
  httpx code path is exercised, including status handling, timeouts and malformed JSON.
- **Isolated infrastructure per test:** in-memory SQLite (`StaticPool`), a fresh app, and
  `Settings(_env_file=None)` so a developer's local `.env` never leaks into tests.

### 2.9 Unit tests for all types, functions and testable constructs

- **131 tests, about 99.6% line coverage** (`uv run pytest --cov`).
- **Layers covered:**
  - unit tests: resilience, mappers, prompt builder, sentiment, rules, decorators;
  - integration tests: HTTP through the ASGI app, repositories on a real SQL engine, Alembic
    migrations applied to a real database file.
- **Parametrized tests** for tables of cases (error classification, HTML stripping, LLM failure modes).
- **Negative and edge paths are first-class tests:** circuit opening, lost race on
  mark-watched, blank or oversized comments, foreign-show episode ids, database-down health check.

### 2.10 Asynchronous I/O for all IO-bound operations

- **Async end to end:** async handlers, `httpx.AsyncClient`, SQLAlchemy async with `asyncmy`
  (MySQL) or `aiosqlite` (tests).
- **Shared, pooled HTTP clients** created once in the lifespan. *Why:* connection reuse and
  keep-alive to partners.
- **Concurrent independent I/O.** The episode review loads the show and the episode with
  `asyncio.gather`. `gather` is chosen over `TaskGroup` on purpose: `TaskGroup` wraps failures in
  an `ExceptionGroup`, which would bypass the domain error handlers and turn a 404 into a 500.
- **Non-blocking backoff and wait:** `asyncio.sleep` in retries and in the database wait at startup.

### 2.11 Logging in endpoints and critical services

- **Access-log middleware** records method, path, status, latency and an `X-Request-ID` (echoed
  back, or generated) (API `app/core/logging.py`). nginx forwards `$request_id`, so one id
  correlates the proxy and API logs.
- **Business events at `INFO`** in every endpoint, for example
  `User guest watched episode 1 of show 17861`.
- **Severity reflects meaning:**
  - `WARNING`: degraded but served (retry, circuit open, AI fallback);
  - `ERROR`: 5xx;
  - `exc_info`: tracebacks for unexpected errors only.
- **Lazy `%` formatting, never f-strings in log calls** (enforced by Ruff's `G` rules). *Why:* no
  formatting cost for filtered levels, and a structured-logging-friendly shape.
- **No secrets in logs.** The token is a `SecretStr`; database errors log the class, not credentials.

### 2.12 Error handling as architecture: global exception handlers; resilience per integration

- **Exception hierarchy with self-describing errors:** `ApplicationError` is the root, with
  `NotFoundError` and `ServiceUnavailableError` as categories and specific errors under them:
  `ShowNotFoundError`, `EpisodeNotFoundError`, `CommentNotFoundError`,
  `CatalogUnavailableError`, `DatabaseUnavailableError`.
- **Global handlers registered once** (`register_exception_handlers`) for application errors,
  validation errors, Starlette HTTP errors (such as unknown routes), database connection
  failures (mapped to `503`), and a catch-all `500` that hides internals.
- **Exception translation at adapter boundaries.** httpx and JSON errors become
  `CatalogUnavailableError` inside the TVMaze adapter; LLM errors become `InsightGenerationError`.
  *Why:* vendor exceptions never leak into slices.
- **Resilience chosen per integration context**, as the spec requires:

| Integration | Timeout | Retry | Circuit breaker | Cache | Degraded mode |
| --- | --- | --- | --- | --- | --- |
| TVMaze (catalog) | 5 s | 3 attempts, exponential backoff (0.2 s, capped at 2 s), only for transport errors, 429 and 5xx | 3 failures open it for 30 s; wraps the retries, so one logical call counts once; a 404 is a success | TTL 5 min, 1024 entries | `503 catalog_unavailable` |
| LLM (HuggingFace router) | 20 s | **None**: a quick fallback beats a slow retry for UX and quota | 3 failures / 30 s | AI results only, 1 h | Rule-based insight, labeled `fallback` |
| MySQL | driver defaults | Startup only: 30 attempts × 2 s before migrating; no per-query retries, so non-idempotent writes are never replayed | n/a | n/a | `503 database_unavailable`; health reports `degraded` |
| SPA → API | browser | Queries: up to 2 retries for offline or 5xx only; **mutations never retried** | n/a | TanStack Query cache | Friendly error states ([§4.12](#412-friendly-error-handling-through-creative-ux-for-service-unavailability)) |

- **Circuit Breaker pattern (three states: closed, open, half-open)** and a **Retry with
  exponential backoff** policy, both dependency-free and clock-injectable (API
  `app/core/resilience.py`).

### 2.13 Authentication out of scope: mocked guest

- **Single identity seam.** `get_current_user()` returns `GUEST_USER = CurrentUser(id="guest",
  display_name="Guest")` and is injected through `CurrentUserDep` (API `app/core/identity.py`).
  *Why:* replacing it with real authentication touches one function.
- **User-scoped data from day one.** The `user_id` columns and user-scoped queries mean the schema
  is ready for multiple users.

### 2.14 AI integration (Bee Review): isolated, failure-tolerant, with a clear fallback

- **Port and Adapter.** The `InsightGenerator` port (API `app/features/bee_review/insights.py`);
  `ChatCompletionInsightGenerator` speaks the **OpenAI-compatible** protocol (API `llm.py`).
  *Why:* provider independence; HuggingFace, OpenAI, Groq, Together, Ollama or vLLM is a matter of
  base URL, model and token.
- **Strategy pattern.** An LLM strategy and a deterministic `RuleBasedInsightGenerator` (API `rule_based.py`).
- **Chain of Responsibility / Fallback.** `FallbackInsightGenerator(primary, fallback)` absorbs
  any primary failure, even unexpected bugs, and logs it (API `composition.py`).
- **Decorator (cache).** `CachedInsightGenerator` caches only `source=ai`, so the AI comes back
  as soon as the provider recovers.
- **Configuration-driven composition.** No token means the rule-based generator only, with no
  dead HTTP client.
- **Transparent provenance.** Every response carries `source` (`ai` or `fallback`) and `generator`;
  the UI labels it accordingly.
- **Prompt engineering** (API `prompting.py`):
  - a role, constraints (2–3 sentences, at most 70 words, "never invent plot"), a one-shot
    example of tone, and plain-text output;
  - viewer comments are **delimited and declared untrusted**, a prompt-injection mitigation;
  - inputs are bounded: summary at most 1500 characters, comments at most 20 × 300 characters;
  - the output is bounded too: `max_tokens`, whitespace normalization, and a 700-character cap.
- **Offline NLP fallback.** A genre-to-phrase lexicon, first-sentence extraction, and a lexicon
  sentiment analyzer (injectable class).
- **Scoped opinion retrieval.** Only when requested (`includeComments`): at most 20 newest comment
  bodies, series-level or episode-level, never mixed.

### 2.15 Vendor lock-in proofing (catalog partner)

- **Anti-Corruption Layer.** The `CatalogProvider` port plus provider-agnostic models
  (`ShowSummary`, `Show`, `Episode`) (API `app/integrations/catalog/`). *Why:* TVMaze payloads
  never cross the adapter, so a second partner is a new adapter.
- **Mapper** (`TvMazeMapper`) isolates field translation: year from `premiered`, the network or
  web channel, and image fallbacks.
- **Sanitize partner content.** HTML summaries are converted to plain text server-side
  (`html_to_text`). *Why:* the SPA never renders partner HTML, which is XSS-safe by construction.
- **Defensive integration:**
  - identifiers are validated before any call (non-numeric means 404, with no partner request);
  - episode ownership is verified through `_links.show`;
  - specials are included (`specials=1`).
- **Decorator (cache)** `CachedCatalogProvider`:
  - TTL cache;
  - normalized search keys (case and whitespace);
  - immutable tuples in the cache and fresh lists returned, so callers can't corrupt it;
  - errors are never cached.
- **Factory** `build_catalog_provider(...)` is the only place naming TVMaze.

---

## 3. Application database

> *"The selected database is MySQL."*

- **MySQL 8.4 LTS** with `utf8mb4` and `utf8mb4_0900_ai_ci`. *Why:* full Unicode (titles and
  comments in any language) on a long-term-support release.
- **SQLAlchemy 2.x typed ORM** (`Mapped[...]`), async engine with `pool_pre_ping` and
  `pool_recycle=1800`. *Why:* self-healing connections after database restarts or idle timeouts.
- **Schema as code: Alembic migrations** (API `migrations/`). The migration runner
  `python -m app.migrate` waits for the database, then runs `upgrade head`, which is
  **idempotent** (API `app/migrate.py`).
- **Repository pattern per slice**, an ABC port plus an SQL adapter: `CommentRepository` and
  `SqlCommentRepository`, `WatchedEpisodeRepository` and `SqlWatchedEpisodeRepository`.
- **Session per request** through an async dependency; `expire_on_commit=False`. *Why:* a clear
  transactional scope per request, and entities stay readable after commit.
- **Natural composite key** `(user_id, episode_id)` for watched episodes. *Why:* uniqueness is
  enforced by the database, which is what makes `PUT` idempotent.
- **Race-safe idempotent insert.** On `IntegrityError` the transaction rolls back and the winner's
  row is returned (optimistic concurrency).
- **Access-path indexes:** `(show_id, episode_id, created_at)` for comment lists and counts,
  `(user_id, show_id)` for watched lists.
- **UTC everywhere.** `DATETIME(6)` on MySQL (microseconds) through a dialect variant;
  `as_utc()` re-attaches the timezone on read. *Why:* correct ordering and unambiguous
  timestamps on the wire.
- **No foreign keys to catalog entities; ids stored as strings** (`VARCHAR(64)`). *Why:* series and
  episodes live at the partner; string ids stay vendor-neutral.
- **The test engine is SQLite**, and the models are portable (dialect variants). *Why:* a fast,
  hermetic gate. The MySQL specifics were verified against the real stack.

---

## 4. Frontend tier

### 4.1 TypeScript and React

- **Strict TypeScript:** `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`,
  `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`
  (App `tsconfig.app.json`). *Why:* array and index access is checked, and type-only imports are
  explicit.
- **React 19 function components and hooks only.**
- **TypeScript 6 pinned.** *Why:* typescript-eslint doesn't support TypeScript 7 yet; the
  toolchain stays coherent.

### 4.2 Single-Page Application

- **Data router** (`createBrowserRouter`) with **route objects** (App `app/routes.tsx`).
- **Route-level code splitting** with `lazy` routes for the details and not-found pages, and a
  `hydrateFallbackElement` loader. *Why:* the home page loads less JavaScript.
- **The URL as state.** The search query lives in `?q=`: it's shareable, bookmarkable and works
  with back/forward. The input is a debounced draft committed to the URL with `replace`, so
  typing doesn't flood history.
- **Per-page document titles** (`useDocumentTitle`), for context in tabs and history.
- **SPA fallback on the server** (`try_files ... /index.html`) and a **not-found route** in the client.

### 4.3 Stack: Bun runtime and Vite build

- **Bun** for install (`bun install --frozen-lockfile`), scripts and the test runner host.
- **Vite** with the React plugin, an `@/` path alias, and a **dev proxy** for `/api` that follows
  `BEE_API_PORT`.
- **Vendor chunking** (`react`, `mui`, `query` groups). *Why:* long-lived, cacheable vendor
  bundles separate from app code.
- **Test environment choices driven by Bun:** `happy-dom` (jsdom is incompatible with the Bun
  runtime) and Istanbul coverage (V8 coverage needs Node's inspector).

### 4.4 Feature-Folder Development: self-contained features

- **Feature folders:** `features/{search, show-details, watch-tracking, comments, bee-review}`,
  each with `api.ts` (typed client factory), hooks (server state), `components/`, and
  `index.ts` as its **public API** (barrel).
- **Layered dependency rule:** `app` imports `pages`, which import `features`, which import
  `shared`. Never upwards, never sideways between features.
- **Boundaries enforced by lint, not convention.** ESLint `no-restricted-imports`: a feature
  can't import another feature, `pages` or `app`, and `shared` can't import anything above it
  (App `eslint.config.js`).
- **Pages as composition roots.** `ShowDetailsPage` wires independent features together.
- **Inversion of Control through slots (render props):**
  - `EpisodeTile` exposes `renderTitleAdornment` and `renderActions`;
  - `ShowHeader` exposes `posterActions`;
  - the page injects the watched toggle, the comments button and Bee Review into them.
  *Why:* show-details never knows those features exist.
- **Shared kernel:** `shared/api`, `shared/ui`, `shared/navigation`, `shared/hooks`, `shared/format`.

### 4.5 SOLID (frontend)

- **Single Responsibility.** The API client (transport), the hook (server state) and the
  component (view) are separate files. Presentational and connected components are split:
  `WatchedToggle` versus `EpisodeWatchToggle`, `CommentForm` versus `CommentsSection`.
- **Open/Closed.** Slots extend tiles without editing them; the error copy is table-driven
  (`ERROR_COPY`), so a new error kind means a new row.
- **Liskov Substitution.** `FetchHttpClient` and the test `FakeHttpClient` both honor `HttpClient`.
- **Interface Segregation.** `HttpClient` has four methods; component props are minimal and
  typed per component.
- **Dependency Inversion.** Features depend on the `HttpClient` interface resolved from context
  (`useHttpClient`), never on `fetch`.

### 4.6 Lint and code analysis tools

- **ESLint flat config:** `typescript-eslint` strict, `react-hooks` (v7, including the
  compiler-oriented rules), `react-refresh`, **`jsx-a11y` recommended**, and
  `consistent-type-imports`.
- **Type check** with `tsc -b` for the app and the build config.
- **Lint exceptions are explicit and justified inline.** The home search `autoFocus` is the only
  a11y exception, documented at the call site.

### 4.7 Types are testable and mockable

- **Dependency Injection through React Context:** `HttpClientContext`. `AppProviders` accepts
  an injected `httpClient` and `queryClient`.
- **Factory functions for API clients** (`createSearchApi(http)`, ...), so pure data access is
  testable without React.
- **Injectable browser APIs:** `FetchHttpClient(baseUrl, fetchFn)`, and
  `NavigationHistoryProvider(storage, navigation)`.
- **Recording fake:** `FakeHttpClient` is a route table that returns values, factories or errors,
  and records requests for assertions (App `test/fakeHttpClient.ts`).
- **Logic extracted into pure functions:** `applyToggle`, `classifyError`, `shouldRetryQuery`,
  `recordNavigation`, `previousFromNavigationApi`, `describeBackTarget`, `episodeCode`,
  `defaultSeasonIndex`, `showMeta`, and the format helpers.

### 4.8 Unit tests for all types, functions and testable constructs

- **122 tests (Vitest and Testing Library); coverage thresholds of 95% for lines, statements and
  functions and 90% for branches**, enforced by `bun run test:coverage` (App `vite.config.ts`).
- **"Test like a user":** role- and name-based queries (`getByRole('button', { name: ... })`)
  with `user-event`. *Why:* tests double as accessibility checks, and survive markup refactors.
- **Page-level integration tests** render the real route tree with a memory router
  (`renderApp`). They cover full flows: search, then details, then back; optimistic
  toggle and rollback; posting comments.
- **Isolation:** a fresh `QueryClient` per test, no retries, DOM cleanup, and `sessionStorage` cleared.

### 4.9 Design system: Material UI while Design & Experience defines the full experience

- **Components over the design system.** The UI is composed from MUI primitives (`Card`, `Grid`,
  `Stack`, `Dialog`, `Snackbar`, `Tabs`, `Skeleton`, `Chip`), plus a thin layer of
  **product-semantic shared components** in `shared/ui`: `ErrorState`, `EmptyState`, `BeeMascot`,
  `PosterPlaceholder`, `NotificationProvider`. *Why:* features speak product language ("error
  state") instead of re-assembling primitives, and the Design & Experience team can restyle in
  one place.
- **Centralized theme tokens:** palette, shape, typography and button casing (App `app/theme.ts`).
  **No ad-hoc colors in features.**
- **Variant overrides in the theme** (`MuiButton`, `MuiChip`, `MuiTab`) swap the honey fill to an
  accessible text tone (`#7A4F00`, WCAG AA) wherever primary is used as text. *Why:* accessible by
  default; components don't need to remember it.
- **`sx` for layout, the theme for look.** Spacing and layout in `sx`; color and typography from tokens.
- **`CssBaseline`** for a consistent cross-browser baseline.

### 4.10 Basic responsiveness

- **Breakpoint-driven grids:** search tiles `xs 6 · sm 4 · md 3 · lg 2.4`, episode tiles
  `xs 12 · sm 6 · md 4 · lg 3`; the details header stacks on small screens.
- **Adaptive components:**
  - the episode comments dialog is **full-screen on phones**;
  - season `Tabs` are scrollable, with mobile scroll buttons;
  - a compact header search on inner pages.
- **Layout stability:** `aspect-ratio` on posters and episode images and skeletons with matching
  shapes. *Why:* no layout shift while loading.
- **Lazy images** (`loading="lazy"`) for long grids.

### 4.11 Basic accessibility and navigation friendliness, gated as quality

- **Gate:** `jsx-a11y` in lint, plus role-based tests, both enforced in the Docker build ([§5.5](#55-tests-unit-and-integration-are-a-mandatory-gate-for-every-build-deployment-action)).
- **Landmarks and structure:** `banner`, `main` (skip-link target), `footer`, a `search` landmark,
  one `h1` per page (visually hidden on the results view), and sections labeled by their headings.
- **A skip link** ("Skip to content") as the first focusable element.
- **Accessible names with context:** "Mark Pilot as watched", "3 comments on Pilot. Open
  comments", "Bee Review for Dark".
- **State semantics:**
  - `aria-pressed` on the watched toggle;
  - `aria-live` on result counts and the review body;
  - `aria-busy` on skeletons;
  - labeled dialogs (`aria-labelledby`) and tabs wired to panels (`aria-controls`).
- **Images:** meaningful `alt` on posters; decorative images `aria-hidden` or `alt=""`.
- **Keyboard and motion:** `Ctrl/⌘+Enter` submits comments, `Esc` closes dialogs, a visible focus
  outline, and `prefers-reduced-motion` stops the mascot animation.
- **Navigation friendliness:**
  - real links (anchors) for navigation (tiles, back link), so new-tab and copy-link work;
  - a URL for every state;
  - the **back link to the real previous in-app page**: the browser Navigation API is the source
    of truth, with an in-app history tracker persisted in `sessionStorage` as the fallback, and
    protocol-relative paths rejected.

### 4.12 Friendly error handling through creative UX for service unavailability

- **Error taxonomy:** `classifyError()` maps any failure to `offline | unavailable | not-found |
  invalid | unknown` (App `shared/api/errors.ts`).
- **Table-driven copy and mood** (`ERROR_COPY`): each kind has a mascot mood, a human title and
  description, and whether a retry makes sense. For example *"Our bees are taking a short nap"*.
- **`ErrorState` in two variants:** a full-page one with the mascot, and a compact inline alert
  for sections. **Retry is only offered when retryable.**
- **Partial degradation.** Sections fail independently: seasons, comments or a review can show
  an inline error while the rest of the page works.
- **Mutations:**
  - optimistic updates with **rollback** on error (watched toggle);
  - failure toasts (`friendlyErrorMessage`);
  - the comment **draft is kept** on failure.
- **Loading and empty states:** skeletons shaped like the content, a friendly empty state ("No
  buzz yet"), and stale-while-revalidate (`keepPreviousData`) with a thin progress bar during
  search refetches.
- **AI transparency.** "AI insight" versus "Bee's instinct" chips, and an explanatory caption for
  fallback reviews.
- **Unknown routes** get a dedicated, friendly not-found page.

### 4.13 Server state and data fetching (supporting all features)

- **TanStack Query as the server-state layer**, with no global client-state store. *Why:* the
  server is the source of truth, and caching, deduplication and cancellation come for free.
- **Query-key factories per feature** (`searchKeys`, `showKeys`, `watchedKeys`, `commentKeys`,
  `reviewKeys`) for consistent cache addressing and invalidation.
- **Cancellation:** the query `AbortSignal` is passed to `fetch`, so outdated searches are aborted.
- **Cache policies by volatility:** catalog 5 min, reviews 1 min, default 1 min; no refetch on
  window focus.
- **Cache writes after mutations:** a created comment is inserted with `setQueryData`; counts and
  watched lists are invalidated once settled.
- **Debounce** (350 ms) for search input (`useDebouncedValue`).
- **Lazy dialogs:** a dialog mounts, and fetches, only when opened (`enabled: open`).
- **Cache reads without fetching:** the back-link label reads a cached series title and never
  triggers a request.
- **Derived state during render, instead of effect chains** (search URL sync, navigation
  tracker), and `useEffectEvent` for effect callbacks. *Why:* no flicker, and no stale closures.

---

## 5. DevOps practices

### 5.1 Docker Compose v3.3+

- **Compose file format 3.3**, declared explicitly, with no 3.4+ constructs: no top-level `name`,
  no `depends_on` conditions, no healthcheck `start_period`. Validated with legacy
  `docker-compose` 1.29.2, and run on Compose v2 and v5.
- **Self-healing readiness instead of orchestrator gating** (3.3 has no health conditions):
  - the API waits for MySQL (bounded retries) before migrating;
  - nginx **resolves the API per request** (`resolver` from the container's `/etc/resolv.conf`,
    `valid=10s`), so it starts before the API and follows it across container recreation.
- **`restart: unless-stopped`** on every service.
- **Defaults in interpolation** (`${VAR:-default}`) plus a documented `.env.example`, for zero config.

### 5.2 One container per deployable; persistent storage for the database

- **Services:** `web` (nginx and the SPA), `api` (FastAPI), `db` (MySQL) with the named volume
  `db-data`.
- **Minimal exposure:** only the web port is published. The API is `expose`-only, and MySQL is
  never published.
- **Multi-stage builds:**
  - API: `builder`, then `test`, then `runtime`;
  - App: `deps`, then `test`, then `build`, then `runtime`.
  *Why:* build tools and dev dependencies never reach the runtime images.
- **Hardened runtime images:**
  - `python:3.13-slim` running as UID 10001;
  - `nginx-unprivileged` (alpine) listening on an unprivileged port.
- **Reproducible builds:** `uv sync --frozen` and `bun install --frozen-lockfile`; bytecode
  precompiled (`UV_COMPILE_BYTECODE`); `.dockerignore` keeps the build context lean.
- **Builder portability:** no `COPY --chmod`, so both images also build with the legacy
  (non-BuildKit) builder.
- **PID 1 hygiene:** the entrypoint ends with `exec "$@"`, so the server receives stop signals
  directly and shuts down gracefully.

### 5.3 The application (frontend) runs on port 7777

- **nginx listens on 7777**, published as `${BEE_WEB_PORT:-7777}`.
- **Single source of truth for the API port** (`BEE_API_PORT`, default 8000). The server,
  the container healthcheck, Compose `expose`, the nginx upstream (envsubst template) and the
  Vite dev proxy all derive from it.

### 5.4 Automation: everything runs with a single command

- **`docker compose up --build`** builds, tests, migrates and starts everything.
- **Health checks at every level:**
  - MySQL: `mysqladmin ping` over TCP, which only succeeds on the real server, not the
    init-time one;
  - API: `/api/health`, readiness including a database ping, returning `503 degraded` when
    MySQL is down;
  - web: `/healthz` liveness.
- **Operational runbook** in the README: quick start, configuration table, migrations,
  health endpoints and troubleshooting.
- **Edge hardening at nginx:**
  - a strict CSP and anti-framing and anti-sniffing headers;
  - `server_tokens off` and gzip;
  - immutable caching for fingerprinted assets, and `no-cache` for `index.html`;
  - separate header sets for `/api` (Swagger UI keeps working).

### 5.5 Tests (unit and integration) are a mandatory gate for every build-deployment action

- **A test stage inside each Dockerfile**, with no bypass switch:
  - API: `ruff check`, `ruff format --check`, `mypy --strict`, then `pytest` with coverage of at least 95%;
  - App: ESLint (boundaries and a11y), `tsc`, then Vitest with coverage thresholds.
- **Forced execution.** BuildKit skips unused stages, so the API runtime copies the gate report
  (`/app/quality-gate.txt`) and the SPA bundle is built `FROM test`. *Why:* an image cannot exist
  without a passing gate.
- **No masked failures.** pytest output is not piped (`/bin/sh` has no `pipefail`).
- **Same gate everywhere.** Thresholds live in the project configs (`pyproject.toml`,
  `vite.config.ts`), so local runs, CI (`docker build --target test`) and Compose builds
  enforce identical rules.
- **Hermetic gate.** Partners are faked, and there's no network or credentials, so the gate is
  deterministic.
- **Proven negative.** Injected failing tests (and a type error) aborted the build and produced no image.

---

## 6. Cross-cutting practices

### 6.1 Clean code

- **Intention-revealing names:** `ShowNotFoundError`, `useWatchedEpisodes`,
  `previousFromNavigationApi`, `describeBackTarget`, `SEARCH_DEBOUNCE_MS`.
- **No magic numbers.** Named constants: `ID_LENGTH`, `MAX_COMMENT_LENGTH`, `MAX_INSIGHT_CHARS`,
  `MAX_SUMMARY_CHARS`, `MAX_QUERY_RETRIES`, `MAX_TRACKED_ENTRIES`.
- **Small functions, guard clauses, early returns.** Validation first, and one level of
  abstraction per function.
- **Immutability by default:** frozen dataclasses, `readonly` TypeScript types and
  `ReadonlyMap`, and immutable tuples in caches.
- **Pure core, impure edges.** Business rules are pure functions; I/O stays in adapters, hooks
  and handlers.
- **Comments explain *why*, never *what***, for example "gather (not TaskGroup) so domain errors
  propagate" and "no pipe: no pipefail".
- **Mirrored validation on both tiers.** Limits such as comments of 2000 characters and queries
  of 100 characters are enforced by the API and reflected in the inputs (`maxLength`). *Why:*
  instant feedback in the UI; the server stays authoritative.
- **Consistent naming conventions:** snake_case in Python, camelCase on the wire and in
  TypeScript, and kebab-case for frontend feature folders.
- **Conventional Commits**, with scopes (`api`, `app`, `devops`, `architecture`).

### 6.2 Security by design

- **Least privilege:** non-root containers, an unexposed API and database, and minimal images.
- **Secrets handling:** the token comes from the environment only, held as a `SecretStr`, never
  logged, and never sent to the browser.
- **Output safety:** partner HTML is stripped server-side; React escapes by default; a strict CSP.
- **Input safety:** validation at the edge; path patterns; bounded lengths.
- **LLM safety:** untrusted comments are delimited, instructed as opinions only, and truncated.
- **Open-redirect guard.** Back-link targets must be same-origin paths; `//host` and `/\host` are
  rejected, and stored navigation data is validated when loaded.
- **Static analysis:** Ruff's bandit rules (`S`) run in the gate.

### 6.3 Observability

- **Correlated logs:** `X-Request-ID` generated by nginx (or the API) and propagated end to end.
- **Health semantics:** liveness versus readiness, with explicit `degraded` reporting.
- **Signals of degradation in logs:** retry attempts, circuit transitions (opened and closed),
  and AI fallbacks, all at `WARNING`.

---

## 7. Consistency checklist

Use this checklist when extending the system.

**New backend capability (slice)**

- [ ] New folder under `app/features/<slice>/` with `endpoints.py`; register its router in `app/main.py`.
- [ ] Slice-local DTOs (`ApiModel`), `from_domain` factories, and a `Page[T]` envelope for collections.
- [ ] Depend on ports through `Annotated` `Depends` aliases; never import another slice.
- [ ] New persistent data: add models to `app/persistence/models.py` and an **Alembic migration**,
  plus a slice-owned repository (ABC and SQL adapter).
- [ ] Domain errors subclass `NotFoundError` or `ServiceUnavailableError` with `code` and `title`; no handler edits.
- [ ] `INFO` log per business event, with lazy `%` formatting.
- [ ] Tests in `tests/features/<slice>/` using the fakes; coverage at least 95%.

**New external integration**

- [ ] A port (ABC) with provider-agnostic models, an adapter translating payloads and exceptions,
  and a factory in the composition root.
- [ ] Choose resilience per context: timeout, retry (only if idempotent and useful), circuit
  breaker, cache, and an explicit degraded mode.
- [ ] Stub at transport level (`respx`); inject clocks and sleeps.

**New frontend feature**

- [ ] `features/<name>/` with `api.ts` (factory over `HttpClient`), hooks with a query-key
  factory, `components/`, and `index.ts`.
- [ ] Add the name to `featureNames` in `eslint.config.js` so boundaries are enforced.
- [ ] Compose it in `pages/` through slots; never import from another feature.
- [ ] Use theme tokens and `shared/ui` components; every failure goes through `ErrorState` or
  `friendlyErrorMessage`.
- [ ] Accessible names, landmarks and keyboard paths; role-based tests.

**DevOps**

- [ ] Keep `docker-compose.yml` within format 3.3; new settings get `${VAR:-default}` and an
  entry in `.env.example` and the README.
- [ ] New images: multi-stage, non-root, and a `test` stage the runtime depends on.

---

## Pattern index

| Pattern / technique | Section | Main location |
| --- | --- | --- |
| Adapter (catalog) | [2.15](#215-vendor-lock-in-proofing-catalog-partner) | API `integrations/catalog/tvmaze.py` |
| Adapter (LLM, OpenAI-compatible) | [2.14](#214-ai-integration-bee-review-isolated-failure-tolerant-with-a-clear-fallback) | API `features/bee_review/llm.py` |
| Anti-Corruption Layer | [2.15](#215-vendor-lock-in-proofing-catalog-partner) | API `integrations/catalog/` |
| Application Factory | [2.1](#21-python-and-fastapi-endpoints-are-lightweight-functions) | API `main.py` |
| Barrel / feature public API | [4.4](#44-feature-folder-development-self-contained-features) | App `features/*/index.ts` |
| Cache-aside and TTL cache (Decorator) | [2.15](#215-vendor-lock-in-proofing-catalog-partner), [2.14](#214-ai-integration-bee-review-isolated-failure-tolerant-with-a-clear-fallback) | API `catalog/cached.py`, `bee_review/composition.py` |
| Chain of Responsibility / Fallback | [2.14](#214-ai-integration-bee-review-isolated-failure-tolerant-with-a-clear-fallback) | API `bee_review/composition.py` |
| Circuit Breaker | [2.12](#212-error-handling-as-architecture-global-exception-handlers-resilience-per-integration) | API `core/resilience.py` |
| Composition Root | [2.1](#21-python-and-fastapi-endpoints-are-lightweight-functions), [4.4](#44-feature-folder-development-self-contained-features) | API `main.py`; App `pages/*` |
| Dependency Injection | [2.8](#28-types-are-testable-and-mockable), [4.7](#47-types-are-testable-and-mockable) | FastAPI `Depends`; App `HttpClientContext` |
| Derived state during render | [4.13](#413-server-state-and-data-fetching-supporting-all-features) | App `SearchPage.tsx`, `NavigationHistoryProvider.tsx` |
| Design tokens / theme variants | [4.9](#49-design-system-material-ui-while-design--experience-defines-the-full-experience) | App `app/theme.ts` |
| Exception hierarchy and global handlers | [2.12](#212-error-handling-as-architecture-global-exception-handlers-resilience-per-integration) | API `core/errors.py` |
| Exception translation | [2.12](#212-error-handling-as-architecture-global-exception-handlers-resilience-per-integration) | API `catalog/tvmaze.py`, `bee_review/llm.py` |
| Fakes over mocks | [2.8](#28-types-are-testable-and-mockable), [4.7](#47-types-are-testable-and-mockable) | API `tests/fakes.py`; App `test/fakeHttpClient.ts` |
| Factory (functions and classmethods) | [2.6](#26-idiomatic-python-object-oriented-paradigm), [4.7](#47-types-are-testable-and-mockable) | `from_domain`, `build_*`, `create*Api` |
| Feature folders / Vertical slices | [2.3](#23-vertical-slice-architecture-self-contained-features-no-cross-dependencies), [4.4](#44-feature-folder-development-self-contained-features) | API `features/`; App `features/` |
| Health checks (liveness and readiness) | [5.4](#54-automation-everything-runs-with-a-single-command) | API `features/health`; Dockerfiles; compose |
| Idempotent operations | [2.2](#22-rest-over-http-all-common-rest-conventions-observed), [3](#3-application-database) | `watched-episodes` PUT/DELETE; composite key |
| Inversion of Control via slots (render props) | [4.4](#44-feature-folder-development-self-contained-features) | App `EpisodeTile.tsx`, `ShowHeader.tsx` |
| Lazy loading (routes, images, dialogs) | [4.2](#42-single-page-application), [4.10](#410-basic-responsiveness), [4.13](#413-server-state-and-data-fetching-supporting-all-features) | App `routes.tsx`, tiles, dialogs |
| Mapper | [2.15](#215-vendor-lock-in-proofing-catalog-partner) | API `TvMazeMapper` |
| Migrations (schema as code) | [3](#3-application-database) | API `migrations/`, `app/migrate.py` |
| Multi-stage build / quality gate stage | [5.2](#52-one-container-per-deployable-persistent-storage-for-the-database), [5.5](#55-tests-unit-and-integration-are-a-mandatory-gate-for-every-build-deployment-action) | Both Dockerfiles |
| Optimistic update with rollback | [4.12](#412-friendly-error-handling-through-creative-ux-for-service-unavailability) | App `useWatchedEpisodes.ts` |
| Optimistic concurrency (insert race) | [3](#3-application-database) | API `watch_tracking/repository.py` |
| Port and Adapter (hexagonal seams) | [2.5](#25-solid), [2.14](#214-ai-integration-bee-review-isolated-failure-tolerant-with-a-clear-fallback), [2.15](#215-vendor-lock-in-proofing-catalog-partner) | ABC ports; adapters |
| Presentational / container components | [4.5](#45-solid-frontend) | App `WatchedToggle.tsx` |
| Problem Details (RFC 9457) | [2.2](#22-rest-over-http-all-common-rest-conventions-observed) | API `core/errors.py` |
| Repository | [3](#3-application-database) | API `*/repository.py`, `bee_review/opinions.py` |
| Retry with exponential backoff | [2.12](#212-error-handling-as-architecture-global-exception-handlers-resilience-per-integration) | API `core/resilience.py`; App `queryClient.ts` |
| Reverse proxy (same origin) | [1.1](#11-two-tier-restful-backend-and-a-single-page-application) | App `nginx.conf.template` |
| Session per request (unit of work) | [3](#3-application-database) | API `core/db.py` |
| Settings / 12-factor config | [2.1](#21-python-and-fastapi-endpoints-are-lightweight-functions), [5.1](#51-docker-compose-v33) | API `core/config.py`; `.env.example` |
| Shared kernel | [2.3](#23-vertical-slice-architecture-self-contained-features-no-cross-dependencies), [4.4](#44-feature-folder-development-self-contained-features) | API `core/`; App `shared/` |
| Stale-while-revalidate | [4.12](#412-friendly-error-handling-through-creative-ux-for-service-unavailability) | App `useShowSearch.ts` |
| Strategy | [2.14](#214-ai-integration-bee-review-isolated-failure-tolerant-with-a-clear-fallback) | API `InsightGenerator` implementations |
| Table-driven configuration | [4.12](#412-friendly-error-handling-through-creative-ux-for-service-unavailability), [2.14](#214-ai-integration-bee-review-isolated-failure-tolerant-with-a-clear-fallback) | App `errorCopy.ts`; API `GENRE_HOOKS` |
| Transaction Script (use case in handler) | [2.4](#24-use-cases-implemented-within-the-endpoint-handler) | API `features/*/endpoints.py` |
| Value Object | [2.6](#26-idiomatic-python-object-oriented-paradigm) | API catalog models, `InsightSubject` |
