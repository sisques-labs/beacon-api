# NestJS Template

Sisques Labs' base template for new NestJS services: **DDD + CQRS + Hexagonal**
architecture, TypeORM/PostgreSQL, optional Kafka event forwarding, REST
(Swagger) + GraphQL (Apollo) transports, structured logging
(`@sisques-labs/nestjs-kit` + Winston), OpenTelemetry traces + metrics + logs, an MCP
endpoint, health checks, and the CI/CD workflows this org uses in production —
all wired and ready to clone into a new service.

It ships with **zero bounded contexts** (`src/contexts/`) on purpose: the
cross-cutting infrastructure (`src/core/`, `src/support/`) is the whole point
of this repo, and the first context your new service adds defines the pattern
every subsequent one follows (see the `architecture` skill in
`.claude/skills/architecture/SKILL.md`).

## Using this template for a new service

1. Create the new repo from this template (GitHub "Use this template", or
   clone + re-init git).
2. Rename the placeholder identifiers in one shot:
   ```bash
   scripts/rename-service.sh orders-api "Orders API"
   pnpm install
   ```
   This rewrites every occurrence of `nestjs-template` / `NestJS Template` —
   `package.json`, Docker image names in `.github/workflows/`, the Kafka
   client id/topic prefix defaults, the default `OTEL_SERVICE_NAME`, the MCP
   server name, docker-compose database names, and this README.
3. Copy `.env.example` to `.env` and fill in real values.
4. `pnpm test:db:up` to start a local Postgres, then `pnpm dev`.
5. Add your first bounded context under `src/contexts/` and register its
   module in `CONTEXT_MODULES` in `src/contexts/contexts.module.ts` — invoke
   the `architecture` skill (or read `.claude/skills/architecture/SKILL.md`
   directly) for the DDD+CQRS+Hexagonal layer rules and file naming.

## What's included

| Area | Where | Notes |
|------|-------|-------|
| Config + env validation | `src/core/config/` | Zod-validated env vars, CORS origin resolution |
| Health checks | `src/core/health/` | `GET /api/health/live` (liveness), `GET /api/health/ready` (DB ping via `@nestjs/terminus`) |
| Logging | `src/support/logging/` | Winston via `@sisques-labs/nestjs-kit`, JSON file + console transports, plus an OTel transport forwarding to the pipeline below |
| Kafka event forwarding | `@sisques-labs/nestjs-kit/messaging` (wired in `src/core/core.module.ts`); `src/core/messaging/` keeps only the app-local, auto-generated aggregate→topic map | Opt-in (`KAFKA_ENABLED`), no-op when disabled |
| OpenTelemetry | `src/telemetry.ts` (bootstrap), `src/core/observability/` (CQRS spans+metrics) | Traces + metrics + logs exported via OTLP to a collector; all disabled together until `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Auto-instruments HTTP/Express, GraphQL, Postgres, Kafka; CQRS command/query buses get spans + duration/count metrics; every Winston log line is forwarded too (`@opentelemetry/winston-transport`), correlated with the active span. `docker-compose.yml` ships a local collector + Jaeger UI (`:16686`) + Prometheus UI (`:9090`) — logs currently just land in the collector's own output (no local log backend wired up yet; swap the `logs` exporter in `docker/otel-collector-config.yaml` for Loki or similar when ready) |
| Auth (Sisques Account) | `@sisques-labs/nestjs-kit/auth-client` (wired in `src/core/core.module.ts`), config in `src/core/config/auth.config.ts` | Verifies JWTs issued by **Sisques Account**, the platform's shared identity/tenancy service — `JwtAuthGuard`, `@CurrentUser()`, `PlatformAdminGuard`. Opt-in (`AUTH_ENABLED` + `AUTH_JWT_SECRET`), no-op until a route actually uses the guard. Never signs tokens — verification only |
| MCP (Model Context Protocol) | `@sisques-labs/nestjs-kit/mcp` (wired in `src/core/core.module.ts`) | `POST /api/mcp`, per-request server, tool auto-discovery |
| REST + GraphQL | `src/main.ts`, `src/core/core.module.ts` | Swagger at `/docs`, Apollo GraphQL at `/graphql` (drop whichever transport you don't need) |
| Database | `src/database/`, TypeORM | Postgres only; migrations in `src/database/migrations/` |
| CI/CD | `.github/workflows/` | `ci.yml` (lint+test+build+e2e+integration), `docker.yml` (PR smoke build), `release.yml` / `release-train.yml` (via `sisques-labs/workflows`) |
| Dev workflow | `AGENTS.md`, `.claude/`, `openspec/` | Architecture skill, OpenSpec propose/apply/archive skills, project conventions in `openspec/config.yaml` |

## Deliberately not included

These are common enough that they shouldn't be baked into every service, but
specific enough that they'd bias the template toward one shape:

- **Tenant-scoped authorization** (what each role is allowed to do inside
  *your* domain) — `@sisques-labs/nestjs-kit/rbac`'s `createTenantPermissionGuard()`
  gives you the mechanism, but your own permission enum and
  role→permission map are always bring-your-own per bounded context (see
  the `architecture` skill's `infrastructure/guards/{name}.guard.ts`
  convention). Verifying *who* the caller is (Sisques Account's JWT) is
  already wired — see "What's included" above; only *what they can do*
  is left to each context. The MCP module's `contextBuilder` option (see
  `McpModule.forRoot(...)` in `src/core/core.module.ts`, and `IMcpContextBuilder`
  from `@sisques-labs/nestjs-kit/mcp`) and `src/core/filters/base-exception.filter.ts`
  both have a documented extension point for when a context needs identity
  inside an MCP tool or a custom error shape.
- **Bounded contexts / business domain** — this is infrastructure only.
- **MongoDB** — `@sisques-labs/nestjs-kit/mongodb` is available if a service
  needs it alongside or instead of Postgres.

## Local development

```bash
pnpm install
pnpm test:db:up      # Postgres on localhost:5434 (dev) — see docker-compose.yml
pnpm dev              # nest start --watch
```

| Script | Description |
|--------|-------------|
| `pnpm dev` / `pnpm debug` / `pnpm prod` | Run the app (watch / debug / prod) |
| `pnpm lint` | ESLint with `--fix` |
| `pnpm test` / `pnpm test:cov` | Unit tests (Vitest, co-located `*.spec.ts`) |
| `pnpm test:e2e` | E2E tests against a real Postgres (`docker-compose.test.yml`) |
| `pnpm test:integration` | Integration tests (persistence boundaries) |
| `pnpm migration:generate` / `:run` / `:revert` | TypeORM migrations |
| `pnpm gen:topics` / `:check` | Regenerate/verify the Kafka aggregate→module map |

Husky runs `pnpm gen:topics` + `lint-staged` on **pre-commit**, and
`pnpm build && pnpm test:changed` on **pre-push**.

See `.env.example` for every environment variable this service reads.

## Architecture

DDD + CQRS + Hexagonal (Screaming Architecture). Full rules, file naming, and
the mandatory find-by-criteria filter pattern live in
`.claude/skills/architecture/SKILL.md`; project-wide conventions (tech stack,
testing layers, apply-time rules) live in `openspec/config.yaml`.
