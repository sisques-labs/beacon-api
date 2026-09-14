# Design: Synchronous notification creation via REST and GraphQL

## Technical Approach

Two thin transport adapters over the **unchanged** `CreateNotificationCommand`: a `POST` handler on the existing `NotificationController` and a new `NotificationMutationsResolver` (the service's first mutation resolver). Both validate a class-validator DTO, dispatch via `CommandBus`, and map `CreateNotificationResult` (`{ id: string }`) to a transport response. No domain, application, or infrastructure file is touched — dedupe-idempotency already lives in `CreateNotificationCommandHandler` (`findNotificationByDedupeKeyService` pre-check + `NotificationDedupeKeyAlreadyExistsException` race recovery), so both adapters merely pass `tenantId`/`dedupeKey` through.

## Architecture Decisions

| # | Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|---|
| D1 | `MutationResponseDto` shape (**resolves the proposal's open risk**) | Confirmed from `node_modules/@sisques-labs/nestjs-kit/dist/shared/transport/graphql/dtos/responses/success-response/success-response.dto.js`: `@ObjectType('MutationResponseDto')` with `@Field(() => Boolean) success`, `@Field(() => String, { nullable: true }) message`, `@Field(() => String, { nullable: true }) id`. Import from `@sisques-labs/nestjs-kit/graphql` (the `./graphql` entrypoint re-exports it; the root `.` entrypoint does **not**). `MutationResponseGraphQLMapper.toResponseDto(props)` is a same-shape passthrough | A context-local `NotificationCreateResponseDto` `@ObjectType` | Verified, not assumed. Three fields cover the mutation exactly: `success: true`, `id` = created (or deduped) notification id, `message` a human-readable confirmation. A local object type would fork the service's first mutation off the kit's shared contract on day one |
| D2 | GraphQL mapper wiring | Inject `MutationResponseGraphQLMapper` into the resolver constructor; do **not** add it to `GRAPHQL_PROVIDERS` | Adding it to the context module's providers (as the kit README suggests) | `SharedGraphQLModule` is `@Global()` and both provides and exports the mapper; it is imported once in `CoreModule`. Architecture skill Hard Rule #3 forbids re-providing it. `NotificationGraphQLMapper` stays untouched — the proposal's "mappers Modified if needed" resolves to **not needed** |
| D3 | REST response body | `201 Created` + `NotificationCreateResponseDto { id }` | Re-query and return the full `NotificationResponseDto` | The command returns only `{ id }`. Returning the full aggregate needs a second `QueryBus` round-trip for data the caller did not ask for, and on a dedupe replay it would return a stale-status record. `201 + { id }` keeps the adapter thin; callers follow with the existing `GET :id` |
| D4 | Dedupe replay is indistinguishable from a fresh create | Both transports return the same success shape and status (`201` / `success: true`) on a replay | `200 OK` vs `201 Created`; an `alreadyExisted` flag | `CreateNotificationResult` carries only `id`. Distinguishing would require changing the application-layer result contract — explicitly out of scope. Idempotent-by-design: same request, same response, one notification |
| D5 | Channel restriction on the write path | DTOs accept the domain enum type but constrain the value: `@IsEnum(NotificationChannelEnum)` **plus** `@IsIn([NotificationChannelEnum.DISCORD])`, rejecting `EMAIL`/`PUSH` with a 400 / GraphQL validation error | (a) accept all three values; (b) declare a transport-only single-value enum | **Delivery has no channel branch**: `DeliverNotificationCommandHandler` sends every created notification through `DiscordWebhookNotificationSenderAdapter`. Accepting `EMAIL` would silently deliver it to Discord. The Kafka consumer solves this by *silently skipping* non-DISCORD — correct for a fire-and-forget broker, wrong for a synchronous caller that deserves an explicit rejection. Option (b) would duplicate the domain enum in the GraphQL schema, breaking "the domain enum is the single source of truth" |
| D6 | File layout | `transport/graphql/resolvers/mutations/notification-mutations.resolver.ts`; request DTO flat at `transport/graphql/dtos/requests/notification-create.request.dto.ts` | The architecture skill's `resolvers/{name}/` and `dtos/requests/{name}/` nesting | **Verified against the real tree**: the existing resolver is at `resolvers/queries/notification-queries.resolver.ts` and the existing request DTO is flat at `dtos/requests/notification-find-by-id.request.dto.ts` (no `{name}/` folder). Real sibling convention wins; skill class-naming (`{Name}MutationsResolver`, `{name}-mutations.resolver.ts`) is honoured |
| D7 | Authentication | **None.** No `@UseGuards(JwtAuthGuard)` on either entry point. The insertion point is the line directly above `@Post()` on `NotificationController.create` and above `@Mutation()` on `notificationCreate`; `JwtAuthGuard` is importable from `@sisques-labs/nestjs-kit/auth-client` and already wired in `CoreModule` | Guarding the write path now | Recorded, deliberate tradeoff (proposal "Known Tradeoffs"). A synchronous write is a larger exposure than a broker topic, so a follow-up change MUST decide the strategy. Documented, not silently added and not silently forgotten |
| D8 | Input validation | No new pipe. The global `ValidationPipe` (`main.ts`: `whitelist`, `forbidNonWhitelisted`, `transform`) covers both REST bodies and GraphQL `@Args` | Per-route pipes | Already global; the Kafka consumer only hand-rolls `plainToInstance` + `validate` because a broker message never passes through the HTTP pipeline |

## Data Flow

```
POST /api/v1/notifications          mutation notificationCreate(input:)
  │ NotificationCreateRequestDto      │ NotificationCreateRequestDto (@InputType)
  │ (global ValidationPipe)           │ (global ValidationPipe)
  ▼                                   ▼
NotificationController.create   NotificationMutationsResolver.notificationCreate
  │  logger.log(entry)                │  logger.log(entry)
  └────────────┬──────────────────────┘
               ▼ CommandBus.execute(new CreateNotificationCommand({...}))
      CreateNotificationCommandHandler        [UNCHANGED]
        ├─ findByDedupeKey(tenantId, dedupeKey) hit ──► return existing { id }
        └─ build → aggregate.create() → save → publishEvents → { id }
               │                                    └─► NotificationCreatedEvent ─► BullMQ delivery
               ├──► 201 { id }                    (REST)
               └──► MutationResponseGraphQLMapper.toResponseDto({ success: true, id, message })
```

Errors: `BaseExceptionFilter` already renders `BaseException` for both `http` and `graphql` hosts (400 by default, 404 for `NotificationNotFoundException`). Value-object failures from the command constructor surface through it unchanged.

## File Changes

| Path | Action | Description |
|---|---|---|
| `src/contexts/notifications/transport/rest/dtos/notification-create-request.dto.ts` | Create | `NotificationCreateRequestDto` — Swagger `@ApiProperty` + class-validator, D5 channel constraint |
| `.../transport/rest/dtos/notification-create-response.dto.ts` | Create | `NotificationCreateResponseDto { id }`, `@ApiProperty`, constructor takes `CreateNotificationResult` |
| `.../transport/rest/notification.controller.ts` | Modify | Inject `CommandBus` alongside `QueryBus`; add `create()` with `@Post()`, `@HttpCode(201)`, `@ApiOperation`, `@ApiResponse({ status: 201, type: NotificationCreateResponseDto })` |
| `.../transport/rest/notification.controller.spec.ts` | Modify | Add the `CommandBus` mock to the existing manual instantiation; cover dispatch + response mapping |
| `.../transport/graphql/dtos/requests/notification-create.request.dto.ts` | Create | `@InputType() NotificationCreateRequestDto` mirroring the REST DTO's validators |
| `.../transport/graphql/resolvers/mutations/notification-mutations.resolver.ts` (+ `.spec.ts`) | Create | `NotificationMutationsResolver` — `CommandBus` + `MutationResponseGraphQLMapper` only |
| `.../notifications.module.ts` | Modify | `GRAPHQL_PROVIDERS` gains `NotificationMutationsResolver` (one line + import). **No** mapper entry (D2) |
| `src/contexts/notifications/README.md` | Modify | Document the full creation surface (Kafka + REST + GraphQL), the DISCORD-only constraint, and the unauthenticated-write tradeoff |
| `test/notification-create.e2e-spec.ts` | Create | Both transports, modelled on `notification-find-by-id.e2e-spec.ts` + `notification-ingest.e2e-spec.ts` |

## Interfaces / Contracts

```ts
// transport/graphql/dtos/requests/notification-create.request.dto.ts
@InputType()
export class NotificationCreateRequestDto {
  @Field(() => ID) @IsUUID() tenantId!: string;
  @Field(() => ID) @IsUUID() recipientUserId!: string;
  // D5: schema exposes the domain enum; runtime accepts DISCORD only
  @Field(() => NotificationChannelEnum)
  @IsEnum(NotificationChannelEnum)
  @IsIn([NotificationChannelEnum.DISCORD])
  channel!: NotificationChannelEnum;
  @Field() @IsString() @IsNotEmpty() title!: string;
  @Field() @IsString() @IsNotEmpty() body!: string;
  @Field() @IsString() @IsNotEmpty() sourceService!: string;
  @Field() @IsString() @IsNotEmpty() dedupeKey!: string;
}

// transport/graphql/resolvers/mutations/notification-mutations.resolver.ts
@Resolver()
export class NotificationMutationsResolver {
  private readonly logger = new Logger(NotificationMutationsResolver.name);
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mutationResponseGraphQLMapper: MutationResponseGraphQLMapper, // global, D2
  ) {}

  @Mutation(() => MutationResponseDto, {
    name: 'notificationCreate',
    description: 'Create a notification. Idempotent per (tenantId, dedupeKey).',
  })
  async notificationCreate(
    @Args('input') input: NotificationCreateRequestDto,
  ): Promise<MutationResponseDto> { /* log → CommandBus → mapper.toResponseDto */ }
}

// transport/rest/notification.controller.ts
async create(@Body() dto: NotificationCreateRequestDto): Promise<NotificationCreateResponseDto>
```

`NotificationChannelEnum` is already `registerEnumType`-d in `notification-registered-enums.graphql.ts`, imported at the top of `notifications.module.ts` — no enum registration work.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit | Controller and resolver each dispatch exactly one `CreateNotificationCommand` built from the DTO; response mapping (`{ id }` / `{ success, id, message }`); resolver logs at entry; DTO validation incl. D5 rejection of `EMAIL`/`PUSH` | Manual instantiation with `Mocked<CommandBus>` / `Mocked<MutationResponseGraphQLMapper>`; `plainToInstance` + `validate` for DTOs. No `@nestjs/testing` |
| Integration | None new | No persistence boundary is added; the repository path is already covered |
| E2E | `POST /api/v1/notifications` → 201 + id, then `GET :id` returns it; `notificationCreate` mutation equivalently; **parity**: identical payload via both transports yields the same validation outcomes; **dedupe**: repeating either call with the same `(tenantId, dedupeKey)` returns the same id and creates no second row; cross-transport dedupe (REST then GraphQL); invalid/unknown fields rejected (`forbidNonWhitelisted`) | `test/notification-create.e2e-spec.ts` with `app-bootstrap.ts` + `graphql-client.ts`; stub the Discord webhook as in `notification-delivery.e2e-spec.ts` |

## Threat Matrix

N/A — no shell command, subprocess, git/PR automation, executable-file classification, or process-integration boundary is introduced; the only new boundary is two in-process HTTP/GraphQL entry points behind the existing global `ValidationPipe` and `BaseExceptionFilter`. The one real exposure, an unauthenticated public write surface, is recorded as D7 rather than as a matrix row.

## Migration / Rollout

No migration. No schema change, no new dependency, no new env var. The GraphQL schema is code-first (`autoSchemaFile: true`), so `notificationCreate` appears and disappears with the resolver. Rollback = revert the branch; Kafka ingestion, delivery, and the query path are untouched throughout.

## Open Questions

- [ ] Follow-up auth change for synchronous writes (D7) — strategy and timing are owned outside this change.
- [ ] Whether `message` on the GraphQL response should distinguish a dedupe replay (currently no, per D4, because `CreateNotificationResult` cannot tell them apart).
