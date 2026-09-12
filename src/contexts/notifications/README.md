# `notifications` bounded context

The first bounded context in this service. It defines the pattern every
subsequent context follows — see `.claude/skills/architecture/SKILL.md`.

## Current state (Phase 3 — persistence + Kafka ingestion + Discord delivery + get-by-id query)

This is the complete `beacon-mvp` slice: `NotificationAggregate` is
persistable, ingestible from Kafka, delivered to Discord, and queryable by
id.

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

- `NotificationIngestConsumer` (`transport/kafka/consumers/`) — a raw
  `kafkajs` consumer (`OnModuleInit`/`OnApplicationShutdown`), not the kit's
  outbound-only `MessagingModule`. Opt-in via `KAFKA_INGEST_ENABLED`,
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

### Delivery: Discord webhook

- `DeliverNotificationOnCreatedHandler` (`application/events/`) —
  `@EventsHandler(NotificationCreatedEvent)`; dispatches
  `DeliverNotificationCommand` for the newly created notification.
  Asynchronous by design (design.md D2): ingestion never awaits delivery.
- `DeliverNotificationCommand` / `DeliverNotificationCommandHandler`
  (`application/commands/deliver-notification/`) — loads the aggregate by
  id, calls `INotificationSenderPort.send()`, then drives the terminal
  transition: `aggregate.sent()` on success, `aggregate.fail(reason)` on
  failure (network error or non-2xx response). `FAILED` is terminal by
  existing domain design — **no retry** is attempted.
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

- Email and Push channels — no sender/adapter exists for them.
- Authentication on the ingestion topic (accepted MVP risk, see
  `openspec/changes/beacon-mvp/proposal.md`).
- `findByCriteria` GraphQL boilerplate (queryable-field enum, filterable
  registry, filter/sort inputs) — the repositories implement
  `findByCriteria` for interface conformance only; no transport exposes it
  yet.
