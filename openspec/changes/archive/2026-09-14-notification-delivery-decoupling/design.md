# Design: Durable, retrying notification delivery via BullMQ

## Technical Approach

`DeliverNotificationOnCreatedHandler` stops dispatching `DeliverNotificationCommand` directly and enqueues through a new `INotificationDeliveryQueuePort`. A BullMQ `WorkerHost` in `transport/queue/` consumes the job and dispatches the same command, so delivery logic never leaves application. BullMQ owns attempts/backoff/durability; `NotificationAggregate` is untouched — no new status, no enum, no migration. Redis joins Postgres as a required dependency with its own readiness indicator.

## Architecture Decisions

| # | Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|---|
| D1 | Status model during retries | **No new status** — `PENDING` spans the whole retry window | `QUEUED` / `RETRYING` enum values | `assertTransition` is a single-expected-state guard, so a new status forces edits to the enum, the status VO, `sent()`/`fail()`/`cancel()` guards, the TypeORM enum column (**migration**), the registered GraphQL enum and the filterable-fields registry — for zero behavioural gain. `PENDING` already means "not yet delivered"; BullMQ is the authoritative attempt-state store. Consistent with C4. Cost accepted: attempt count is not queryable over REST/GraphQL. Bonus: the e2e `!== 'PENDING'` predicate keeps working unchanged. |
| D2 | Job payload | `{ notificationId: string }` only; `jobId = notificationId` | Full `INotificationPrimitives` snapshot | Mirrors today's command, so no new DTO. The handler must re-load the aggregate to mutate and save it anyway, and after a backoff delay a snapshot is stale (the notification may have been cancelled between attempts). Attempt metadata is free from `job.attemptsMade` / `job.opts.attempts` — never a payload field. Also keeps `title`/`body` **out of Redis**, so the new datastore holds no notification content. `jobId = notificationId` makes enqueue idempotent for the job's lifetime. |
| D3 | Retry policy | `attempts: 5`, `backoff: { type: 'exponential', delay: 5000 }` → 5s/10s/20s/40s, terminal at ≈75s | Fixed backoff; 3 attempts; 10-attempt long tail | Exponential covers Discord 5xx blips and webhook rate-limit windows (seconds to a minute) while bounding unresolved time to ~90s — a notification that lands 10 minutes late is noise. Both knobs are env-tunable so production widens the curve without a code change. No jitter in v1 (single webhook destination, low volume) — noted as a limitation. |
| D4 | Retryable vs. terminal signalling | Processor derives `isFinalAttempt` from `job.attemptsMade + 1 >= job.opts.attempts` and passes it on the command. Handler **throws** `NotificationDeliveryFailedException` on every failed attempt; only on the final one does it first run `fail(reason)` + `save` + `publishEvents` | Processor calling the repository; handler reading BullMQ job state | Today the handler calls `fail()` on the first error, which is terminal and would make retries impossible. Throwing is BullMQ's only retry signal. Deriving the flag in transport keeps BullMQ types out of application (hard rule: transport is bus-only). Throwing after persisting `FAILED` also records the job in BullMQ's failed set for ops inspection. |
| D5 | Duplicate sends | Guard in `DeliverNotificationCommandHandler`: if the loaded aggregate is not `PENDING`, log and return without calling the sender. At-least-once otherwise **accepted** for v1 | Provider-side idempotency key; distributed lock | The aggregate is already loaded, so the guard is free. It closes the observable window (a concurrently-succeeded attempt already wrote `SENT`) and the likeliest real duplicate source — BullMQ stalled-job re-delivery after lock expiry. It also stops `fail()`/`sent()` from throwing `InvalidNotificationStatusTransitionException` on an already-terminal aggregate. It does **not** close the true partial-success window (Discord accepted the POST, response lost); Discord webhooks expose no idempotency key, so that stays a documented limitation. |
| D6 | Port / adapter / worker placement | Port `application/ports/notification-delivery-queue.port.ts`; adapter `infrastructure/adapters/bullmq-notification-delivery-queue.adapter.ts`; worker `transport/queue/processors/notification-delivery.processor.ts` | `infrastructure/queue/` subtree; worker in application | Extends the archived D6 pair (`ports/` + `infrastructure/adapters/`) already used for the Discord sender. `transport/queue/processors/` sits beside the existing `transport/kafka/consumers/` and is bus-only, exactly like `NotificationIngestConsumer`. |
| D7 | Redis is required, not env-gated | Unconditional `BullModule.forRootAsync` in `core.module.ts`; `REDIS_HOST` required in `env.validation.ts` like `DATABASE_HOST` | `REDIS_ENABLED` flag with direct-`CommandBus` fallback (as the proposal's "env-gated like `kafka-ingest.config.ts`" implied) | **Design-time correction to the proposal.** Ingestion is genuinely optional; delivery is not. A gated fallback preserves the exactly-once bug behind a flag and doubles the paths under test, and a half-configured service that silently never delivers is worse than one that refuses to boot. |
| D8 | Redis health check | Dedicated `ioredis` client provided inside `HealthModule` + `RedisHealthIndicator.pingCheck('redis')` added to `health.controller.ts`'s `ready()` array | Terminus `MicroserviceHealthIndicator`; reusing BullMQ's connection | `@nestjs/microservices` is not installed (archived D1). BullMQ requires `maxRetriesPerRequest: null` and holds blocking connections, so sharing its client for pings is a known footgun — BullMQ gets connection *options* from the same `redisConfig`, the indicator gets its own small client. |

## Data Flow

```
NotificationCreatedEvent (in-process)
  ▼
DeliverNotificationOnCreatedHandler
  └─ INotificationDeliveryQueuePort.enqueue(id)
       ▼
     BullMqNotificationDeliveryQueueAdapter ──► Redis  [job {notificationId}, jobId=id]
                                                  │  (durable across restart)
                                                  ▼
                              NotificationDeliveryProcessor  (@Processor, WorkerHost)
                                  │ isFinalAttempt = attemptsMade + 1 >= attempts
                                  ▼ CommandBus
                              DeliverNotificationCommandHandler
                                  │ load aggregate
                                  ├─ status !== PENDING ──► log + return      (D5)
                                  ├─ senderPort.send() ──► Discord webhook
                                  │     ok    → sent() + save        [SENT]   ─► job completed
                                  │     err   → isFinalAttempt?
                                  │              no  → throw                  ─► BullMQ backoff, re-queue
                                  │              yes → fail(r) + save [FAILED] + throw ─► job failed
```

## File Changes

| Path | Action | Description |
|---|---|---|
| `src/contexts/notifications/application/ports/notification-delivery-queue.port.ts` | Create | `INotificationDeliveryQueuePort` + `NOTIFICATION_DELIVERY_QUEUE_PORT` Symbol |
| `.../application/ports/notification-delivery-job-data.interface.ts` | Create | `{ notificationId: string }` — shared producer/consumer contract, one type per file |
| `.../application/events/deliver-notification-on-created.handler.ts` | Modify | Inject the port, `enqueue()` instead of `commandBus.execute()` |
| `.../application/commands/deliver-notification/deliver-notification.command.ts` | Modify | Add `isFinalAttempt: boolean` |
| `.../application/commands/deliver-notification/deliver-notification.handler.ts` | Modify | D5 status guard; D4 throw-vs-`fail()` branch |
| `.../domain/exceptions/notification-delivery-failed.exception.ts` | Create | Retry signal, `extends BaseException`, beside `InvalidNotificationStatusTransitionException` |
| `.../infrastructure/adapters/bullmq-notification-delivery-queue.adapter.ts` | Create | `@InjectQueue(...)`, `add()` with `jobId`, `attempts`, `backoff` from config |
| `.../infrastructure/config/notification-delivery-queue.config.ts` (+ `interfaces/`) | Create | `registerAs('notificationDeliveryQueue', ...)`, beside the existing `discord.config.ts` |
| `.../transport/queue/processors/notification-delivery.processor.ts` | Create | `@Processor` + `WorkerHost`, bus-only, logs `attempt N/M` |
| `.../notifications.module.ts` | Modify | `BullModule.registerQueue`, `ConfigModule.forFeature`, `QUEUE_PROCESSORS`, port→adapter binding |
| `src/core/config/redis.config.ts` (+ `interfaces/redis-config.interface.ts`) | Create | `REDIS_{HOST,PORT,PASSWORD,DB}` |
| `src/core/config/env.validation.ts` | Modify | `REDIS_HOST` required; port/password/db and the queue knobs optional |
| `src/core/core.module.ts` | Modify | Load `redisConfig`; `BullModule.forRootAsync` |
| `src/core/health/indicators/redis.health-indicator.ts`, `health.module.ts`, `health.controller.ts` | Create/Modify | D8 readiness check |
| `docker-compose.yml` | Modify | `redis:8-alpine`, `6381:6379`, `--appendonly yes`, `redis_data` volume, `redis-cli ping` healthcheck |
| `.github/workflows/ci.yml` | Modify | `redis` service + env for both the e2e and integration jobs |
| `test/notification-delivery.e2e-spec.ts`, `test/helpers/queue-drain.ts` | Modify/Create | D9 |
| `src/contexts/notifications/README.md`, `src/core/README.md` | Modify/Create | Document the new env vars (this repo has **no** `.env.example` — the proposal assumed one) |
| `package.json` | Modify | `+bullmq`, `+@nestjs/bullmq`, `+ioredis` |

## Interfaces / Contracts

```ts
export const NOTIFICATION_DELIVERY_QUEUE_PORT = Symbol('NOTIFICATION_DELIVERY_QUEUE_PORT');

export interface INotificationDeliveryQueuePort {
  enqueue(notificationId: string): Promise<void>;
}
```

Env: `REDIS_HOST` (required), `REDIS_PORT` (6379), `REDIS_PASSWORD`, `REDIS_DB`, `NOTIFICATION_DELIVERY_QUEUE_NAME` (`notification-delivery`), `NOTIFICATION_DELIVERY_QUEUE_ATTEMPTS` (5), `NOTIFICATION_DELIVERY_QUEUE_BACKOFF_MS` (5000).

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit | Event handler enqueues (never dispatches); adapter passes `jobId`/`attempts`/`backoff`; processor derives `isFinalAttempt` and rethrows; handler's D5 guard and D4 throw-vs-`fail()` branch; configs | `Mocked<T>`, manual instantiation, no `@nestjs/testing` |
| Integration | Adapter → real Redis round-trip; delayed job re-runs after backoff; `jobId` collision is a no-op | Real Redis alongside real Postgres, slim bootstrap |
| E2E | Transient failure then success → `SENT` with >1 `post` call; permanent failure → exactly `attempts` calls then `FAILED` | See D9 |

**D9 — E2E strategy.** `waitForTerminalStatus` survives unchanged, because D1 keeps the status `PENDING` across the entire retry window, so its `!== 'PENDING'` predicate still fires exactly once on `SENT`/`FAILED`. Four concrete changes:

1. **Test-profile queue config**, not longer sleeps: the CI/e2e env sets `NOTIFICATION_DELIVERY_QUEUE_ATTEMPTS=3` and `NOTIFICATION_DELIVERY_QUEUE_BACKOFF_MS=10`, so full exhaustion costs ~30ms of backoff instead of 75s. Raise the `waitForTerminalStatus` default timeout `3000 → 10000` to absorb Redis round-trips.
2. **Deterministic drain hook** replacing the `setTimeout(50)` "give any accidental retry a chance" sleep: a new `test/helpers/queue-drain.ts` exporting `waitForQueueDrained(queue)`, polling `queue.getJobCounts('active', 'waiting', 'delayed')` until all are zero. The spec resolves the queue with `ctx.app.get(getQueueToken(queueName))`.
3. **Isolation**: `beforeEach` calls `queue.obliterate({ force: true })` beside `truncateAll`, and the e2e env suffixes the queue name per run so repeat/parallel runs never consume each other's jobs.
4. **Rewrite the false assertion**: "…and never retries" becomes "retries until exhaustion then FAILED", asserting `postSpy` was called exactly `attempts` times.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary; the worker is in-process, not a subprocess. The two real new boundaries are handled inline: Redis credentials stay in env/config (never in code), and D2 keeps notification content out of Redis by putting only a UUID on the wire.

## Migration / Rollout

No database migration — D1 and C4 mean the aggregate, enum and schema are untouched. Provision Redis first (compose locally, managed per environment), deploy with `REDIS_HOST` set; the service fails fast at boot without it (D7). Rollback is code-only: revert the branch, drop the `redis` service, unset the env vars; in-flight jobs are discarded and their notifications stay `PENDING`, still queryable and re-drivable.

**Observability.** No new wiring: `CqrsObservabilityService` already wraps `CommandBus.execute`, so every retry attempt emits its own `command.DeliverNotificationCommand` span and `cqrs.handler.count{status=error}` metric. Known gap: the Redis hop drops trace context, so attempts are sibling traces rather than one linked trace — `job.id === notificationId` is the correlation key, and the processor logs `attempt N/M` per run. Enqueue failures are logged at `error` and rethrown, never swallowed.

## Open Questions

- [ ] Production Redis provisioning (managed instance vs. sidecar) and whether AOF persistence is enabled there — local compose sets `--appendonly yes` because job durability is the point of this change.
- [ ] Whether `removeOnFail` should retain a bounded failed-job history for ops inspection, or rely solely on the persisted `FAILED` status.
