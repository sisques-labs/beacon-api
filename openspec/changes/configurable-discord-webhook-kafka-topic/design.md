# Design: Producer-Controlled Discord Delivery Opt-Out

## Technical Approach

`deliveryMode` is normalized to a value object **exactly once**, in the
`CreateNotificationCommand` constructor, so all three transports (Kafka, REST,
GraphQL) inherit identical default and validation semantics with no per-transport
default. The aggregate gains an immutable `deliveryMode` field and a `skip()`
method mirroring `cancel()`. Suppression is enforced at three points
(create → enqueue → deliver) so no path can reach the sender adapter.

## Architecture Decisions

| # | Decision | Alternatives rejected | Rationale |
|---|---|---|---|
| D-A | Default `DELIVER` resolved in `CreateNotificationCommand` ctor only | Default in each DTO (`@ApiProperty({default})`, GraphQL `defaultValue`), default in builder only | Three defaults drift. One normalization point makes "absent ⇒ DELIVER" provable in `create-notification.command.spec.ts` for every transport at once. |
| D-B | Aggregate `skip()` applied in `CreateNotificationCommandHandler` right after `create()`, one `save()` | Second command (`SkipNotificationCommand`) dispatched from the event handler | Atomic: one DB write, no window where a `RECORD_ONLY` row sits `PENDING` forever if the event handler fails. No new command/handler/module wiring. |
| D-C | `DeliverNotificationOnCreatedHandler` early-returns on `RECORD_ONLY` | Enqueue and let the delivery handler drop it | Spec requires *no job enqueued*. `event.data` is the `create()` primitives snapshot and already carries `deliveryMode`, so no extra injection. |
| D-D | Keep a `RECORD_ONLY` branch in `DeliverNotificationCommandHandler` too | Rely on D-B/D-C only | Defense in depth for jobs enqueued before deploy or manually re-queued; literally satisfies the ADDED delivery requirement ("the delivery handler MUST NOT invoke ... MUST transition to SKIPPED"). |
| D-E | No `skippedAt` column/VO | Mirror `cancelledAt` | No spec requires it; `touch()`/`updatedAt` records the instant. Avoids a second column + VO + primitives + 3 DTO fields. |
| D-F | `deliveryMode` is `readonly` on the aggregate | Mutable with a setter | Producer-declared at request time; nothing in scope changes it after creation. |
| D-G | `SKIPPED` terminality is implicit | Explicit terminal-status list | `assertTransition(expected, target)` already rejects anything whose current status is not the `expected` one. No method passes `SKIPPED` as `expected`, so terminality holds with **zero** change to `assertTransition`. |
| D-H | **No repository work for `findByCriteria`** | Write a `QueryBuilder` translation | `NotificationTypeormReadRepository.findByCriteria` (lines 34–51) **already exists** and delegates to `applyCriteriaToQueryBuilder` from `@sisques-labs/nestjs-kit/typeorm`, which already implements all 8 `FilterOperator` values plus sorting and pagination. Adding a second translation would duplicate the kit. |
| D-I | `findByCriteria` exposed on **GraphQL only** | Parallel REST list endpoint with query-string filters | The kit's entire Criteria transport surface is GraphQL (`createFilterInput`/`createSortInput` emit `@InputType()`, `BaseFindByCriteriaInput`, `FilterValidationPipe`). A REST twin needs a second query-string parser and a second validation path for zero spec benefit. REST keeps `GET /:id` + `POST`. |
| D-J | Accept the kit's per-descriptor operator behavior as-is for enum fields | Context-local guard rejecting `gt/lt/gte/lte/like` on enum fields | `FilterValidationPipe` validates the *value* against the enum, not the operator, so an ordering operator on a `varchar` column yields a lexicographic comparison — semantically odd, never an error or an injection. Forking kit behavior for one field costs more than it buys; instead all 8 operators are pinned by spec so the behavior is intentional. |
| D-K | Minimum viable queryable-field set of 6 | All 14 ViewModel scalars | `deliveryMode`/`status` are the spec requirement; `tenantId` is **mandatory** (a multi-tenant list query with no tenant filter is a cross-tenant leak); `createdAt` makes the list sortable. `title`/`body` are deliberately excluded — `ILIKE '%...%'` over an unindexed `varchar(5000)` is a cheap DoS and a PII surface. |

## Data Flow

    Kafka / REST / GraphQL DTO  (deliveryMode?: enum | absent)
              │
              ▼
    CreateNotificationCommand ctor ── absent ⇒ DELIVER ──► NotificationDeliveryModeValueObject
              │
              ▼
    CreateNotificationCommandHandler
        builder.withDeliveryMode(...) → aggregate.create()
        if RECORD_ONLY → aggregate.skip()          (status PENDING → SKIPPED)
        save() once  →  publishEvents()
              │
              ├─ NotificationCreatedEvent ─► DeliverNotificationOnCreatedHandler
              │        RECORD_ONLY ⇒ return (no enqueue)  │ DELIVER ⇒ enqueue
              │                                            ▼
              └─ NotificationSkippedEvent            BullMQ → DeliverNotificationCommandHandler
                                                        status ≠ PENDING ⇒ return
                                                        RECORD_ONLY     ⇒ skip(), save, return
                                                        else            ⇒ senderPort.send()

## File Changes

| File (under `src/contexts/notifications/` unless noted) | Action | Change |
|---|---|---|
| `domain/enums/notification-delivery-mode.enum.ts` | Create | `export enum NotificationDeliveryModeEnum { DELIVER = 'DELIVER', RECORD_ONLY = 'RECORD_ONLY' }` |
| `domain/enums/notification-status.enum.ts` | Modify | Append `SKIPPED = 'SKIPPED'` |
| `domain/value-objects/notification-delivery-mode/notification-delivery-mode.value-object.ts` | Create | `NotificationDeliveryModeValueObject extends EnumValueObject<typeof NotificationDeliveryModeEnum>` — byte-for-byte the shape of `notification-channel.value-object.ts` |
| `domain/events/notification-skipped/notification-skipped.event.ts` | Create | `NotificationSkippedEvent extends BaseEvent<INotificationEventData>` (copy of `notification-cancelled.event.ts`) |
| `domain/interfaces/notification.interface.ts` | Modify | `deliveryMode: NotificationDeliveryModeValueObject` |
| `domain/primitives/notification.primitives.ts` | Modify | `deliveryMode: string` |
| `domain/view-models/notification.view-model.ts` | Modify | `public readonly deliveryMode: string` + ctor assignment |
| `domain/aggregates/notification.aggregate.ts` | Modify | `private readonly _deliveryMode`; ctor hydration; `toPrimitives()` entry; getter; new `skip()` = `assertTransition(PENDING, SKIPPED)` → set status → `touch()` → `apply(NotificationSkippedEvent)`. **`assertTransition` itself is unchanged.** |
| `domain/builders/notification.builder.ts` | Modify | `private _deliveryMode: string = NotificationDeliveryModeEnum.DELIVER`; `withDeliveryMode()`; wire into `build()` (wrap in VO) and `buildViewModel()` |
| `application/commands/create-notification/create-notification.command.ts` | Modify | Input becomes `Pick<...existing> & { deliveryMode?: string }` (a `Pick` cannot make it optional); field `deliveryMode: NotificationDeliveryModeValueObject` = `new ...(( input.deliveryMode ?? DELIVER) as NotificationDeliveryModeEnum)` |
| `application/commands/create-notification/create-notification.handler.ts` | Modify | `.withDeliveryMode(command.deliveryMode.value)`; after `aggregate.create()`, `if (command.deliveryMode.value === RECORD_ONLY) aggregate.skip();` — still one `save()` + one `publishEvents()` |
| `application/events/deliver-notification-on-created.handler.ts` | Modify | Guard before `enqueue`: `if (event.data.deliveryMode === RECORD_ONLY) { this.logger.log(...); return; }` |
| `application/commands/deliver-notification/deliver-notification.handler.ts` | Modify | After the existing non-`PENDING` guard (line 48) and **before** `senderPort.send()` (line 55): `if (notification.deliveryMode.value === RECORD_ONLY) { notification.skip(); await save; await publishEvents; return; }` |
| `infrastructure/persistence/typeorm/entities/notification.entity.ts` | Modify | `@Column({ type: 'varchar', length: 20, default: NotificationDeliveryModeEnum.DELIVER }) deliveryMode!: string;` |
| `infrastructure/persistence/typeorm/mappers/notification-typeorm.mapper.ts` | Modify | `entity.deliveryMode = primitives.deliveryMode` in `toEntity`; `.withDeliveryMode(entity.deliveryMode)` in `buildFrom` |
| `src/database/migrations/{ts}-add-notification-delivery-mode.ts` | Create | See Migration below |
| `transport/kafka/dtos/notification-ingest.dto.ts` | Modify | `@IsOptional() @IsEnum(NotificationDeliveryModeEnum) deliveryMode?: NotificationDeliveryModeEnum;` |
| `transport/kafka/consumers/notification-ingest.consumer.ts` | Modify | Pass `deliveryMode: dto.deliveryMode` into the command. Invalid value already falls into the existing `validate()` log-and-skip branch — no new handling. |
| `transport/rest/dtos/notification-create-request.dto.ts` | Modify | `@ApiPropertyOptional({ enum: NotificationDeliveryModeEnum, default: DELIVER }) @IsOptional() @IsEnum(NotificationDeliveryModeEnum)` |
| `transport/graphql/dtos/requests/notification-create.request.dto.ts` | Modify | `@Field(() => NotificationDeliveryModeEnum, { nullable: true }) @IsOptional() @IsEnum(...)`. **Do not set GraphQL `defaultValue`** — that would be a second default (D-A). |
| `transport/graphql/enums/notification-registered-enums.graphql.ts` | Modify | Add `NotificationDeliveryModeEnum` to `registeredNotificationEnums` |
| `transport/rest/controllers/notification.controller.ts` | Modify | Thread `dto.deliveryMode` into the command; `findById` returns `this.notificationRestMapper.toResponseDtoFromViewModel(viewModel)` |
| `transport/graphql/resolvers/mutations/notification-mutations.resolver.ts` | Modify | Thread `input.deliveryMode` into the command |
| `transport/rest/dtos/notification-response.dto.ts` | Modify | Add `@ApiProperty() deliveryMode: string`; **delete the mapping constructor** (architecture hard rule 8 — response DTOs never map themselves; fixing it here because we are already editing the file) |
| `transport/rest/mappers/notification.mapper.ts` | Modify | Add `toResponseDtoFromViewModel(vm): NotificationResponseDto` |
| `transport/graphql/dtos/responses/notification.response.dto.ts` | Modify | `@Field(() => NotificationDeliveryModeEnum) deliveryMode!: NotificationDeliveryModeEnum` |
| `transport/graphql/mappers/notification.mapper.ts` | Modify | `dto.deliveryMode = vm.deliveryMode as NotificationDeliveryModeEnum` |
| `README.md` (context) | Modify | Document the capability (config.yaml `rules.apply`) |

## Interfaces / Contracts

```ts
// domain/aggregates/notification.aggregate.ts — new method, cancel() shape
public skip(): void {
  this.assertTransition(NotificationStatusEnum.PENDING, NotificationStatusEnum.SKIPPED);
  this._status = new NotificationStatusValueObject(NotificationStatusEnum.SKIPPED);
  this.touch();
  this.apply(new NotificationSkippedEvent(
    this.generateEventMetadata(NotificationSkippedEvent), this.toPrimitives()));
}
```

**Cross-repo contract frozen here** (consumed by `beacon-ts-sdk`, out of scope):
field name `deliveryMode`; values `DELIVER` | `RECORD_ONLY`; optional, absent ⇒
`DELIVER`; read side may return status `SKIPPED`.

## Slice 3 — Criteria / findByCriteria

### What already exists (do not rebuild)

| Piece | Where | State |
|---|---|---|
| `findByCriteria` repository method | `infrastructure/persistence/typeorm/repositories/notification-typeorm-read.repository.ts:34-51` | **Done.** Calls `applyCriteriaToQueryBuilder(qb, criteria, { alias: 'notification' })`, then `.skip().take().getManyAndCount()` into a `PaginatedResult`. |
| All 8 `FilterOperator` translations + sorting | `@sisques-labs/nestjs-kit/typeorm` → `applyCriteriaToQueryBuilder` | **Done in the kit.** No context-local `QueryBuilder` code is needed or wanted. |
| `findByCriteria` on the port | `IBaseReadRepository<NotificationViewModel>` (kit) | **Done** — `INotificationReadRepository` is a type alias of it. |
| `FilterOperator` / `SortDirection` GraphQL registration | `src/core/transport/graphql/registered-enums.graphql.ts` | **Done, globally.** Do not re-register per context. |
| `BaseFilterInput` / `BaseSortInput` / `BasePaginationInput` / `BaseFindByCriteriaInput` / `BasePaginatedResultDto` | kit `shared/transport/graphql/dtos/` | **Done.** Extend, never copy. |

Slice 3 is therefore **only the contract surface plus the application query and
the resolver** — the persistence half of the Criteria pattern is already in
place. This is a correction to the earlier assessment that no Criteria
infrastructure existed.

### New files

| File (under `src/contexts/notifications/`) | Content |
|---|---|
| `transport/graphql/enums/notification-queryable-field.enum.ts` | `NotificationQueryableField` — see field set below |
| `transport/graphql/registries/notification-filterable-fields.registry.ts` | `notificationFilterableFields: FilterFieldRegistry<NotificationQueryableField>` |
| `transport/graphql/registries/notification-filterable-fields.registry.spec.ts` | mandatory co-located spec (architecture skill) |
| `transport/graphql/dtos/requests/notification-filter.input.ts` | `@InputType('NotificationFilterInput') export class NotificationFilterInput extends createFilterInput(NotificationQueryableField, 'Notification') {}` |
| `transport/graphql/dtos/requests/notification-sort.input.ts` | same shape with `createSortInput` |
| `transport/graphql/dtos/requests/notification-find-by-criteria.request.dto.ts` | `NotificationFindByCriteriaRequestDto extends BaseFindByCriteriaInput`, overriding `filters`/`sorts` |
| `transport/graphql/dtos/responses/notification-paginated.response.dto.ts` | `NotificationPaginatedResponseDto extends BasePaginatedResultDto` + `@Field(() => [NotificationResponseDto]) items!` |
| `application/queries/notification-find-by-criteria/notification-find-by-criteria.query.ts` | query + `NotificationFindByCriteriaQueryInput` |
| `application/queries/notification-find-by-criteria/notification-find-by-criteria.handler.ts` | `NotificationFindByCriteriaHandler` |
| + co-located `.spec.ts` for the query, handler, both inputs, and the request DTO | |

Modified: `notification-registered-enums.graphql.ts` (register
`NotificationQueryableField` as `NotificationQueryableFieldEnum`),
`transport/graphql/mappers/notification.mapper.ts` (add
`toPaginatedResponseDtoFromPaginatedResult`),
`transport/graphql/resolvers/queries/notification-queries.resolver.ts` (add
`notificationsFindByCriteria`), `notifications.module.ts` (add the handler to
`QUERY_HANDLERS`), context `README.md`.

### Queryable field set (D-K)

```ts
export enum NotificationQueryableField {
  TENANT_ID = 'tenantId',
  RECIPIENT_USER_ID = 'recipientUserId',
  CHANNEL = 'channel',
  STATUS = 'status',
  DELIVERY_MODE = 'deliveryMode',
  CREATED_AT = 'createdAt',
}

export const notificationFilterableFields: FilterFieldRegistry<NotificationQueryableField> = {
  [NotificationQueryableField.TENANT_ID]: { type: 'uuid' },
  [NotificationQueryableField.RECIPIENT_USER_ID]: { type: 'uuid' },
  [NotificationQueryableField.CHANNEL]: { type: 'enum', enum: NotificationChannelEnum },
  [NotificationQueryableField.STATUS]: { type: 'enum', enum: NotificationStatusEnum },
  [NotificationQueryableField.DELIVERY_MODE]: { type: 'enum', enum: NotificationDeliveryModeEnum },
  [NotificationQueryableField.CREATED_AT]: { type: 'date' },
};
```

Enum descriptors reference the **real domain enums** — never a duplicated string
list — so `SKIPPED` becomes a valid `status` filter value the moment slice 1
lands, with no registry edit. Every enum value maps to a real
`NotificationEntity` column.

Excluded on purpose: `title`, `body` (unindexed `varchar(5000)` free-text
`ILIKE` — DoS + PII surface), `dedupeKey`, `failureReason`, `sentAt`, `readAt`,
`cancelledAt`, `updatedAt`, `id` (use `notificationFindById`).

### All 8 `FilterOperator` values against `deliveryMode`

The kit's `FilterOperator` values are lowercase wire tokens:
`eq, ne, like, in, gt, lt, gte, lte`. `FilterValidationPipe.matchesDescriptor`
validates the **value** against the enum (`Object.values(enum).includes(value)`),
and for `IN` validates every array element — it does **not** restrict which
operator may be used with which descriptor type.

| Operator | Wire | `deliveryMode` behavior | Verdict |
|---|---|---|---|
| `EQUALS` | `eq` | `"deliveryMode" = 'RECORD_ONLY'` | **Meaningful** — the spec scenario |
| `NOT_EQUALS` | `ne` | `!= 'RECORD_ONLY'` | **Meaningful** |
| `IN` | `in` | `IN ('DELIVER','RECORD_ONLY')` | **Meaningful**; each element value-validated |
| `LIKE` | `like` | `ILIKE '%DELIVER%'` | Tolerated — valid SQL, but substring matching a closed token is pointless |
| `GREATER_THAN` | `gt` | `> 'DELIVER'` — lexicographic `varchar` compare | Tolerated, semantically meaningless (no ordering on this enum) |
| `LESS_THAN` | `lt` | `< 'DELIVER'` | Tolerated, meaningless |
| `GREATER_THAN_OR_EQUAL` | `gte` | `>= 'DELIVER'` | Tolerated, meaningless |
| `LESS_THAN_OR_EQUAL` | `lte` | `<= 'DELIVER'` | Tolerated, meaningless |

Per D-J the four ordering operators are **not** rejected. They are safe (value
still whitelisted, still parameterized, never an error) and simply return a
lexicographic slice. The registry spec pins all eight so the behavior is a
recorded decision rather than an accident. The same table applies to `status`,
where `SKIPPED` sorts lexicographically between `SENT` and nothing else — never
rely on it.

### Application layer

```ts
// notification-find-by-criteria.query.ts
export interface NotificationFindByCriteriaQueryInput {
  criteria: Criteria;
}
export class NotificationFindByCriteriaQuery {
  public readonly criteria: Criteria;
  constructor(input: NotificationFindByCriteriaQueryInput) { this.criteria = input.criteria; }
}
```

`Criteria` is the kit's own domain entity (`filters`/`sorts`/`pagination`), so
it is already the value-shaped type `rules.apply` asks for — no per-field VO
wrapping, consistent with the config rule "Queries have a `{Name}QueryInput` type
alias **or use `Criteria` for list queries**".

The handler mirrors `NotificationFindByIdHandler`: `@QueryHandler`, a `Logger`,
log at entry (`rules.apply` logging rule), inject
`@Inject(NOTIFICATION_READ_REPOSITORY) readRepository`, return
`this.readRepository.findByCriteria(query.criteria)` as
`PaginatedResult<NotificationViewModel>`. No assert service — an empty page is a
valid result, not a 404.

### Transport layer

```ts
@InputType()
export class NotificationFindByCriteriaRequestDto extends BaseFindByCriteriaInput {
  @Field(() => [NotificationFilterInput], { nullable: true, defaultValue: [] })
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => NotificationFilterInput)
  declare filters?: NotificationFilterInput[];
  // same shape for sorts / NotificationSortInput
}
```

Resolver method on the existing `NotificationQueriesResolver`:

```ts
@Query(() => NotificationPaginatedResponseDto, { name: 'notificationsFindByCriteria' })
async notificationsFindByCriteria(
  @Args('input', { nullable: true }, new FilterValidationPipe(notificationFilterableFields))
  input?: NotificationFindByCriteriaRequestDto,
): Promise<NotificationPaginatedResponseDto> { ... }
```

It logs at entry, builds a `Criteria` from the input, dispatches through
`QueryBus` only, and maps via
`notificationGraphQLMapper.toPaginatedResponseDtoFromPaginatedResult(result)`.
The mapper reuses the existing `toResponseDtoFromViewModel` per item, so
`deliveryMode` and `SKIPPED` flow through with no extra mapping code.

REST is unchanged in slice 3 (D-I).

### Slice 3 testing (Strict TDD)

| File | Cases |
|---|---|
| `notification-filterable-fields.registry.spec.ts` **(mandatory)** | every `NotificationQueryableField` value has a registry entry; `deliveryMode` descriptor is `{type:'enum', enum: NotificationDeliveryModeEnum}`; `status` descriptor enum contains `SKIPPED`; `FilterValidationPipe` accepts `deliveryMode eq RECORD_ONLY` and `status eq SKIPPED`; **rejects an unknown field** (`'body'`, `'password'`) with `BadRequestException`; rejects `deliveryMode eq 'NOPE'`; accepts `in` with a valid array and rejects an array containing an invalid member; one case per remaining operator pinning D-J |
| `notification-filter.input.spec.ts` / `notification-sort.input.spec.ts` | `field` rejects a non-enum value via `@IsEnum`; class name/GraphQL type name are `NotificationFilterInput`/`NotificationSortInput` |
| `notification-find-by-criteria.request.dto.spec.ts` | absent input; empty `filters` default `[]`; nested validation rejects a bad filter |
| `notification-find-by-criteria.query.spec.ts` | carries the `Criteria` through unchanged |
| `notification-find-by-criteria.handler.spec.ts` | delegates to `findByCriteria` with the exact `Criteria`; returns the `PaginatedResult` unchanged; empty page is returned, not thrown (`Mocked<INotificationReadRepository>`) |
| `notification-registered-enums.graphql.spec.ts` | `NotificationQueryableFieldEnum` registered |
| `notification.mapper.spec.ts` (GraphQL) | `toPaginatedResponseDtoFromPaginatedResult` maps `items`/`total`/`page`/`perPage`/`totalPages` and per-item `deliveryMode` + `SKIPPED` |
| `notification-queries.resolver.spec.ts` | dispatches `NotificationFindByCriteriaQuery` via `QueryBus`; maps through the mapper; `undefined` input yields an empty `Criteria` |
| `test/integration/notifications/notification-typeorm-repositories.integration-spec.ts` | real Postgres: `deliveryMode eq RECORD_ONLY` returns only those rows; `status eq SKIPPED` returns only those; `in` with both modes returns both; pagination `total`/`totalPages` correct |
| `test/notification-find-by-criteria.e2e-spec.ts` **(new)** | GraphQL `notificationsFindByCriteria` filtering `deliveryMode EQUALS RECORD_ONLY` and `status EQUALS SKIPPED` (the two spec scenarios); unknown filter field ⇒ error, no rows leaked |

## Migration / Rollout

The `status` column is **`varchar(20)`, not a Postgres native enum**
(`1789112026872-create-notifications.ts:16`). There is therefore **no
`ALTER TYPE ... ADD VALUE`** and none of its non-transactional caveats.
`'SKIPPED'` (7 chars) and `'RECORD_ONLY'` (11 chars) both fit.

```sql
-- up
ALTER TABLE "notifications"
  ADD COLUMN "deliveryMode" varchar(20) NOT NULL DEFAULT 'DELIVER';
-- down
ALTER TABLE "notifications" DROP COLUMN "deliveryMode";
```

**Rollback hazard (real one is not the column).** The down migration leaves
`status = 'SKIPPED'` rows intact, and reverted code's
`NotificationStatusValueObject` validates in its constructor — every read of
such a row would throw on hydration. Before running `down`, operators MUST run
`SELECT count(*) FROM notifications WHERE status = 'SKIPPED'` and explicitly
triage (leave the rows and accept read failures, or
`UPDATE notifications SET status = 'CANCELLED' WHERE status = 'SKIPPED'`).
`sdd-verify` must assert this triage step exists.

## Testing Strategy

Strict TDD is on: every row below is RED-before-GREEN.

| Layer | File | Cases |
|---|---|---|
| Unit | `notification-delivery-mode.value-object.spec.ts` **(new)** | accepts both values; rejects `'MAYBE'` and `'https://evil.example/x'` |
| Unit | `notification.aggregate.spec.ts` | `skip()` `PENDING→SKIPPED` + event; `skip()` from SENT/FAILED/CANCELLED/SKIPPED throws; `sent()`/`fail()`/`cancel()`/`read()` from `SKIPPED` throw; `toPrimitives()` carries `deliveryMode` |
| Unit | `notification.builder.spec.ts` | defaults to `DELIVER`; `withDeliveryMode`; view model carries it |
| Unit | `create-notification.command.spec.ts` | absent ⇒ `DELIVER`; `RECORD_ONLY` preserved; invalid throws |
| Unit | `create-notification.handler.spec.ts` | `RECORD_ONLY` ⇒ saved aggregate is `SKIPPED`, `save` called once; `DELIVER` ⇒ `PENDING` (regression) |
| Unit | `deliver-notification-on-created.handler.spec.ts` | `RECORD_ONLY` ⇒ `enqueue` **not** called; `DELIVER` ⇒ called |
| Unit | `deliver-notification.handler.spec.ts` | `PENDING`+`RECORD_ONLY` ⇒ `senderPort.send` **not** called, status `SKIPPED`, saved; already-`SKIPPED` ⇒ existing early return |
| Unit | `notification-typeorm.mapper.spec.ts` | round-trips `deliveryMode` and `SKIPPED` |
| Unit | `notification-ingest.dto.spec.ts`, `notification-create-request.dto.spec.ts` (REST), `notification-create.request.dto.spec.ts` (GraphQL) | absent / valid / invalid (incl. URL-shaped) |
| Unit | `notification-ingest.consumer.spec.ts`, `notification.controller.spec.ts`, `notification-mutations.resolver.spec.ts` | command carries `deliveryMode`; invalid ⇒ no command dispatched |
| Unit | `notification.mapper.spec.ts` (REST + GraphQL), `notification-registered-enums.graphql.spec.ts` | `deliveryMode` mapped; REST `toResponseDtoFromViewModel` exists; delivery-mode enum registered; `SKIPPED` present |
| Integration | `test/integration/notifications/notification-typeorm-repositories.integration-spec.ts` | persist + read back `RECORD_ONLY` / `SKIPPED` against real Postgres |
| E2E | `test/notification-ingest.e2e-spec.ts` | `RECORD_ONLY` event ⇒ row with `deliveryMode=RECORD_ONLY`, `status=SKIPPED`; invalid value ⇒ no row |
| E2E | `test/notification-delivery.e2e-spec.ts` | `RECORD_ONLY` ⇒ `HttpService.post` never called, queue drains with no job, terminal `SKIPPED`; `DELIVER` paths unchanged |
| E2E | `test/notification-create.e2e-spec.ts` | REST 201 / GraphQL success with `deliveryMode`; invalid ⇒ 400 / GraphQL error |
| E2E | `test/notification-find-by-id.e2e-spec.ts` | `SKIPPED` + `deliveryMode` returned by REST and GraphQL without error |

## Threat Matrix

No routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary exists. Two security-relevant
boundaries are in scope and are design requirements that MUST propagate to tasks
and RED tests unchanged.

| Row | Applicable? | Expected safe behavior | Planned RED test |
|---|---|---|---|
| **SSRF (constraint D3)** — caller influencing the outbound destination | **Applicable** (slices 1–2) | `deliveryMode` is a closed two-token enum validated by `EnumValueObject` in the domain and `@IsEnum` at every transport edge. No field added anywhere in this change carries a URL, host, or destination; `DISCORD_WEBHOOK_URL` stays the sole destination source. A URL-shaped value is a validation failure, never a destination. | URL-shaped rejection case in all three create-DTO specs and in the delivery-mode VO spec |
| **SQL identifier injection via `filter.field`** | **Applicable** (slice 3) | `applyCriteriaToQueryBuilder` interpolates `filter.field` **directly** into the column string (`` `${alias}.${filter.field}` ``); only the *value* is parameterized. The two mandatory guards are therefore load-bearing, not decorative: `@IsEnum(NotificationQueryableField)` on the generated `NotificationFilterInput.field`, and `FilterValidationPipe(notificationFilterableFields)` wired as the third `@Args` argument. Either one missing turns an arbitrary caller string into raw SQL. | Registry spec MUST assert `FilterValidationPipe` throws `BadRequestException` for an unknown field; resolver spec MUST assert the pipe is wired |
| **Over-broad read exposure / cross-tenant leak** | **Applicable** (slice 3) | The queryable-field set is a deliberate whitelist (D-K); `tenantId` is filterable so callers can scope, and `title`/`body` are not filterable so no unindexed free-text `ILIKE` over PII is reachable. | Registry spec asserts `body`/`title` are rejected as unknown filter fields |
| Value injection through `filter.value` | N/A | Values are bound as query parameters by the kit and additionally type/enum-checked by `FilterValidationPipe`. | — |

## Delivery Slices (400-line review budget, `delivery_strategy: auto-chain`)

Five chained PRs. PR #1 targets the feature/tracker branch; each later PR targets
the immediately previous PR's branch. Each slice has an autonomous scope, its own
verification, and a clean rollback.

| PR | Slice | Contents | Est. lines | Budget risk |
|---|---|---|---|---|
| 1 | **1 — domain + persistence** | delivery-mode enum + VO + skipped event; `SKIPPED` on status enum; aggregate field/`skip()`/`toPrimitives`/getter; interface, primitives, view model, builder; TypeORM entity + mapper; migration; VO/aggregate/builder/mapper unit specs; repository integration spec | ~300 | Low |
| 2 | **2a — application** | `CreateNotificationCommand` input + default; create handler `skip()`; on-created enqueue guard; deliver-handler `RECORD_ONLY` branch; four unit specs | ~230 | Low |
| 3 | **2b — transport** | Kafka/REST/GraphQL create DTOs + consumer/controller/resolver threading; REST + GraphQL response DTOs; REST mapper `toResponseDtoFromViewModel` (+ removing the DTO's self-mapping constructor); GraphQL mapper; registered enums; README; unit specs; 4 E2E specs | ~340 | Medium |
| 4 | **3a — Criteria contract surface** | queryable-field enum, filterable-fields registry (+ mandatory spec), filter/sort inputs (+ specs), find-by-criteria request DTO (+ spec), enum registration | ~290 | Medium |
| 5 | **3b — Criteria query + resolver** | query + handler (+ specs), paginated response DTO, GraphQL mapper paginated method (+ spec), resolver method (+ spec), module wiring, README, integration filter cases, new `notification-find-by-criteria.e2e-spec.ts` | ~330 | Medium |

**Slice 3 must be split into two PRs** (#4 and #5): 3a + 3b together land at
roughly 620 authored lines with strict-TDD RED specs, which clears the 400-line
budget on its own. Slice 2 is likewise split (2a/2b) — combined it was ~450.
Slice 3 is nonetheless far smaller than first estimated, because the repository
`findByCriteria` and all 8 operator translations already exist (D-H).

PR #4 is independently deliverable: it adds a validated, registered contract
surface with no query wired to it yet — dead but correct code, safe to sit on
the chain. PR #5 is the one that makes `notificationsFindByCriteria` reachable.

Guard lines for `sdd-tasks`:

    Decision needed before apply: No
    Chained PRs recommended: Yes
    400-line budget risk: Medium

## Open Questions

None. The Criteria/`findByCriteria` scope question is resolved: it is **in
scope** for this change as slices 3a and 3b above.

## Key Learnings

1. The notification `status` column is `varchar(20)`, so no Postgres `ALTER TYPE` caveat applies.
2. Enqueue lives in `DeliverNotificationOnCreatedHandler`, not in the create handler.
3. `assertTransition(expected, target)` gives `SKIPPED` terminality for free, with no guard edit.
4. `NotificationResponseDto` (REST) currently maps itself, violating architecture hard rule 8.
5. `applyCriteriaToQueryBuilder` interpolates `filter.field` straight into SQL, so the field whitelist is the injection guard.
