# Proposal: Durable, retrying notification delivery via BullMQ

## Intent

Creation and delivery are already event-decoupled (`NotificationCreatedEvent` → un-awaited `@EventsHandler` → `DeliverNotificationCommand`), but delivery attempts **exactly once**: no retry, no backoff, no crash-durability. A transient webhook error or a mid-delivery crash leaves the notification `PENDING` forever with no re-drive. Impacted bounded context: `notifications` only.

## Scope

### In Scope
- BullMQ + Redis in `beacon-api`: `BullModule` root wiring, env-gated config following `kafka-ingest.config.ts`.
- `redis` service in `docker-compose.yml` + Redis health indicator in `src/core/health/`, mirroring Postgres.
- Delivery-queue port in `application/ports/` with a BullMQ producer adapter in `infrastructure/`.
- In-process worker/processor in `transport/` dispatching the existing `DeliverNotificationCommand` (bus-only, like `NotificationIngestConsumer`).
- Bounded retry with backoff; exhaustion terminates via the existing `aggregate.fail(reason)` → `FAILED`.
- Unit + integration + e2e coverage for enqueue, retry, exhaustion.

### Out of Scope
- Any change to Kafka ingestion; a separate worker process/entrypoint; dead-letter queue or admin requeue UI; new channels; aggregate state-machine redesign.

## Capabilities

### New Capabilities
- `notification-delivery-queue`: durable enqueue, in-process worker consumption, retry/backoff policy, Redis readiness.

### Modified Capabilities
- `notification-delivery`: retried until success or attempt exhaustion; `FAILED` becomes the exhausted-retry terminal, not the first-error terminal. (Spec lives in the unarchived `beacon-mvp` change; `openspec/specs/` is empty.)

## Confirmed Decisions (settled — do not re-open)

| # | Decision | Rationale |
|---|----------|-----------|
| C1 | BullMQ + Redis, not Kafka | Kafka lacks native per-job retry/backoff/delay (needs chained retry-topics + DLQ); BullMQ has `attempts`/`backoff` built in |
| C2 | In-process worker, same Nest app | Reuses DI/config/OTel; zero repo precedent for a second bootstrap |
| C3 | Redis is new infra (compose + health check) | Verified absent from the repo today |
| C4 | Exhausted retries → existing `FAILED` | `fail(reason)` + terminal `FAILED` already exist; no aggregate change |
| C5 | No research phase | User opted out; remaining items are product decisions, not evidence gaps |

## Open for `sdd-design`

1. New intermediate status (`QUEUED`/`RETRYING`) vs. `PENDING` spanning the retry window (zero aggregate changes).
2. Job payload: full snapshot vs. `{ notificationId }` re-fetch (mirrors today's command; no new DTO).
3. Attempt count and backoff curve (fixed vs. exponential).
4. Whether `waitForTerminalStatus` polling survives the extra async hop or needs queue-draining hooks.

## Approach

`DeliverNotificationOnCreatedHandler` enqueues through the new port instead of calling `CommandBus` directly. A BullMQ worker consumes the job and dispatches the unchanged `DeliverNotificationCommand`, so delivery logic stays put; BullMQ owns attempts/backoff and the final failed attempt drives `fail(reason)`. Redis durability replaces the in-memory event hop as the crash-recovery boundary.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.../application/events/deliver-notification-on-created.handler.ts` | Modified | enqueue instead of direct dispatch |
| `.../application/ports/`, `.../infrastructure/`, `.../transport/` | New | queue port, BullMQ adapter, processor |
| `.../application/commands/deliver-notification/` | Modified | signal retryable vs. terminal failure |
| `notifications.module.ts`, `src/core/core.module.ts`, `src/core/config/` | Modified | BullMQ + Redis wiring |
| `src/core/health/`, `docker-compose.yml`, `.env.example` | New/Modified | Redis service + health indicator |
| `test/notification-delivery.e2e-spec.ts` | Modified | its "never retries" assertion is now false |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Redis is brand-new ops surface (compose, config, health, prod provisioning) | High | Explicitly in scope; indicator mirrors Postgres |
| E2E flakiness from the added async hop + backoff timers | High | Open item 4: draining hooks or test-profile backoff, not longer timeouts |
| Duplicate sends if a retry follows a partial success | Med | Design must state at-least-once; dedupe stays creation-side |
| Redis outage blocks enqueue | Med | Notification stays persisted `PENDING`; enqueue failure logged, never swallowed |
| Exceeds the 400-line PR budget | High | Chained slices: (1) Redis/BullMQ infra + health, (2) port/adapter/processor, (3) retry policy + tests |

## Rollback Plan

1. Revert the feature branch(es); the event handler returns to direct `CommandBus.execute()`.
2. Remove `BullModule` wiring + Redis health indicator; unset Redis env vars.
3. Drop the `redis` service from compose; no migration to reverse (no aggregate change under C4).
4. Discard residual Redis jobs — undelivered notifications stay `PENDING` and can be re-driven manually.

## Dependencies

- Redis instance (compose locally; managed per environment).
- `bullmq` + `@nestjs/bullmq` (absent today; `@sisques-labs/nestjs-kit@1.11.0` has no queue primitive — verified).

## Success Criteria

- [ ] A transient sender failure is retried and the notification still reaches `SENT`.
- [ ] Exhausted attempts → `FAILED` with `failureReason`, no further attempts.
- [ ] A restart between enqueue and delivery still delivers the notification.
- [ ] Health endpoint reports Redis; readiness fails when Redis is down.
- [ ] `pnpm test`, `test:integration`, `test:e2e`, `lint`, `build` pass; coverage ≥ 80%.
