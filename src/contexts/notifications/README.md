# `notifications` bounded context

The first bounded context in this service. It defines the pattern every
subsequent context follows — see `.claude/skills/architecture/SKILL.md`.

## Current state (Phase 1 — persistence + get-by-id query)

This slice makes `NotificationAggregate` persistable and queryable by id.
Ingestion (Kafka) and delivery (Discord webhook) are **not yet implemented**
— see "Planned" below.

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

### Query: get notification by id

- `NotificationFindByIdQuery` / `NotificationFindByIdHandler` — read-side
  query dispatched through `QueryBus`, backed by
  `AssertNotificationViewModelExistsService` (throws
  `NotificationNotFoundException` when the id doesn't exist).
- **REST**: `GET /api/v1/notifications/:id` (`NotificationController`) — 404
  on an unknown id, via the `resolveNotificationsExceptionStatus` extension
  point registered in `src/core/filters/base-exception.filter.ts`.
- **GraphQL**: `query { notificationFindById(id: "...") { ... } }`
  (`NotificationResolver`) — returns a GraphQL error (no unhandled crash) on
  an unknown id, through the same `BaseExceptionFilter`.

## Planned (later PRs in this same chain)

- **Ingestion** (PR 2): a `kafkajs` consumer dispatching
  `CreateNotificationCommand`, idempotent on `(tenantId, dedupeKey)`.
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
