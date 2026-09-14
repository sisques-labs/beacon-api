# Exploration: notification-creation-rest-graphql

## Current State

The `notifications` bounded context is fully built (domain, application, infrastructure, transport) even though `openspec/changes/notification-domain/proposal.md` still describes itself as "domain layer only" with GraphQL/REST/MCP and application handlers explicitly out of scope, and native SDD status reports that change's specs/design/tasks/proposal as `done` but `applyProgress: missing` / `nextRecommended: verify`.

**This is confirmed stale bookkeeping, not a real gap.** The already-archived `beacon-mvp` change (`openspec/changes/archive/2026-09-13-beacon-mvp/`) opens by stating "notifications is domain-only: the aggregate cannot be created, stored, delivered, or read" and then builds TypeORM persistence, `CreateNotificationCommand`/Handler, Kafka ingestion, and Discord delivery on top of the domain layer; `notification-delivery-decoupling` (archived 2026-09-14) adds BullMQ-backed async delivery on top of that. `src/contexts/notifications/README.md` documents the context's actual current state as "persistence + Kafka ingestion + durable, retrying Discord delivery + get-by-id query" — fully implemented. The `notification-domain` change folder was simply never verified/archived after being superseded in place by `beacon-mvp`. This is separate housekeeping and should not block this new change, but is flagged for the orchestrator/user.

**The genuine gap (this change's actual scope)**: creation is only reachable via the async Kafka consumer (`NotificationIngestConsumer` → `CommandBus.execute(CreateNotificationCommand)`), which is intentionally unauthenticated (broker ACLs only) and Discord-only for v1. There is no synchronous REST or GraphQL way to create a notification:
- `NotificationController` (`src/contexts/notifications/transport/rest/notification.controller.ts`) only has `GET :id`.
- `NotificationQueriesResolver` only has `notificationFindById`. No mutations resolver file exists anywhere in the codebase — this would be the **first GraphQL mutation in the whole service**.

`CreateNotificationCommand`/`CreateNotificationCommandHandler` (`src/contexts/notifications/application/commands/create-notification/`) already implement the full create-with-dedupe-idempotency logic, fully transport-agnostic. Zero application/domain changes are needed — this is a pure transport-layer addition.

## Framework Wiring Already In Place (not first-time setup)

- GraphQL is fully wired: `@nestjs/graphql` + Apollo code-first (`GraphQLModule.forRoot`, `autoSchemaFile: true`) in `src/core/core.module.ts`. `SharedGraphQLModule` (`@sisques-labs/nestjs-kit`, `@Global()`) already provides+exports `MutationResponseGraphQLMapper` — confirmed by reading the kit's compiled `shared-graphql.module.js`. Note: this contradicts the kit's own generic README example (which tells consumers to add the mapper to their own module's providers), but matches this project's architecture skill Hard Rule #3 exactly. `MutationResponseDto`'s exact field shape wasn't fully inspected (just method signatures) — needs checking at design time.
- REST (Swagger conventions) is equally already wired — no first-time setup needed either.

## Affected Areas

- `src/contexts/notifications/transport/rest/notification.controller.ts` — add `POST` handler
- `src/contexts/notifications/transport/rest/dtos/` — new create-request DTO
- `src/contexts/notifications/transport/graphql/resolvers/mutations/notification-mutations.resolver.ts` — new file
- `src/contexts/notifications/transport/graphql/dtos/requests/` — new `@InputType()` create DTO
- `src/contexts/notifications/notifications.module.ts` — register new resolver in `GRAPHQL_PROVIDERS`
- `src/contexts/notifications/README.md` — mandatory update per project convention (currently silent on creation transport)
- `openspec/specs/` — likely a new `notification-creation` capability, not a `notification-query` modification
- `openspec/changes/notification-domain/` — stale, unresolved; separate housekeeping
- Tests: unit specs for controller/resolver/DTOs; E2E mirroring `test/notification-find-by-id.e2e-spec.ts` + dedupe-idempotency assertions like `test/notification-ingest.e2e-spec.ts`

## Approaches

1. **Shared application command, two thin transport adapters** — REST `POST` + GraphQL mutation, both dispatching the existing `CreateNotificationCommand` via `CommandBus`.
   - Pros: no duplicated logic, reuses tested handler, mirrors the proven query-side pattern, zero domain/application change.
   - Cons: none significant.
   - Effort: Low-Medium.

2. **Ship one transport first, defer the other.**
   - Pros: smaller single PR.
   - Cons: contradicts the user's stated motivation — the future SDK needs both REST and GraphQL as parallel configurable intake options.
   - Effort: N/A — not recommended.

## Recommendation

Approach 1: REST `POST /api/v1/notifications` + GraphQL `notificationCreate` mutation, both thin adapters over the existing `CreateNotificationCommand`. This mirrors the already-working query-side pattern exactly.

**Open decision for propose/design**: neither the existing REST controller nor the GraphQL queries resolver applies `JwtAuthGuard` today. Kafka ingestion is unauthenticated by an explicit, documented MVP tradeoff (broker ACLs only). A synchronous HTTP/GraphQL write endpoint is a materially different exposure than a Kafka topic — auth needs an explicit decision, not a silent copy of the unguarded query precedent.

## Risks

- Auth for the new write endpoints is undecided; copying the unguarded query-side precedent may be unsafe for writes.
- `notification-domain` OpenSpec tracking is stale and needs separate reconciliation (verify/archive), independent of this change.
- `MutationResponseDto` field shape wasn't fully inspected — confirm at design time.
- Mandatory `src/contexts/notifications/README.md` update is easy to forget.
- The architecture skill documents GraphQL resolvers under `transport/graphql/resolvers/{name}/`, but actual code uses `transport/graphql/resolvers/queries/` — the new mutations resolver should follow the real sibling convention (`resolvers/mutations/`), not the skill's literal doc.

## Ready for Proposal

Yes — low ambiguity, fully precedented by the existing query-side REST+GraphQL pattern. The one substantive decision to carry forward is the auth requirement for the new write endpoints.
