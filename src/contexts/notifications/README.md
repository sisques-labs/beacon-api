# `notifications` bounded context

The first bounded context in this service. It defines the pattern every
subsequent context follows — see `.claude/skills/architecture/SKILL.md`.

## Current state (Phase 2 — persistence + Kafka ingestion + get-by-id query)

This slice makes `NotificationAggregate` persistable, ingestible from Kafka,
and queryable by id. Delivery (Discord webhook) is **not yet implemented** —
see "Planned" below.

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
  `aggregate.commit()` only after a successful save — currently has no
  subscriber (added in the delivery slice).
- **No authentication** on the ingestion topic in v1 — an explicitly
  accepted MVP risk; broker ACLs are the only control (see
  `openspec/changes/beacon-mvp/proposal.md`).

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

## Planned (later PR in this same chain)

- **Delivery** (PR 3): a Discord webhook sender behind
  `INotificationSenderPort`, driven by `NotificationCreatedEvent` and
  transitioning the aggregate to `SENT` / `FAILED`.

## Out of scope for this context (v1)

- Email and Push channels — no sender/adapter exists for them.
- Authentication on the ingestion topic (accepted MVP risk, see
  `openspec/changes/beacon-mvp/proposal.md`).
- `findByCriteria` GraphQL boilerplate (queryable-field enum, filterable
  registry, filter/sort inputs) — the repositories implement
  `findByCriteria` for interface conformance only; no transport exposes it
  yet.
