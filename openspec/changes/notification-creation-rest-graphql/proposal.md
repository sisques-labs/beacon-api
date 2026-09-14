# Proposal: Synchronous notification creation via REST and GraphQL

## Intent

A notification can only be created through the async, unauthenticated Kafka consumer (`NotificationIngestConsumer`). There is no synchronous API: `NotificationController` has only `GET :id`, `NotificationQueriesResolver` only `notificationFindById`. Callers needing an immediate result — and the future `beacon-sdk`, which will let consumers pick their intake transport — have no path. `CreateNotificationCommand`/Handler already implement create-with-dedupe-idempotency and are transport-agnostic, so this is a pure transport gap. Impacted bounded context: `notifications` only.

## Scope

### In Scope
- REST `POST /api/v1/notifications` on the existing `NotificationController`, with Swagger decoration and a request DTO under `transport/rest/dtos/`.
- GraphQL `notificationCreate` mutation on a new `NotificationMutationsResolver` (first mutation resolver in the service) plus an `@InputType()` request DTO.
- Resolver registration in `notifications.module.ts` (`GRAPHQL_PROVIDERS`); reuse the global `MutationResponseGraphQLMapper` from `SharedGraphQLModule`.
- Both adapters stay thin: validate, dispatch `CreateNotificationCommand` via `CommandBus`, map the response, log at entry.
- Unit specs for controller/resolver/DTOs; E2E for both transports including dedupe-idempotency.
- `src/contexts/notifications/README.md` refresh.

### Out of Scope
- The `beacon-sdk` client library (`beacon.send()`, multi-transport config) — motivation only.
- Kafka (existing) and Redis-queue (future) intake channels.
- Delivery/provider logic — covered by archived `notification-delivery-decoupling`.
- Any domain/application/infrastructure change.
- Authentication on the new endpoints — see Known Tradeoffs.
- Reconciling the stale `openspec/changes/notification-domain/` change (superseded in place by archived `beacon-mvp`, never verified/archived). Pre-existing bookkeeping inconsistency, tracked separately.

## Capabilities

### New Capabilities
- `notification-creation`: synchronous creation over REST and GraphQL, shared validation, dedupe-idempotent responses, error mapping.

### Modified Capabilities
- None. `notification-ingestion` (Kafka) and `notification-query` are untouched.

## Known Tradeoffs

**No auth guard on the new write endpoints.** Deliberate deferral, not an oversight: it matches today's unguarded query-side precedent and keeps this change transport-only. A synchronous HTTP/GraphQL write is a larger exposure than a broker topic, so a follow-up change MUST decide an auth strategy for synchronous writes and apply `JwtAuthGuard` (`@sisques-labs/nestjs-kit/auth-client`, already wired in `CoreModule`).

## Approach

Mirror the proven query-side pattern. Two thin adapters dispatch the unchanged `CreateNotificationCommand`, so creation semantics stay single-sourced in the application layer and both paths inherit existing dedupe behaviour. Use the real sibling folder convention `transport/graphql/resolvers/mutations/`, not the architecture skill's generic `resolvers/{name}/` path.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.../transport/rest/notification.controller.ts` | Modified | add `POST` handler |
| `.../transport/rest/dtos/` | New | create-request DTO |
| `.../transport/graphql/resolvers/mutations/` | New | `NotificationMutationsResolver` |
| `.../transport/graphql/dtos/requests/` | New | `@InputType()` create DTO |
| `.../transport/graphql/mappers/` | Modified | response mapping if needed |
| `notifications.module.ts` | Modified | register resolver |
| `src/contexts/notifications/README.md` | Modified | document creation transports |
| `test/` | New | E2E for both transports |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unauthenticated public write endpoint | High | Recorded tradeoff above; mandatory follow-up change |
| `MutationResponseDto` field shape unverified | Med | Confirm in `sdd-design` before DTO work |
| First mutation resolver sets service-wide precedent | Med | Follow skill naming and real sibling folder layout |
| Divergent REST vs GraphQL validation | Med | Both dispatch one command; assert parity in E2E |
| README update forgotten | Low | Explicit in-scope deliverable |

## Rollback Plan

1. Revert the feature branch. No migration and no domain/application change to reverse.
2. Removing the controller method, resolver, DTOs and module registration restores the prior surface; Kafka ingestion and query paths stay untouched throughout.
3. The schema is code-first (`autoSchemaFile: true`), so the mutation disappears on regeneration — no checked-in schema to revert.

## Dependencies

- None new. `@nestjs/graphql`, Apollo code-first, Swagger, and `SharedGraphQLModule` are already wired in `src/core/core.module.ts`.

## Success Criteria

- [ ] `POST /api/v1/notifications` creates a notification and returns its id.
- [ ] `notificationCreate` mutation creates a notification with equivalent semantics.
- [ ] Repeating either call with the same `(tenantId, dedupeKey)` creates no second notification.
- [ ] Invalid input is rejected with a validated error on both transports.
- [ ] `pnpm test`, `test:integration`, `test:e2e`, `lint`, `build` pass; coverage >= 80%.
- [ ] `src/contexts/notifications/README.md` reflects the current creation surface.
