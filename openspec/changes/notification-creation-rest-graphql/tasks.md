# Tasks: Synchronous notification creation via REST and GraphQL

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550-650 (2 new DTOs x2 transports, controller+resolver+specs, e2e spec, README) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (REST) -> PR 2 (GraphQL) -> PR 3 (E2E + README) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | REST `POST /api/v1/notifications` create, DTOs, D5 rejection | PR 1 | `pnpm test -- notification.controller notification-create-request.dto` | N/A — unit-only, no server needed | revert new REST DTOs + controller diff, no module/GraphQL touched |
| 2 | GraphQL `notificationCreate` mutation, DTO, resolver, module wiring | PR 2 | `pnpm test -- notification-mutations.resolver notification-create.request.dto` | N/A — unit-only | revert new GraphQL files + one-line `GRAPHQL_PROVIDERS` diff, REST untouched |
| 3 | E2E parity/dedupe coverage + README | PR 3 | `pnpm test:e2e -- notification-create` | `test/helpers/app-bootstrap.ts` full app + stubbed Discord webhook | delete `notification-create.e2e-spec.ts`, revert README section, no prod code touched |

## Phase 1: REST creation (PR 1, spec req "Synchronous Notification Creation" + "Input Validation" + "Dedupe-Idempotent")

- [x] 1.1 RED: `.../transport/rest/dtos/notification-create-request.dto.spec.ts` — required-field rejection, D5 `@IsIn([DISCORD])` rejects `EMAIL`/`PUSH`
- [x] 1.2 GREEN: `.../transport/rest/dtos/notification-create-request.dto.ts` — `NotificationCreateRequestDto`, Swagger `@ApiProperty`, class-validator per design D5/D8
- [x] 1.3 GREEN: `.../transport/rest/dtos/notification-create-response.dto.ts` — `NotificationCreateResponseDto { id }`, constructor from `CreateNotificationResult`
- [x] 1.4 RED (extend): `.../transport/rest/notification.controller.spec.ts` — add `CommandBus` mock; assert `create()` dispatches one `CreateNotificationCommand` built from the DTO and maps `{ id }` to response
- [x] 1.5 GREEN: `.../transport/rest/notification.controller.ts` — inject `CommandBus` alongside `QueryBus`; add `create()` (`@Post()`, `@HttpCode(201)`, `@ApiOperation`, `@ApiResponse`) per design D3/D7 insertion point (no guard)

## Phase 2: GraphQL creation (PR 2, same spec reqs, GraphQL scenarios)

- [x] 2.1 RED: `.../transport/graphql/dtos/requests/notification-create.request.dto.spec.ts` — required-field rejection, D5 `@IsIn([DISCORD])` rejects `EMAIL`/`PUSH`
- [x] 2.2 GREEN: `.../transport/graphql/dtos/requests/notification-create.request.dto.ts` — `@InputType()` mirroring REST validators (design D6, flat path)
- [x] 2.3 RED: `.../transport/graphql/resolvers/mutations/notification-mutations.resolver.spec.ts` — asserts one `CreateNotificationCommand` dispatch, entry-log call, `MutationResponseGraphQLMapper.toResponseDto({ success: true, id, message })` mapping (mocked `CommandBus` + mapper, manual instantiation, D2 no re-provide)
- [x] 2.4 GREEN: `.../transport/graphql/resolvers/mutations/notification-mutations.resolver.ts` — `NotificationMutationsResolver`, `notificationCreate` mutation per design interface
- [x] 2.5 GREEN: `.../notifications.module.ts` — import + add `NotificationMutationsResolver` to `GRAPHQL_PROVIDERS` only (D2: mapper NOT re-added)

## Phase 3: E2E + docs (PR 3, all four spec scenarios, both transports)

- [ ] 3.1 RED: `test/notification-create.e2e-spec.ts` — REST/GraphQL happy path (201/id), dedupe replay same id no 2nd row, cross-transport dedupe, invalid-input rejection both transports, D5 non-DISCORD rejection both transports; model on `notification-find-by-id.e2e-spec.ts` + `notification-ingest.e2e-spec.ts`, stub Discord webhook per `notification-delivery.e2e-spec.ts`
- [ ] 3.2 GREEN: confirm Phase 1+2 code satisfies 3.1 with no further prod changes; fix only if a real gap surfaces
- [ ] 3.3 Update `src/contexts/notifications/README.md` — document REST/GraphQL creation surface, DISCORD-only constraint (D5), unauthenticated-write tradeoff (D7)
- [ ] 3.4 Run `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint`, `pnpm build`; confirm coverage >= 80%
