# Proposal: Producer-Controlled Discord Delivery Opt-Out

## Intent

`DISCORD_WEBHOOK_URL` and `KAFKA_INGEST_TOPIC` are already env-configurable and tested — that literal ask is done. The real gap: a producer has no way to say "record this notification, but do not deliver it to Discord". Today every accepted notification is unconditionally enqueued for Discord delivery; the only way to suppress it is misconfiguration, which yields retry storms and terminal `FAILED`. Producers need an explicit, per-request, auditable opt-out.

## Scope

### In Scope (beacon-api only)

- New domain enum `NotificationDeliveryModeEnum` = `DELIVER` | `RECORD_ONLY`, exposed as optional field `deliveryMode` on the Kafka ingest DTO, REST and GraphQL create DTOs, and `CreateNotificationCommand`. Absent ⇒ `DELIVER` (existing producers unaffected).
- New terminal status `SKIPPED` on `NotificationAggregate` with transition `PENDING → SKIPPED`.
- `RECORD_ONLY` notifications are persisted and queryable but never enqueued for delivery.
- Expose `deliveryMode`/`SKIPPED` on the read side (view model, queryable-field enum, filterable-fields registry).

### Out of Scope

- `beacon-ts-sdk` client field — separate coordinated change in the sibling repo, consuming this same name and semantics.
- Per-tenant/persisted delivery preferences; multi-channel routing; making `DISCORD_WEBHOOK_URL` hard-required; unifying the duplicated Kafka default-topic literal across repos.

## Capabilities

### New Capabilities

- `notification-delivery-mode`: producer-declared per-request delivery mode, its default, validation, and the `SKIPPED` terminal outcome.

### Modified Capabilities

- `notification-ingestion`: ingest DTO accepts optional `deliveryMode`.
- `notification-creation`: REST/GraphQL create input accepts optional `deliveryMode`.
- `notification-delivery`: `RECORD_ONLY` bypasses enqueue and terminates as `SKIPPED`.
- `notification-query`: `SKIPPED` and `deliveryMode` are readable and filterable.

## Approach

An enum, not a boolean: it is channel-agnostic and forward-compatible when a second channel lands (no field rename, no breaking change), and it matches the repo's enum + `EnumValueObject` idiom, since aggregate fields must be value objects.

A distinct `SKIPPED` status, not reuse: `FAILED` means delivery was attempted and lost — conflating them corrupts failure-rate signals and alerting. `CANCELLED` means an operator revoked an intended notification — conflating them corrupts the cancellation audit. An intentional non-delivery is a third, genuinely terminal outcome.

**SSRF constraint (design D3) holds by construction**: `deliveryMode` is a closed two-token enum. No destination, URL, address, or free text ever crosses the caller boundary; the webhook URL stays Beacon-side-only from `DISCORD_WEBHOOK_URL`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/contexts/notifications/domain/enums/` | New | `notification-delivery-mode.enum.ts`; `SKIPPED` added to status enum |
| `src/contexts/notifications/domain/aggregates/notification.aggregate.ts` | Modified | `deliveryMode` field, `skip()` method, `PENDING → SKIPPED` |
| `src/contexts/notifications/domain/value-objects/` | New | Delivery-mode value object |
| `src/contexts/notifications/domain/events/` | New | `NotificationSkippedEvent` |
| `src/contexts/notifications/transport/kafka/dtos/notification-ingest.dto.ts` | Modified | Optional `deliveryMode` |
| `src/contexts/notifications/transport/rest/dtos/`, `transport/graphql/dtos/requests/` | Modified | Optional `deliveryMode` |
| `src/contexts/notifications/application/commands/create-notification/` | Modified | Command input + conditional enqueue |
| `src/contexts/notifications/infrastructure/persistence/typeorm/` | Modified | Column + migration |
| `src/contexts/notifications/transport/graphql/enums|registries/` | Modified | New status/mode values |
| `src/contexts/notifications/README.md` | Modified | Document the capability |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cross-repo contract drift with `beacon-ts-sdk` | Med | Field name/semantics frozen here; SDK change is a downstream consumer of this proposal |
| Consumers break on the new `SKIPPED` status value | Med | Additive terminal status; existing statuses and transitions unchanged |
| Producers misread `RECORD_ONLY` as "do not persist" | Low | Explicit naming plus spec scenarios asserting the record is created and queryable |
| DB migration on an existing enum column | Low | Additive enum value + nullable column defaulting to `DELIVER` |

## Rollback Plan

Revert the change commits and run the down migration (drops the `deliveryMode` column and the `SKIPPED` enum value). Because the field is optional and defaults to `DELIVER`, rolling back restores exact prior behavior for every producer; pre-existing rows are unaffected. Any row already in `SKIPPED` must be triaged before the down migration — the verify phase must produce that check.

## Dependencies

- Sibling `beacon-ts-sdk` change (downstream, not blocking): adds the matching client field once this contract lands.

## Success Criteria

- [ ] A request omitting `deliveryMode` behaves exactly as today (delivered to Discord).
- [ ] A request with `deliveryMode: RECORD_ONLY` persists the notification, enqueues no delivery job, sends no Discord HTTP call, and terminates as `SKIPPED`.
- [ ] `SKIPPED` is terminal — no transition out of it is permitted.
- [ ] No caller-supplied value can influence the Discord destination (D3 preserved).
- [ ] The field behaves identically across Kafka ingest, REST, and GraphQL.
- [ ] Unit, integration, and E2E coverage at ≥80% for the new paths.
