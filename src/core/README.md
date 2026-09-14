# `src/core` — cross-cutting infrastructure

Infrastructure every bounded context relies on: config, database, health,
observability, and shared transports. Wired once in `CoreModule` and
imported by `AppModule` — bounded contexts never import from here except
through the shared building blocks documented below.

## Config

Env-driven config lives in `src/core/config/`, one `registerAs(...)` module
per concern, loaded by `ConfigModule.forRoot({ load: [...] })` in
`core.module.ts`. `env.validation.ts` (Zod) validates required vars at boot
— the process fails fast rather than booting half-configured.

### Redis (`redis.config.ts`)

Redis is a **required** dependency, not opt-in — unlike Kafka ingestion
(`kafka-ingest.config.ts`, gated behind `KAFKA_INGEST_ENABLED`), a queue's
delivery durability must never be silently disabled behind a flag (see
`openspec/changes/notification-delivery-decoupling/design.md` D7). Wired
unconditionally via `BullModule.forRootAsync` in `core.module.ts`.

| Var | Required | Default |
|---|---|---|
| `REDIS_HOST` | **Yes** | — |
| `REDIS_PORT` | No | `6379` |
| `REDIS_PASSWORD` | No | (none) |
| `REDIS_DB` | No | `0` |

Local dev: `docker-compose.yml`'s `redis` service (port `6381`, AOF
persistence). Tests: `docker-compose.test.yml`'s `redis-test` service (port
`6382`), started via `pnpm test:db:up`.

## Health (`src/core/health/`)

`HealthController` (`GET /health`, `/health/live`, `/health/ready`) via
`@nestjs/terminus`. `/health/ready` checks every required infrastructure
dependency:

- **Database** — `TypeOrmHealthIndicator.pingCheck('database')`.
- **Redis** — `RedisHealthIndicator.pingCheck('redis')`
  (`indicators/redis.health-indicator.ts`). Uses its own small, dedicated
  `ioredis` client (`REDIS_HEALTH_CLIENT`, provided in `HealthModule`)
  rather than reusing BullMQ's connection — BullMQ requires
  `maxRetriesPerRequest: null` and holds blocking connections, a known
  footgun for a simple ping (design.md D8). Reports `{ redis: { status:
  'up' } }` or `{ redis: { status: 'down', message: '<error>' } }`; a down
  Redis fails the whole readiness check with a 503, distinguishable from a
  database failure by the `redis` key in the response body.

## Other cross-cutting modules

- `src/core/observability/` — OpenTelemetry traces/metrics; every
  CommandBus/QueryBus dispatch is auto-instrumented via
  `CqrsObservabilityService`, no per-handler wiring needed.
- `src/core/messaging/` — Kafka outbound domain-event forwarding (from
  `@sisques-labs/nestjs-kit/messaging`) and inbound consumer routing.
- `src/core/filters/` — `BaseExceptionFilter`, extended per-context via
  `resolveNotificationsExceptionStatus`-style registration.
- `src/core/transport/graphql/` — shared GraphQL enum registration.

## Auth

`JwtAuthGuard` + `@CurrentUser()` (from `@sisques-labs/nestjs-kit/auth-client`,
wired via `AuthClientModule.forRootAsync` in `core.module.ts`) verify a
Sisques Account access token and populate `request.user` — opt-in per
service via `AUTH_ENABLED` + `AUTH_JWT_SECRET`.
