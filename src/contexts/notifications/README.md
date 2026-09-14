# `notifications` bounded context

The first bounded context in this service. It defines the pattern every
subsequent context follows — see `.claude/skills/architecture/SKILL.md`.

## Current state (persistence + Kafka ingestion + durable, retrying Discord delivery + get-by-id query)

`NotificationAggregate` is persistable, ingestible from Kafka, durably
delivered to Discord with retry/backoff, and queryable by id.

### Domain

- `NotificationAggregate` — fields: `tenantId`, `recipientUserId`, `channel`
  (`DISCORD | EMAIL | PUSH`), `status` (`PENDING | SENT | FAILED | CANCELLED
  | READ`), `title`, `body`, `sourceService`, `dedupeKey`, plus terminal
  timestamps (`sentAt`, `readAt`, `cancelledAt`) and `failureReason`.
- Status transitions are enforced by `assertTransition()`; an invalid
  transition raises `InvalidNotificationStatusTransitionException`.
- `NotificationBuilder` constructs the aggregate and its `NotificationViewModel`
  from primitives.

### Persistence

- `infrastructure/persistence/typeorm/entities/notification.entity.ts` — the
  `notifications` table, with a `UNIQUE (tenantId, dedupeKey)` constraint
  enforced by the `1789112026872-create-notifications` migration.
- `NotificationTypeormMapper` — entity ↔ aggregate / view model, via
  `NotificationBuilder`.
- `NotificationTypeormWriteRepository` (`NOTIFICATION_WRITE_REPOSITORY`) —
  implements `INotificationWriteRepository`, including the additive
  `findByDedupeKey(tenantId, dedupeKey)` lookup. Translates a Postgres unique
  violation (`23505`) on save into `NotificationDedupeKeyAlreadyExistsException`.
- `NotificationTypeormReadRepository` (`NOTIFICATION_READ_REPOSITORY`) —
  implements `INotificationReadRepository` for read-side projections.

### Ingestion: Kafka notification-request consumer

- `NotificationIngestConsumer` (`transport/kafka/consumers/`) — a
  `@KafkaMessageHandler`-decorated handler on the kit's declarative inbound
  Kafka consumer (`@sisques-labs/nestjs-kit/messaging`, `MessagingModule`).
  The topic/group are registered via `MessagingModule.forRoot({
  inboundConsumers })` in `core.module.ts`, gated on `KAFKA_INGEST_ENABLED` —
  independent from the outbound forwarder's `KAFKA_ENABLED`; broker
  connection details (brokers/clientId/SSL/SASL) are reused from the
  existing `kafka` config. Topic/group come from `KAFKA_INGEST_TOPIC` /
  `KAFKA_INGEST_GROUP_ID`.
- Each message is validated against `NotificationIngestDto`
  (`class-validator`). Malformed events (missing/invalid fields) are logged
  and skipped — the consumer keeps running, never crash-loops.
- Only `channel: DISCORD` is accepted for creation in this change; `EMAIL`
  and `PUSH` events are valid shape but logged as
  unsupported-for-this-change and skipped (no notification created).
- The event payload has **no deliverable-address field** — a Discord webhook
  URL is Beacon-side config only, never event data (SSRF mitigation for this
  unauthenticated topic). A caller-supplied `deliverableAddress`, if
  present, is logged and ignored.
- `CreateNotificationCommand` / `CreateNotificationCommandHandler`
  (`application/commands/create-notification/`) — dispatched by the
  consumer. Idempotent on `(tenantId, dedupeKey)`: checks
  `findByDedupeKey` first: if found, returns the existing notification id
  (no-op); if a concurrent insert wins the race, the write repo's
  `NotificationDedupeKeyAlreadyExistsException` is caught and the existing
  notification is re-read and returned instead of erroring. Publishes
  `NotificationCreatedEvent` via `EventPublisher.mergeObjectContext()` +
  `aggregate.commit()` only after a successful save —
  `DeliverNotificationOnCreatedHandler` (below) subscribes to it.
- **No authentication** on the ingestion topic in v1 — an explicitly
  accepted MVP risk; broker ACLs are the only control (see
  `openspec/changes/beacon-mvp/proposal.md`).

### Delivery: durable, retrying Discord webhook

Delivery is decoupled from ingestion twice over: creation publishes an
in-process domain event, and that event handler enqueues a **durable,
Redis-backed job** instead of dispatching the delivery command directly, so
a transient webhook failure or a mid-delivery process crash never leaves a
notification permanently `PENDING` (see
`openspec/changes/notification-delivery-decoupling/design.md`).

- `DeliverNotificationOnCreatedHandler` (`application/events/`) —
  `@EventsHandler(NotificationCreatedEvent)`; calls
  `INotificationDeliveryQueuePort.enqueue(notificationId)`. Asynchronous by
  design (design.md D2): ingestion never awaits delivery.
- `INotificationDeliveryQueuePort` (`application/ports/notification-delivery-queue.port.ts`,
  token `NOTIFICATION_DELIVERY_QUEUE_PORT`) — durable enqueue contract.
  `BullMqNotificationDeliveryQueueAdapter` (`infrastructure/adapters/`) is
  its BullMQ/Redis implementation: the job payload is `{ notificationId }`
  only (no notification content ever reaches Redis — design.md D2), and
  `jobId = notificationId` makes enqueue idempotent for the job's lifetime.
- `NotificationDeliveryProcessor` (`transport/queue/processors/`) — an
  in-process `@Processor`/`WorkerHost` (bus-only, like
  `NotificationIngestConsumer`) that consumes the queue, derives
  `isFinalAttempt` from `job.attemptsMade + 1 >= job.opts.attempts`, and
  dispatches the unchanged `DeliverNotificationCommand` through
  `CommandBus`. This is the only place BullMQ job state is allowed to leak
  outside transport (design.md D4).
- `DeliverNotificationCommand` / `DeliverNotificationCommandHandler`
  (`application/commands/deliver-notification/`) — loads the aggregate by
  id, guards against duplicate sends (D5: if the aggregate is no longer
  `PENDING`, logs and returns without calling the sender), then calls
  `INotificationSenderPort.send()`. On success: `aggregate.sent()` + save +
  publish. On failure: throws `NotificationDeliveryFailedException` so
  BullMQ retries — only on `isFinalAttempt` does it first run
  `aggregate.fail(reason)` + save + publish, then still throws so the job
  also lands in BullMQ's failed set for ops inspection (design.md D4).
  `FAILED` is the exhausted-retry terminal, not the first-error terminal.
- `INotificationSenderPort` (`application/ports/notification-sender.port.ts`,
  token `NOTIFICATION_SENDER_PORT`) — one sender per channel; only `DISCORD`
  has an implementation in this change. `EMAIL`/`PUSH` remain out of scope,
  consistent with their exclusion from ingestion.
- `DiscordWebhookNotificationSenderAdapter` (`infrastructure/adapters/`) —
  posts `{ content }` to the webhook URL via a plain HTTP `fetch`. The
  webhook URL always comes from `DISCORD_WEBHOOK_URL` (Beacon-side config,
  `discord.config.ts`) — **never** from the ingress event, the same SSRF
  mitigation as the ignored `deliverableAddress` above (design.md D3). v1
  sends every `DISCORD` notification to this one fixed destination; there is
  no per-tenant or per-notification Discord routing. Logs start and
  completion of every webhook POST.
- **Retry policy** — `attempts: 5`, exponential backoff starting at
  `5000`ms (5s/10s/20s/40s, terminal at ≈75s), both env-tunable via
  `notificationDeliveryQueueConfig`
  (`infrastructure/config/notification-delivery-queue.config.ts`):
  - `NOTIFICATION_DELIVERY_QUEUE_NAME` (default `notification-delivery`)
  - `NOTIFICATION_DELIVERY_QUEUE_ATTEMPTS` (default `5`)
  - `NOTIFICATION_DELIVERY_QUEUE_BACKOFF_MS` (default `5000`)
- **No new notification status** — `PENDING` spans the entire retry window
  (design.md D1); attempt count is not queryable over REST/GraphQL, only via
  BullMQ/Redis directly.
- Requires Redis — see `src/core/README.md` for connection config and the
  readiness health check.

### Query: get notification by id

- `NotificationFindByIdQuery` / `NotificationFindByIdHandler` — read-side
  query dispatched through `QueryBus`, backed by
  `AssertNotificationViewModelExistsService` (throws
  `NotificationNotFoundException` when the id doesn't exist).
- **REST**: `GET /api/v1/notifications/:id` (`NotificationController`) — 404
  on an unknown id, via the `resolveNotificationsExceptionStatus` extension
  point registered in `src/core/filters/base-exception.filter.ts`.
- **GraphQL**: `query { notificationFindById(input: { id: "..." }) { ... } }`
  (`NotificationQueriesResolver`, arg validated via
  `NotificationFindByIdRequestDto`) — returns a GraphQL error (no unhandled
  crash) on an unknown id, through the same `BaseExceptionFilter`.

## Out of scope for this context (v1)

- Exactly-once delivery — at-least-once is accepted (design.md D5); the D5
  guard closes the observable duplicate window (a concurrently-succeeded or
  stalled-job-redelivered attempt), but a true partial-success window
  (Discord accepted the POST, the response was lost) stays open since
  Discord webhooks expose no idempotency key.
- Email and Push channels — no sender/adapter exists for them.
- Authentication on the ingestion topic (accepted MVP risk, see
  `openspec/changes/beacon-mvp/proposal.md`).
- `findByCriteria` GraphQL boilerplate (queryable-field enum, filterable
  registry, filter/sort inputs) — the repositories implement
  `findByCriteria` for interface conformance only; no transport exposes it
  yet.
