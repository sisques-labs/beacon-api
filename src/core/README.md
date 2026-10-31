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

| Var              | Required | Default |
| ---------------- | -------- | ------- |
| `REDIS_HOST`     | **Yes**  | —       |
| `REDIS_PORT`     | No       | `6379`  |
| `REDIS_PASSWORD` | No       | (none)  |
| `REDIS_DB`       | No       | `0`     |

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

## Crypto (`src/core/crypto/`)

`AesGcmCipherService` (design.md D4/D5/D6) is a context-agnostic AES-256-GCM
encryption service, internal to `CryptoModule` (`@Global`). Contexts do not
inject it: they dispatch `EncryptSecretCommand` / `DecryptSecretCommand`
(`crypto/application/commands/`, primitives-only, handled by delegating to the
service) through the `CommandBus`. It produces/consumes a self-describing envelope
`v{keyVersion}:{iv}:{authTag}:{ciphertext}` (all parts base64url), meant for
storage in one `text` column. `encrypt()` uses a fresh 12-byte IV every call.
Callers MUST pass the same AAD to `decrypt()` used at `encrypt()` time — a
mismatch, or any tampering of the envelope, fails the GCM auth tag check and
throws.

Core has no notion of "context": a bounded context that needs encryption
defines its own async `ISecretCipherPort` (`application/ports/`) and a thin
adapter in `infrastructure/adapters/` that injects `CommandBus` and dispatches
those commands. The command classes are the only `@core/crypto` symbols a
context may import (shared-kernel contract); never the service or module.
Handlers and exceptions must not log plaintext, secrets or envelopes.

| Var                              | Required | Default                                                                |
| -------------------------------- | -------- | ---------------------------------------------------------------------- |
| `SECRETS_ENCRYPTION_KEY`         | **Yes**  | — (canonical base64 of exactly 32 bytes, `^[A-Za-z0-9+/]{43}=$`)       |
| `SECRETS_ENCRYPTION_KEY_VERSION` | No       | `1` (integer, 1-255; an empty value is rejected)                       |
| `SECRETS_ENCRYPTION_KEY_<n>`     | No       | — (retired key for version `n`, same format; kept for decryption only) |

**Key rotation.** `encrypt()` always uses the current key
(`SECRETS_ENCRYPTION_KEY` at `SECRETS_ENCRYPTION_KEY_VERSION`); `decrypt()`
picks the key from the envelope's `v{n}` prefix. To rotate: generate a new key,
move the old one to `SECRETS_ENCRYPTION_KEY_<oldVersion>`, set the new key as
`SECRETS_ENCRYPTION_KEY` and bump `SECRETS_ENCRYPTION_KEY_VERSION`. An envelope
whose version is neither current nor in the keyring fails with
`Unknown encryption key version`. Every configured key is validated at boot
(`env.validation.ts` and `crypto.config.ts` share `crypto-env.parser.ts`).

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
