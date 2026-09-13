# Tasks: Notification Delivery Decoupling

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650-750 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

**Chain strategy unresolved.** `chain_strategy` (stacked-to-main vs feature-branch-chain) was not supplied. Orchestrator must resolve it before `sdd-apply`; units below are strategy-neutral, base branch TBD.

### Suggested Work Units

| Unit | Goal | PR | Focused test | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Redis config + health + compose/CI | PR 1 | `pnpm test src/core/health` | `pnpm test:e2e` (readiness) | Revert redis config, indicator, compose/CI |
| 2 | Queue port/adapter/config + core wiring | PR 2 | `pnpm test .../bullmq-notification-delivery-queue.adapter.spec.ts` | N/A — needs PR 1 Redis | Revert adapter, port, config, core.module wiring |
| 3 | Retry-fix, guard, processor, event handler | PR 3 | `pnpm test .../deliver-notification` | N/A — covered by PR 4 e2e | Revert handler/command/processor/event-handler |
| 4 | E2E rework + drain helper + docs | PR 4 | `pnpm test:e2e -- notification-delivery` | `pnpm test:e2e` full suite | Revert e2e spec + helper to prior version |

## Phase 1: Redis Foundation

- [x] 1.1 Add `bullmq`, `@nestjs/bullmq`, `ioredis` to `package.json` (verify current versions)
- [x] 1.2 Create `src/core/config/interfaces/redis-config.interface.ts` (`IRedisConfig`)
- [x] 1.3 Create `src/core/config/redis.config.ts` — `registerAs('redis', ...)`
- [x] 1.4 Modify `src/core/config/env.validation.ts` — `REDIS_HOST` required, port/password/db optional
- [x] 1.5 Modify `src/core/core.module.ts` — load `redisConfig`, unconditional `BullModule.forRootAsync` (D7)
- [x] 1.6 RED `src/core/health/indicators/redis.health-indicator.spec.ts` — healthy/unhealthy ping cases
- [x] 1.7 GREEN Create `src/core/health/indicators/redis.health-indicator.ts` — dedicated ioredis ping client (D8)
- [x] 1.8 Modify `src/core/health/health.module.ts` — provide `RedisHealthIndicator`
- [x] 1.9 Modify `health.controller.ts` — add `redis.pingCheck('redis')` to `ready()`
- [x] 1.10 Modify `docker-compose.yml` — `redis:8-alpine` service, port, volume, healthcheck
- [x] 1.11 Modify `.github/workflows/ci.yml` — `redis` service in `e2e` and `integration` jobs

## Phase 2: Delivery Queue Port & Adapter

- [x] 2.1 Create `.../application/ports/notification-delivery-job-data.interface.ts`
- [x] 2.2 Create `.../application/ports/notification-delivery-queue.port.ts` — port + Symbol
- [x] 2.3 Create `.../infrastructure/config/interfaces/notification-delivery-queue-config.interface.ts`
- [x] 2.4 Create `.../infrastructure/config/notification-delivery-queue.config.ts` — name/attempts/backoff env
- [x] 2.5 RED `.../infrastructure/adapters/bullmq-notification-delivery-queue.adapter.spec.ts` — `enqueue()` passes `jobId`/`attempts`/`backoff`
- [x] 2.6 GREEN Create `.../infrastructure/adapters/bullmq-notification-delivery-queue.adapter.ts`
- [x] 2.7 Modify `notifications.module.ts` — `BullModule.registerQueue`, `ConfigModule.forFeature`, bind port→adapter

## Phase 3: Retry-Fix & Duplicate Guard

- [ ] 3.1 Create `.../domain/exceptions/notification-delivery-failed.exception.ts`
- [ ] 3.2 Modify `deliver-notification.command.ts` — add `isFinalAttempt: boolean`
- [ ] 3.3 RED extend `deliver-notification.handler.spec.ts` — D5 status guard; non-final throws without `fail()`; final `fail()`+save+publish then throws
- [ ] 3.4 GREEN Modify `deliver-notification.handler.ts` — D5 guard + D4 throw-vs-`fail()` branch
- [ ] 3.5 RED extend `deliver-notification-on-created.handler.spec.ts` — asserts `enqueue()`, never `commandBus.execute`
- [ ] 3.6 GREEN Modify `deliver-notification-on-created.handler.ts` — inject port, `enqueue(event.data.id)`
- [ ] 3.7 RED `.../transport/queue/processors/notification-delivery.processor.spec.ts` — derives `isFinalAttempt`, dispatches, rethrows
- [ ] 3.8 GREEN Create `.../transport/queue/processors/notification-delivery.processor.ts` — `@Processor`/`WorkerHost`
- [ ] 3.9 Modify `notifications.module.ts` — register processor

## Phase 4: E2E & Docs

- [ ] 4.1 Create `test/helpers/queue-drain.ts` — `waitForQueueDrained(queue)` polling job counts
- [ ] 4.2 Modify `test/notification-delivery.e2e-spec.ts` — test-profile env (attempts=3, backoff=10ms), timeout 3000→10000, `queue.obliterate()` in `beforeEach`, rewrite "never retries" to exhausted-retry assertion
- [ ] 4.3 Add e2e scenario: crash-between-enqueue-and-delivery still reaches terminal status
- [ ] 4.4 Modify `src/contexts/notifications/README.md` — document `NOTIFICATION_DELIVERY_QUEUE_*` vars
- [ ] 4.5 Modify `src/core/README.md` — document `REDIS_*` vars and health indicator

## Key Learnings

1. `DeliverNotificationCommandHandler` currently calls `aggregate.fail()` on the first error, making retries structurally impossible without the `isFinalAttempt` fix.
2. Redis is a required dependency per D7 — no `REDIS_ENABLED` gate — to avoid hiding the at-most-once delivery bug behind a flag.
3. `jobId = notificationId` makes BullMQ enqueue idempotent, and no new notification status is introduced since `PENDING` spans the whole retry window.
4. CI's `e2e` and `integration` jobs currently declare only a Postgres service and need a `redis` service added per the design doc.
5. Chain strategy (stacked-to-main vs feature-branch-chain) was not supplied to this phase despite a High budget-risk forecast, so it must be resolved before `sdd-apply`.
