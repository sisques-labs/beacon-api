## Context

See `proposal.md` for motivation. Beacon API has empty `src/contexts/` and the architecture skill + gardenia-api define the file layout and conventions this first context must establish. This slice is **domain + unit specs only** — no Nest module registration, no application/infra/transport.

Reference patterns: gardenia `qr` / `care-schedule` / `inventory` domain trees; project rules in `openspec/config.yaml` (VOs on aggregates, Builder-only construction, constructor = hydration, events from named methods, `@contexts/{context}/` imports).

## Goals / Non-Goals

**Goals:**

- Establish `src/contexts/notifications/domain/` as the canonical first-context pattern.
- Encode channel enum, mandatory `dedupeKey`, and status state machine in the aggregate with unit tests.
- Define read/write repository ports extending kit base interfaces for later TypeORM binding.

**Non-Goals:**

- Registering `NotificationsModule` in `CONTEXT_MODULES`.
- Commands/queries, assert services, TypeORM entities/migrations, GraphQL/REST/MCP.
- Delivery providers, templates, preferences, delivery-attempt history.
- Enforcing uniqueness of `dedupeKey` in persistence (port may document intent; uniqueness is an infra concern later).

## Decisions

### D1 — Single aggregate `Notification`

One message → one recipient → one channel. No separate DeliveryAttempt or Template aggregates in v1.

**Alternatives considered:** Campaign + deliveries (overkill); Template + Notification (templates deferred).

### D2 — Platform tenancy field is `tenantId`

Use `tenantId` (UuidValueObject), not Gardenia’s `spaceId`, aligned with platform ADR-0004.

**Alternatives considered:** `spaceId` for familiarity with gardenia — rejected to avoid leaking app terminology into a platform service.

### D3 — Channels: `EMAIL` | `PUSH` | `DISCORD`

Enum + `EnumValueObject` from day one so later providers plug into an existing vocabulary. No delivery logic in domain.

### D4 — `dedupeKey` mandatory at build time

Builder rejects missing/empty `dedupeKey`. Uniqueness across producers is deferred to write-side persistence / application assert service.

### D5 — Status machine owned by the aggregate

```
create() → PENDING
PENDING ──sent()──▶ SENT ──read()──▶ READ
PENDING ──fail(reason)──▶ FAILED
PENDING ──cancel()──▶ CANCELLED
```

Illegal transitions throw `InvalidNotificationStatusTransitionException`. No granular field-changed events; lifecycle events only (`created`, `sent`, `failed`, `cancelled`, `read`).

### D6 — Content as title + body string VOs

No template id / locale payload yet. Title/body validated as non-empty strings (reasonable max length in VOs if gardenia peers do the same).

### D7 — Folder & naming follow gardenia + architecture skill

```
src/contexts/notifications/domain/
  aggregates/ notification.aggregate.ts (+ .spec)
  builders/ notification.builder.ts (+ .spec)
  enums/ notification-channel.enum.ts, notification-status.enum.ts
  events/ … + events/notification-event-data.interface.ts
  exceptions/ …
  interfaces/ notification.interface.ts
  primitives/ notification.primitives.ts
  repositories/read|write/ …
  value-objects/…/*.value-object.ts (+ specs where validation exists)
  view-models/ notification.view-model.ts
```

- Value objects named `*ValueObject`, extend kit base types.
- Builder `@Injectable()`, extends `BaseBuilder`, `build()` / `buildViewModel()`, no static factories.
- Repo ports: `IBaseReadRepository<NotificationViewModel>` / `IBaseWriteRepository<NotificationAggregate>` + Symbol tokens.
- Imports via `@contexts/notifications/...` across directories.

### D8 — Testing scope

Unit specs only (Vitest, co-located, manual instantiation). Cover: aggregate transitions (happy + illegal), builder required fields, channel/status enum VOs, non-empty string VOs for title/body/dedupeKey/sourceService.

## Risks / Trade-offs

- **[Risk] Domain without module registration means code is not wired until a follow-up** → Acceptable; document in tasks that apply does not touch `contexts.module.ts`.
- **[Risk] `dedupeKey` uniqueness not enforced yet** → Call out in README/design; add unique constraint + assert service in persistence slice.
- **[Trade-off] No IN_APP channel** → Product may want inbox later; adding an enum value later is cheap; user chose EMAIL/PUSH/DISCORD for v1.
- **[Trade-off] READ only from SENT** → Email open-tracking may later need a different path; revisit when providers land.

## Migration Plan

1. Implement domain + unit specs on `feat/notification-domain`.
2. No DB or API migration.
3. **Rollback**: delete `src/contexts/notifications/` and archive/drop the OpenSpec change; no runtime coupling yet.

## Open Questions

None for this slice — follow-ups (providers, uniqueness, module wiring) are intentionally deferred.
