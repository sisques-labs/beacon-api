## Exploration: notification-delivery-decoupling

### Seed idea (informal)

Separate notification creation/persistence from delivery: consume from the source → persist to DB → publish a job to a queue → a BullMQ-based worker picks it up and attempts delivery with retries → on success, mark the notification as sent.

### Current State

The flow is: `NotificationIngestConsumer` (`@KafkaMessageHandler` from `@sisques-labs/nestjs-kit/messaging`, **not** raw kafkajs — `beacon-mvp/design.md` D1 is stale, superseded by commit `1a79176`) → `CreateNotificationCommand` → `CreateNotificationCommandHandler` (dedupe check, builds aggregate, `create()`, saves `PENDING`, `publishEvents()`) → `NotificationCreatedEvent` fires `DeliverNotificationOnCreatedHandler` (`@EventsHandler`, **not awaited** — `EventBus.publish()` fire-and-forgets async subscribers, existing design decision D2) → dispatches `DeliverNotificationCommand` → `DeliverNotificationCommandHandler` calls `INotificationSenderPort.send()` **once, no retry** (the e2e test literally asserts "never retries") → `sent()`/`fail(reason)` on the aggregate.

Creation and delivery are **already decoupled at the CQRS/event layer**, not synchronously coupled as the seed idea assumed. The real gap is process/transport-level: delivery has no persisted "attempt pending" state, no retry/backoff, and no crash-durability — if the process dies mid-delivery the notification stays `PENDING` forever with no re-drive.

Correction to the seed idea: the Discord adapter uses `@nestjs/axios`'s `HttpService` (axios), not native `fetch`.

### Affected Areas

- `src/contexts/notifications/application/events/deliver-notification-on-created.handler.ts` — would switch from direct `CommandBus.execute()` to enqueuing a job.
- `src/contexts/notifications/application/commands/deliver-notification/deliver-notification.handler.ts` — zero retry logic exists here today; this is where retry-triggered re-dispatch would land.
- `src/contexts/notifications/domain/aggregates/notification.aggregate.ts` — `assertTransition` structurally makes SENT/FAILED terminal (no code ever targets them as a source). `PENDING` can remain the sole pre-terminal state through every retry with zero aggregate changes, or a new `QUEUED`/`RETRYING` status could be added — open decision, not required by anything discovered.
- `src/contexts/notifications/domain/enums/notification-status.enum.ts` — only touched if a new status is introduced.
- `src/contexts/notifications/notifications.module.ts`, `src/core/core.module.ts`, `src/core/config/` — new provider wiring following the existing named-array + env-gated-config convention (like `kafka-ingest.config.ts`).
- `docker-compose.yml` — **no Redis service exists** (only postgres, jaeger, otel-collector, prometheus). BullMQ requires Redis — this is new infra, not just an npm install.
- `test/notification-delivery.e2e-spec.ts` — already polls (`waitForTerminalStatus`, 3s/25ms) because of the existing fire-and-forget `EventBus`. A queue+worker adds another async hop plus BullMQ's own backoff timers, making this pattern more fragile.

### Verified Facts (not assumptions)

- **No BullMQ/`@nestjs/bull(mq)`/`ioredis`/`redis`** anywhere in `package.json`.
- **`@sisques-labs/nestjs-kit@1.11.0`'s `messaging` entrypoint is Kafka-only** — `KafkaMessageHandler`, `IInboundMessage`, `MessagingModule`, `KafkajsEventConsumerAdapter/PublisherAdapter`, `EventRoutingService`, etc. Grepped the entire kit `dist/` tree for `queue|Queue|bullmq|Bull`: zero matches. **No queue/job abstraction exists in the kit** — reusing it is not viable; BullMQ would need to be added directly to `beacon-api`.

### Hexagonal Placement (per `.claude/skills/architecture/SKILL.md`)

- Producer side: a new port in `application/ports/` (e.g. `INotificationDeliveryQueuePort`) implemented by a BullMQ adapter in `infrastructure/adapters/` (or a new `infrastructure/queue/` subtree — not an existing convention, would be a new decision).
- Worker/consumer side: transport-equivalent to `transport/kafka/consumers/` today — a thin `transport/queue/processors/{name}.processor.ts` dispatching into `CommandBus`, same pattern as `NotificationIngestConsumer`.
- Whether the worker runs in-process (same `notifications.module.ts`) or as a separate entrypoint/process: **no precedent either way** — this repo has only one bootstrap (`src/main.ts`). Delivery stays inside the `notifications` context regardless (the context-boundary rule in `openspec/config.yaml` forbids a new top-level context for this).

### Candidate Approaches

1. **In-process BullMQ worker, same Nest app** — `BullModule` wired alongside existing modules. Pros: no new deployment artifact, reuses DI/config/OTel instrumentation. Cons: delivery competes for the same process as Kafka ingestion; can't scale independently. Effort: Medium.
2. **Separate worker process/entrypoint** — new bootstrap file, second container. Pros: independent scaling/failure isolation, matches typical BullMQ topology. Cons: zero precedent in this repo, duplicated bootstrap (config validation, TypeORM, telemetry). Effort: High.
3. **Reuse an existing nestjs-kit abstraction** — ruled out: the kit has no queue primitive at all in v1.11.0.

### Open Product Decisions (surface, do not decide)

1. **Retry/backoff policy** (fixed vs exponential, max attempts) — BullMQ supports both via job options, but the policy itself is a product decision.
2. **Terminal outcome on exhausted retries**: reuse `fail()`/`FAILED` (reusable as-is, free-text reason already supported), or a separate dead-letter path outside the aggregate's state machine?
3. **Job payload**: full notification snapshot vs `{ notificationId }` re-fetch (the existing `DeliverNotificationCommand` already uses the re-fetch shape — no changes needed if mirrored).
4. **In-process worker vs separate process** — no existing precedent to lean on.
5. **New intermediate status vs `PENDING` covering the whole retry window.**
6. **Redis as new infra**: deployment/health-check impact via `src/core/health/` is unaddressed here.

### Risks

- Redis has zero existing footprint in this repo (no docker-compose service, no health check) — real ops work, not "just add a library."
- Existing e2e polling pattern is fragile under an added queue+worker async hop; timeout/draining strategy needs explicit design, not just longer timeouts.
- No precedent for a second process entrypoint if approach 2 is chosen — real bootstrap-duplication cost.
- `openspec/changes/beacon-mvp/design.md` D1 is already stale vs. current code; future artifacts should verify against code, not just that doc.

### Ready for Proposal

Yes.
