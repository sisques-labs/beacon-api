## Why

Beacon API is still a service template with zero bounded contexts. The first context must establish the DDD + CQRS + Hexagonal pattern for every subsequent one, and Beacon’s product role is the platform notification service — other Sisques apps (Gardenia, Account, etc.) will eventually produce notifications through it. Starting with a solid domain model (status lifecycle, channels, mandatory dedupe) gives us invariants before wiring persistence, transports, or providers.

## What Changes

- Introduce the first bounded context: `notifications`, **domain layer only**.
- Add aggregate `Notification` with value objects, enums, builder, domain events, exceptions, primitives, interface, view-model, and read/write repository ports.
- Encode a strict status lifecycle: `PENDING` → `SENT` | `FAILED` | `CANCELLED`; `SENT` → `READ`.
- Channel enum: `EMAIL`, `PUSH`, `DISCORD` (delivery providers deferred).
- Require `dedupeKey` on every notification for producer idempotency.
- Co-located unit specs for aggregate, builder, and value objects that carry validation.
- **Out of scope**: application handlers, TypeORM, GraphQL/REST/MCP, Nest module registration, migrations, external providers, templates, preferences.

## Capabilities

### New Capabilities

- `notification-domain`: Domain model for a platform notification — identity, tenancy, recipient, channel, status transitions, content, source service, and mandatory dedupe key — with events and repository ports, no persistence or transport yet.

### Modified Capabilities

- (none)

## Impact

- **Bounded contexts**: new `notifications` (first context in this service).
- **Code**: files only under `src/contexts/notifications/domain/` (+ unit `.spec.ts`). No changes to `contexts.module.ts`, application, infrastructure, or transport in this change.
- **APIs / DB / deps**: none in this slice.
- **Rollback**: delete the `src/contexts/notifications/` tree and this OpenSpec change; no migrations or public API surface to reverse.
