# Tasks: Producer-Controlled Discord Delivery Opt-Out

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1490 total (300/230/340/290/330) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1(domain+persistence) → PR2(application) → PR3(transport) → PR4(Criteria contract) → PR5(Criteria query+resolver) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Domain + persistence: enum, VO, `SKIPPED`, `skip()`, migration | PR 1 (base: tracker branch) | `pnpm test -- notification.aggregate notification-delivery-mode notification.builder notification-typeorm.mapper` | `pnpm test:integration -- notification-typeorm-repositories` | Revert commits + down migration; run triage query first (1.13) |
| 2 | Application: command default, handler `skip()`, enqueue guard, deliver-handler branch | PR 2 (base: PR1 branch) | `pnpm test -- create-notification deliver-notification` | N/A — unit-covered orchestration only | Revert commits; no schema/contract change |
| 3 | Transport: Kafka/REST/GraphQL DTOs, mappers, README | PR 3 (base: PR2 branch) | `pnpm test -- notification-ingest notification-create-request notification.controller notification-mutations` | `pnpm test:e2e -- notification-ingest notification-delivery notification-create notification-find-by-id` | Revert commits; DTO fields optional, no breaking change |
| 4 | Criteria contract surface (dead code, no query wired) | PR 4 (base: PR3 branch) | `pnpm test -- notification-filterable-fields notification-filter.input notification-sort.input notification-find-by-criteria.request` | N/A — contract surface only, unreachable until PR5 | Revert commits; nothing consumes the surface yet |
| 5 | Criteria query + resolver wiring | PR 5 (base: PR4 branch) | `pnpm test -- notification-find-by-criteria notification-queries.resolver` | `pnpm test:integration -- notification-typeorm-repositories` + `pnpm test:e2e -- notification-find-by-criteria` | Revert commits; remove resolver method + module registration |

## Phase 1: PR #1 — Domain + Persistence (Slice 1)

- [x] 1.1 RED `domain/value-objects/notification-delivery-mode/notification-delivery-mode.value-object.spec.ts` — accepts `DELIVER`/`RECORD_ONLY`; rejects `'MAYBE'` and URL-shaped string (SSRF D3 case)
- [x] 1.2 GREEN `domain/enums/notification-delivery-mode.enum.ts` + `notification-delivery-mode.value-object.ts` (extends `EnumValueObject`)
- [x] 1.3 GREEN append `SKIPPED` to `domain/enums/notification-status.enum.ts`
- [x] 1.4 Create `domain/events/notification-skipped/notification-skipped.event.ts` (copy `notification-cancelled.event.ts` shape)
- [x] 1.5 RED extend `domain/aggregates/notification.aggregate.spec.ts` — `skip()` PENDING→SKIPPED + event; `skip()` from SENT/FAILED/CANCELLED/SKIPPED throws; `sent()/fail()/cancel()/read()` from SKIPPED throw; `toPrimitives()` carries `deliveryMode`
- [x] 1.6 GREEN `notification.aggregate.ts` — `_deliveryMode` field, `skip()`, getter, `toPrimitives()` entry; update `domain/interfaces/notification.interface.ts`, `domain/primitives/notification.primitives.ts`, `domain/view-models/notification.view-model.ts`
- [x] 1.7 RED extend `domain/builders/notification.builder.spec.ts` — defaults `DELIVER`; `withDeliveryMode()`; view model carries it
- [x] 1.8 GREEN `withDeliveryMode()` + default in `notification.builder.ts`
- [x] 1.9 RED extend `infrastructure/persistence/typeorm/mappers/notification-typeorm.mapper.spec.ts` — round-trips `deliveryMode` + `SKIPPED`
- [x] 1.10 GREEN `deliveryMode` mapping in `notification-typeorm.mapper.ts` + `@Column` in `infrastructure/persistence/typeorm/entities/notification.entity.ts`
- [x] 1.11 Create `src/database/migrations/{ts}-add-notification-delivery-mode.ts` — additive `ADD COLUMN "deliveryMode" varchar(20) NOT NULL DEFAULT 'DELIVER'`; down drops column. Migration plan: additive, non-breaking, no data backfill needed
- [x] 1.12 Extend `test/integration/notifications/notification-typeorm-repositories.integration-spec.ts` — persist/read `RECORD_ONLY` + `SKIPPED` against real Postgres
- [x] 1.13 Ops runbook note (PR description, not code): before running the down migration, operators MUST run `SELECT count(*) FROM notifications WHERE status='SKIPPED'` and triage those rows (accept read failures on `NotificationStatusValueObject` hydration, or `UPDATE notifications SET status='CANCELLED' WHERE status='SKIPPED'`) — reverted code cannot hydrate a `SKIPPED` row

## Phase 2: PR #2 — Application (Slice 2a, base: PR1 branch)

- [x] 2.1 RED extend `application/commands/create-notification/create-notification.command.spec.ts` — absent ⇒ `DELIVER`; `RECORD_ONLY` preserved; invalid throws
- [x] 2.2 GREEN `deliveryMode` field + ctor normalization in `create-notification.command.ts`
- [x] 2.3 RED extend `create-notification.handler.spec.ts` — `RECORD_ONLY` ⇒ saved aggregate `SKIPPED`, `save` called once; `DELIVER` ⇒ `PENDING` (regression)
- [x] 2.4 GREEN `.withDeliveryMode()` + `aggregate.skip()` call in `create-notification.handler.ts`
- [x] 2.5 RED extend `application/events/deliver-notification-on-created.handler.spec.ts` — `RECORD_ONLY` ⇒ enqueue **not** called; `DELIVER` ⇒ called
- [x] 2.6 GREEN early-return guard on `deliveryMode === RECORD_ONLY` in `deliver-notification-on-created.handler.ts`
- [x] 2.7 RED extend `application/commands/deliver-notification/deliver-notification.handler.spec.ts` — `PENDING`+`RECORD_ONLY` ⇒ `senderPort.send` **not** called, status `SKIPPED`, saved; already-`SKIPPED` ⇒ existing early return unaffected
- [x] 2.8 GREEN `RECORD_ONLY` branch (defense in depth, before `senderPort.send()`) in `deliver-notification.handler.ts`

## Phase 3: PR #3 — Transport (Slice 2b, base: PR2 branch)

- [x] 3.1 RED `transport/kafka/dtos/notification-ingest.dto.spec.ts` — absent/valid/invalid `deliveryMode` incl. URL-shaped string (SSRF D3)
- [x] 3.2 GREEN `@IsOptional() @IsEnum(NotificationDeliveryModeEnum)` on `notification-ingest.dto.ts`
- [x] 3.3 RED extend `transport/kafka/consumers/notification-ingest.consumer.spec.ts` — command carries `deliveryMode`; invalid ⇒ log-and-skip, no command dispatched
- [x] 3.4 GREEN thread `dto.deliveryMode` into command in `notification-ingest.consumer.ts`
- [x] 3.5 RED `transport/rest/dtos/notification-create-request.dto.spec.ts` — absent/valid/invalid incl. URL-shaped string (SSRF D3)
- [x] 3.6 GREEN `@ApiPropertyOptional` + `@IsEnum` on `notification-create-request.dto.ts`
- [x] 3.7 RED `transport/graphql/dtos/requests/notification-create.request.dto.spec.ts` — absent/valid/invalid incl. URL-shaped string (SSRF D3); no GraphQL `defaultValue`
- [x] 3.8 GREEN `@Field(nullable: true)` + `@IsEnum` on GraphQL create request DTO
- [x] 3.9 RED extend `notification.controller.spec.ts` + `notification-mutations.resolver.spec.ts` — command carries `deliveryMode`; invalid ⇒ no dispatch
- [x] 3.10 GREEN thread `deliveryMode` in `notification.controller.ts` + `notification-mutations.resolver.ts`
- [x] 3.11 RED extend `transport/rest/mappers/notification.mapper.spec.ts` + `notification-registered-enums.graphql.spec.ts` — REST `toResponseDtoFromViewModel` builds `deliveryMode`; mode enum registered
- [x] 3.12 GREEN add `deliveryMode` to `notification-response.dto.ts` (REST) and **delete its self-mapping constructor** (fixes architecture hard rule 8); add `toResponseDtoFromViewModel()` to `transport/rest/mappers/notification.mapper.ts`; wire controller `findById` through it
- [x] 3.13 GREEN `deliveryMode` field on GraphQL `notification.response.dto.ts` + mapping in GraphQL `transport/graphql/mappers/notification.mapper.ts`; register `NotificationDeliveryModeEnum` in `notification-registered-enums.graphql.ts`
- [x] 3.14 Extend `test/notification-ingest.e2e-spec.ts` — `RECORD_ONLY` event ⇒ row `deliveryMode=RECORD_ONLY`, `status=SKIPPED`; invalid ⇒ no row
- [x] 3.15 Extend `test/notification-delivery.e2e-spec.ts` — `RECORD_ONLY` ⇒ `HttpService.post` never called, queue drains no job, terminal `SKIPPED`
- [x] 3.16 Extend `test/notification-create.e2e-spec.ts` — REST 201 / GraphQL success with `deliveryMode`; invalid ⇒ 400 / GraphQL error
- [x] 3.17 Extend `test/notification-find-by-id.e2e-spec.ts` — `SKIPPED` + `deliveryMode` returned by REST and GraphQL, no error
- [x] 3.18 Update `src/contexts/notifications/README.md` — document `deliveryMode` capability

## Phase 4: PR #4 — Criteria Contract Surface (Slice 3a, base: PR3 branch)

- [x] 4.1 Create `transport/graphql/enums/notification-queryable-field.enum.ts` — 6-field whitelist: `tenantId, recipientUserId, channel, status, deliveryMode, createdAt`
- [x] 4.2 RED `transport/graphql/registries/notification-filterable-fields.registry.spec.ts` (mandatory) — every field has an entry; `deliveryMode`/`status` descriptors reference real domain enums incl. `SKIPPED`; **`FilterValidationPipe` rejects an unknown field (`'body'`) with `BadRequestException`**; rejects an invalid enum value; accepts a valid `in` array, rejects one with an invalid member; pins all 8 `FilterOperator` cases per D-J
- [x] 4.3 GREEN create `notification-filterable-fields.registry.ts`
- [x] 4.4 RED `notification-filter.input.spec.ts` + `notification-sort.input.spec.ts` — `field` rejects non-enum via `@IsEnum`; class/GraphQL type names correct
- [x] 4.5 GREEN create `notification-filter.input.ts` + `notification-sort.input.ts` via `createFilterInput`/`createSortInput`
- [x] 4.6 RED `notification-find-by-criteria.request.dto.spec.ts` — absent input; empty `filters` default `[]`; nested validation rejects a bad filter
- [x] 4.7 GREEN create `notification-find-by-criteria.request.dto.ts`
- [x] 4.8 RED extend `notification-registered-enums.graphql.spec.ts` — `NotificationQueryableFieldEnum` registered
- [x] 4.9 GREEN register `NotificationQueryableField` in `notification-registered-enums.graphql.ts`

## Phase 5: PR #5 — Criteria Query + Resolver (Slice 3b, base: PR4 branch)

- [x] 5.1 RED `application/queries/notification-find-by-criteria/notification-find-by-criteria.query.spec.ts` — carries `Criteria` unchanged
- [x] 5.2 GREEN create `notification-find-by-criteria.query.ts`
- [x] 5.3 RED `notification-find-by-criteria.handler.spec.ts` — delegates `findByCriteria` with exact `Criteria`; returns `PaginatedResult` unchanged; empty page returned, not thrown (`Mocked<INotificationReadRepository>`)
- [x] 5.4 GREEN create `notification-find-by-criteria.handler.ts`; register in `notifications.module.ts` `QUERY_HANDLERS`
- [x] 5.5 RED extend `transport/graphql/mappers/notification.mapper.spec.ts` — `toPaginatedResponseDtoFromPaginatedResult` maps `items/total/page/perPage/totalPages` + per-item `deliveryMode`/`SKIPPED`
- [x] 5.6 GREEN create `transport/graphql/dtos/responses/notification-paginated.response.dto.ts`; add mapper method
- [x] 5.7 RED extend `transport/graphql/resolvers/queries/notification-queries.resolver.spec.ts` — dispatches `NotificationFindByCriteriaQuery` via `QueryBus`, maps via mapper, `undefined` input ⇒ empty `Criteria`; asserts **`FilterValidationPipe` wired as the 3rd `@Args` argument**
- [x] 5.8 GREEN add `notificationsFindByCriteria` resolver method with `new FilterValidationPipe(notificationFilterableFields)`
- [x] 5.9 Extend `test/integration/notifications/notification-typeorm-repositories.integration-spec.ts` — `deliveryMode eq RECORD_ONLY` / `status eq SKIPPED` / `in` both / pagination totals, real Postgres
- [x] 5.10 Create `test/notification-find-by-criteria.e2e-spec.ts` — GraphQL filtering `deliveryMode EQUALS RECORD_ONLY` and `status EQUALS SKIPPED`; unknown filter field ⇒ error, no rows leaked
- [x] 5.11 Update `src/contexts/notifications/README.md` — document `findByCriteria` capability
