# Proposal: Beacon MVP — Kafka-ingested Discord notification delivery

## Intent

`notifications` is domain-only: the aggregate cannot be created, stored, delivered, or read. This change builds the first end-to-end slice — a client app (e.g. Gardenia) publishes a notification-request event to Kafka, Beacon persists a `NotificationAggregate`, delivers it to Discord via webhook, and exposes its status by id. Bounded contexts impacted: `notifications` only.

## Scope

### In Scope
- TypeORM persistence: entity, mapper, read/write repositories, migration with a `(tenantId, dedupeKey)` unique index.
- Inbound Kafka consumer for the notification-request topic (tenantId, channel, content, deliverable address, dedupeKey).
- `create-notification` command/handler; duplicate `dedupeKey` is an idempotent no-op returning the existing notification.
- Async Discord webhook delivery behind an application port + infrastructure adapter; drives `PENDING → SENT | FAILED`.
- `notification-find-by-id` query/handler plus a minimal read transport (proposed: GraphQL resolver).
- `NotificationsModule` in `CONTEXT_MODULES`, context `README.md`, unit + integration + E2E tests.

### Out of Scope
- Email (Resend) and Push (FCM) channels — deferred slices.
- Any auth for v1 (accepted risk below).
- `findByCriteria` Criteria boilerplate; `mark-as-read`; `cancel`.
- Enabling the existing outbound `KAFKA_ENABLED` forwarder (stays off, no code change).
- Changes to the applied aggregate or status machine.

## Capabilities

### New Capabilities
- `notification-ingestion`: consuming inbound notification-request events and creating persisted notifications idempotently.
- `notification-delivery`: asynchronous Discord-webhook delivery and resulting status transitions.
- `notification-query`: retrieving a single notification's state by id.

### Modified Capabilities
- None (`openspec/specs/` is empty).

## Approach

The Kafka consumer is a thin `transport/` entry point that dispatches `CreateNotificationCommand` only. Delivery fires asynchronously after creation (domain-event handler vs. follow-up command — settled at `sdd-design`), so ingestion never blocks on Discord latency. The sender is a port in `application/ports/` with an `infrastructure/adapters/` HTTP implementation, so Email/Push drop in later behind the same port. Dedupe enforced twice: DB unique index (authoritative) + pre-write lookup (fast path).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/contexts/notifications/application/` | New | command, query, handlers, assert services, sender port |
| `.../infrastructure/persistence/typeorm/` | New | entity, mapper, read/write repositories |
| `.../infrastructure/adapters/` | New | Discord webhook sender |
| `.../transport/` | New | Kafka consumer + minimal read transport |
| `.../domain/repositories/` | Modified | additive `findByDedupeKey` port method |
| `notifications.module.ts`, `src/contexts/contexts.module.ts` | New/Modified | wiring + `CONTEXT_MODULES` |
| `src/core/config/`, `.env.example`, migrations | Modified | webhook + ingest-topic config, new migration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **No auth (accepted MVP tradeoff)**: any producer with ingress-topic access can create notifications for any tenant | High | Explicitly accepted for v1; broker ACLs are the only control; must be restated in spec and design, never silently dropped |
| Kit may expose only the outbound forwarder, no inbound consumer | Med | Confirm at `sdd-design`; fall back to `@nestjs/microservices` Kafka or `kafkajs` |
| Exceeds the 400-line PR budget across four layers | High | `auto-chain`; suggested slices: (1) persistence + query, (2) ingestion + create, (3) Discord delivery |
| `findByDedupeKey` touches the applied domain layer | Med | Additive port method only; no aggregate change |
| Webhook errors map to terminal `FAILED` with no retry | Med | Accepted — domain has no retry state; log `failureReason` |
| Poison/malformed ingress messages | Med | Validate at the consumer; log and skip instead of crash-looping the consumer group |

## Rollback Plan

1. Revert the feature branch(es); the domain layer is untouched and stays green.
2. Run the migration `down` (drops table + unique index).
3. Remove `NotificationsModule` from `CONTEXT_MODULES` — the app boots with zero contexts, as today.
4. Unset webhook/ingest-topic env vars; no external state to clean beyond already-posted Discord messages.

## Dependencies

- Reachable Kafka broker; ingress topic name and payload contract agreed with the producing app.
- A Discord incoming webhook URL.
- PostgreSQL (already wired) for the migration.

## Success Criteria

- [ ] A valid ingress event creates a persisted notification and posts to Discord.
- [ ] Status reaches `SENT` on success, `FAILED` with `failureReason` on webhook error.
- [ ] Re-publishing the same `(tenantId, dedupeKey)` creates no second notification and no second Discord message.
- [ ] Get-by-id returns current status.
- [ ] `pnpm test`, `test:integration`, `test:e2e`, `lint`, `build` pass; coverage ≥ 80%.
