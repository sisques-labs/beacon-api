# `notifications` bounded context

The first bounded context in this service. It defines the pattern every
subsequent context follows — see `.claude/skills/architecture/SKILL.md`.

`NotificationAggregate` is persistable, ingestible from Kafka, creatable
synchronously over REST and GraphQL, durably delivered to each tenant's own
Discord webhook with retry/backoff, and queryable by id. Every write and read
entry point requires a per-client API key (`x-api-key`), minted by the
`clients` context — see `src/contexts/clients/README.md`.

## Per-client Discord webhooks and API keys (final state)

`openspec/changes/per-client-discord-webhook/design.md` replaced the single
global `DISCORD_WEBHOOK_URL` with a per-tenant, encrypted destination and
per-client API keys. The rollout is complete; there is no service-wide
webhook URL and no unguarded entry point left in this context.

- **Destination registration** — `PUT`/`GET /api/v1/notification-destinations/:channel`
  and the `notificationChannelDestinationRegister`/`FindByChannel` GraphQL
  operations. Each tenant registers and reads only its own Discord webhook;
  see "Destination: per-tenant Discord webhook" below.
- **Notification creation, Kafka ingestion, and `findById`** are all
  key-guarded and tenant-scoped to the authenticated client — see
  "Creation", "Ingestion", and "Query" below. There is no readiness-warning
  phase left: an absent, unknown, or revoked key is a hard `401`
  (REST/GraphQL) or a dropped-with-warning message (Kafka), not a warning
  alongside a still-processed request.
- **Delivery resolves each tenant's own registered destination** at send
  time — see "Delivery" below. `DISCORD_WEBHOOK_URL` no longer exists as an
  env var or a config file; a leftover value in the environment is inert
  (schema validation simply no longer references that key).
- Client keys are minted with the `clients` context's CLI —
  `pnpm client:create --name <n> --tenant-id <existing>` — see
  `src/contexts/clients/README.md` for the full `client:*` command
  reference (create/rotate/revoke/list).
- **Deprecated, compatibility-only fields**: `NotificationCreateRequestDto`
  (REST and GraphQL) and `NotificationIngestDto` (Kafka) still accept an
  optional `tenantId` field for backward compatibility with callers that
  have not migrated off it yet. It is **never** read to determine the
  creation tenant — the authenticated client's own tenant always wins. If a
  caller sends a `tenantId` that disagrees with the authenticated tenant,
  `warnIfTenantIdMismatch` logs a warning (never the API key) and the
  notification is still created under the authenticated tenant. Removing
  these fields entirely is tracked as a separate, future change once every
  caller has migrated to relying solely on the API key.

## Authentication: `ClientApiKeyGuard` + `@CurrentClient()`

- `ClientApiKeyGuard` (`infrastructure/guards/client-api-key.guard.ts`) is a
  class-level guard covering both HTTP and GraphQL execution contexts. It
  reads the `x-api-key` header, authenticates through
  `IClientAuthenticationPort` (dispatched via `QueryBus` to the `clients`
  context — see "Cross-context boundary" below), and sets
  `request.authenticatedClient`. A missing, malformed, unknown, or revoked
  key all collapse to the same fixed-text `UnauthorizedException('Invalid
API key')` — the key itself never reaches an error message or a log call.
- `@CurrentClient()` (`infrastructure/decorators/current-client.decorator.ts`)
  reads `request.authenticatedClient` (`{ clientId, tenantId }`) for
  controllers and resolvers to use as the source of truth for the request's
  tenant.
- `client-api-key-guard.reflection.ts` is a structural safety net: it scans
  every `@Controller`/`@Resolver` class under `notifications/transport/`
  (Kafka consumers and queue processors are out of scope — they authenticate
  independently, see "Ingestion" below) and asserts each one carries
  `@UseGuards(ClientApiKeyGuard)` at the class level.
  `NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST` is kept as an exported `[] as
const` — genuinely empty now that every transport class is guarded — so
  this test fails loudly if a future PR adds an unguarded controller or
  resolver instead of silently allowing it.

### Cross-context boundary: authenticating against `clients`

`notifications` never imports `clients`' domain or application layers
directly. `IClientAuthenticationPort`
(`application/ports/client-authentication.port.ts`) is a port implemented by
`QueryBusClientAuthenticationAdapter`
(`infrastructure/adapters/query-bus-client-authentication.adapter.ts`), which
dispatches `ClientFindByApiKeyQuery` through the shared `QueryBus` and maps
the result to `IAuthenticatedClient | null`. This is the only place
`notifications` reaches into `clients`, and it only ever crosses through the
bus — never a direct service or repository import.

## Domain

- `NotificationAggregate` — fields: `tenantId`, `recipientUserId`, `channel`
  (`DISCORD | EMAIL | PUSH`), `status` (`PENDING | SENT | FAILED | CANCELLED
| READ`), `title`, `body`, `sourceService`, `dedupeKey`, plus terminal
  timestamps (`sentAt`, `readAt`, `cancelledAt`) and `failureReason`. Status
  transitions are enforced by `assertTransition()`.
- `NotificationChannelDestinationAggregate` — keyed by a unique
  `(tenantId, channel)` pair. Holds only an **encrypted envelope**, never
  the plaintext webhook URL; `register()`/`rotate()` emit events carrying no
  envelope field. Constructed via `NotificationChannelDestinationBuilder`
  (no static factories).
- `DiscordWebhookUrlValueObject`
  (`domain/value-objects/discord-webhook-url/`) — SSRF allowlist VO:
  rejects any scheme other than `https:`, userinfo, port, query string, or
  fragment; requires an exact `discord.com`/`discordapp.com` hostname (no
  subdomains, no IP literals, no userinfo host-spoofing); requires the path
  to match `/api/webhooks/{snowflake}/{token}`; and always stores a
  canonical rebuild from the parsed parts, never the raw input. `redacted()`
  returns `discord:webhook/{id}` for safe logging.
- `EncryptedSecretValueObject` — wraps the AES-256-GCM envelope
  (`v{version}:{iv}:{tag}:{ciphertext}`, base64url); never logs its value.
- `NotificationFailureReasonCodeEnum` — `DESTINATION_NOT_CONFIGURED` and
  `DESTINATION_UNREADABLE`, the two fail-closed delivery reasons (see
  "Delivery" below), alongside any pre-existing send-failure reasons.
- Exceptions: `InvalidDiscordWebhookUrlException`,
  `UnsupportedDestinationChannelException` (registration); mapped to `400`
  by `transport/exceptions/notifications-exception.filter.ts`.
  `NonRetryableNotificationDeliveryException` (base),
  `NotificationDestinationNotConfiguredException`,
  `NotificationDestinationUnreadableException` (delivery, see below) — all
  fixed-text, no input echo.

## Persistence

- `infrastructure/persistence/typeorm/entities/notification.entity.ts` — the
  `notifications` table, `UNIQUE (tenantId, dedupeKey)`.
- `infrastructure/persistence/typeorm/entities/notification-channel-destination.entity.ts`
  — the `notification_channel_destinations` table, `UNIQUE (tenantId,
channel)`. The read repository selects metadata columns only and never
  the encrypted envelope column; `save()` is a metadata-only update.
- `NotificationTypeormWriteRepository` — `save()` is an id-based upsert used
  by the genuine-create path (`CreateNotificationCommandHandler`).
  `updateIfExists(entity)` issues one atomic `UPDATE ... WHERE id = :id` and
  returns whether a row was actually affected — used exclusively by
  `DeliverNotificationCommandHandler`'s terminal-state persistence, which by
  definition only ever updates a row it already asserted exists. This
  avoids a check-then-act race where a stale in-flight delivery job's
  `save()` could resurrect a row deleted between the existence check and
  the write (observed in this context's own e2e suite as flaky row-count
  assertions before the fix).
- `NotificationTypeormReadRepository` /
  `NotificationChannelDestinationTypeormReadRepository` — read-side
  projections.

## Ingestion: Kafka notification-request consumer

- `NotificationIngestConsumer` (`transport/kafka/consumers/`) authenticates
  via `IClientAuthenticationPort` using the `x-api-key` message header
  **before** any body parsing or DTO validation — the header is independent
  of the body, so this is both the cheapest and the safest-first check. A
  missing, unknown, or revoked key is dropped with a warning (never the
  key itself, never a DLQ). An infrastructure failure from the port (for
  example the client store being unavailable) is not caught here — it
  propagates so the message is never silently treated as processed.
- **Known kit limitation — offset commits regardless of a rethrow.**
  `@sisques-labs/nestjs-kit`'s `InboundConsumerBootstrapService.dispatch()`
  wraps every handler call in its own try/catch and never rethrows to
  kafkajs, so the `eachMessage` promise kafkajs sees always resolves and the
  offset is committed whether or not this consumer's handler throws.
  Rethrowing an infrastructure error here is still the closest safe
  behavior available at this layer (it reaches the kit's `error`-level
  `handleError` path, distinct from this consumer's own `warn`-level
  drop-and-continue for auth rejections, so an operator watching `error`
  logs or with `errorHandler.onHandlerError` wired can page on it) — but
  the message is not redelivered by the broker after an infra failure. This
  is a pre-existing kit architecture limitation, not specific to
  authentication, and applies identically to every other error path in this
  consumer (malformed JSON, failed validation). Tracked as a possible
  future defect report against `@sisques-labs/nestjs-kit`, out of this
  context's scope to fix.
- Only `channel: DISCORD` is accepted for creation; `EMAIL` and `PUSH`
  events are valid shape but logged as unsupported and skipped.
- The event payload has **no deliverable-address field** — a Discord
  webhook URL is never event data (SSRF mitigation for this topic, whose
  authentication is per-client rather than per-message-origin). A
  caller-supplied `deliverableAddress`, if present, is logged and ignored.
- `NotificationIngestDto.tenantId` is optional/deprecated (see "Per-client
  Discord webhooks and API keys" above) — a mismatch against the
  authenticated tenant logs a warning; the notification is still created
  under the authenticated tenant.
- `CreateNotificationCommand` / `CreateNotificationCommandHandler`
  (`application/commands/create-notification/`) — dispatched by the
  consumer. Idempotent on `(tenantId, dedupeKey)`.

## Creation: synchronous REST and GraphQL

Two thin transport adapters dispatch the same `CreateNotificationCommand` /
`CreateNotificationCommandHandler` used by Kafka ingestion above — creation
semantics (validation, dedupe-idempotency) stay single-sourced in the
application layer regardless of entry point.

- **REST**: `POST /api/v1/notifications` (`NotificationController.create`,
  class-level `@UseGuards(ClientApiKeyGuard)`) — the creation tenant is
  `@CurrentClient().tenantId`, never `dto.tenantId`.
- **GraphQL**: `mutation { notificationCreate(input: { ... }) { success id
message } }` (`NotificationMutationsResolver`, same guard, same tenant
  source).
- **DISCORD-only on the write path**: both DTOs constrain `channel` to
  `DISCORD`, rejecting `EMAIL`/`PUSH` with a `400` (REST) or a GraphQL
  validation error.
- **Dedupe-idempotent on both transports**: repeating either call with the
  same `(tenantId, dedupeKey)` creates no second notification.
- E2E coverage: `test/notification-create.e2e-spec.ts` — happy path on both
  transports, dedupe replay, invalid input, `401` on missing/unknown/revoked
  key, and the body-`tenantId`-mismatch-still-creates-under-the-authenticated-tenant
  case.

## Destination: per-tenant Discord webhook

- `RegisterNotificationChannelDestinationCommand` /
  `…Handler` (`application/commands/register-notification-channel-destination/`)
  — validates the URL via `DiscordWebhookUrlValueObject`, encrypts it
  through `ISecretCipherPort` with AAD
  `notifications:channel-destination:{tenantId}:{channel}`, and
  creates-or-rotates the aggregate. A Postgres unique violation (`23505`) on
  the first insert is retried once (concurrent-registration race).
- `NotificationChannelDestinationFindByTenantAndChannelQuery` — returns
  metadata only (`configured: true/false`), never the envelope or the
  plaintext URL.
- **REST**: `PUT`/`GET /api/v1/notification-destinations/:channel`
  (`NotificationChannelDestinationController`, class-level
  `@UseGuards(ClientApiKeyGuard)`) — no `:tenantId` in either route; the
  target tenant is always `@CurrentClient().tenantId`.
- **GraphQL**: `notificationChannelDestinationRegister(input: { channel,
webhookUrl })` / `notificationChannelDestinationFindByChannel(input: {
channel })` — same guard, same tenant source.
- E2E coverage: `test/notification-channel-destination.e2e-spec.ts` — `401`
  on missing/unknown/revoked key, `200` register/read, `EMAIL` channel
  rejected with `400`, SSRF-invalid URLs rejected with `400`, and the
  response body never contains the URL.

## Delivery: durable, retrying, per-tenant Discord webhook

Delivery is decoupled from ingestion twice over: creation publishes an
in-process domain event, and that event handler enqueues a durable,
Redis-backed job instead of dispatching the delivery command directly, so a
transient webhook failure or a mid-delivery process crash never leaves a
notification permanently `PENDING`.

- `DeliverNotificationOnCreatedHandler` (`application/events/`) enqueues via
  `INotificationDeliveryQueuePort` — asynchronous by design, ingestion never
  awaits delivery. The job payload is `{ notificationId }` only; no
  notification content or destination ever reaches Redis.
- `NotificationDeliveryProcessor` (`transport/queue/processors/`) consumes
  the queue, derives `isFinalAttempt`, and dispatches
  `DeliverNotificationCommand` through `CommandBus`. It catches
  `NonRetryableNotificationDeliveryException` and converts it to a BullMQ
  `UnrecoverableError`, so a fail-closed delivery never retries; any other
  error rethrows unchanged for BullMQ's normal retry/backoff.
- `DeliverNotificationCommandHandler`
  (`application/commands/deliver-notification/`) — loads the aggregate,
  guards against a duplicate send (if the aggregate is no longer `PENDING`,
  logs and returns), then resolves the destination **before** attempting
  any send:
  - **No destination registered** for `(tenantId, channel)` → `fail closed`:
    `aggregate.fail('DESTINATION_NOT_CONFIGURED')`, persisted via
    `updateIfExists()`, and a `NonRetryableNotificationDeliveryException` is
    thrown — no HTTP call is ever attempted, on the very first attempt.
    `EMAIL` and `PUSH` always resolve to no destination (only `DISCORD` is
    registrable in v1), so they always fail closed the same way.
  - **A registered destination that cannot be decrypted or re-validated**
    (tampered ciphertext, wrong encryption key or key version, an AAD
    mismatch, or a decrypted value that no longer passes
    `DiscordWebhookUrlValueObject`) → fail closed the same way with
    `DESTINATION_UNREADABLE`. The raw decrypt/validation error is
    deliberately discarded, never logged — no ciphertext or decrypted URL
    fragment can reach a log line through this path.
  - **A resolved destination** → `senderPort.send(primitives, destination)`.
    On success: `aggregate.sent()` + `updateIfExists()` + publish. On a
    transport-level send failure: throws so BullMQ retries — only on
    `isFinalAttempt` does it first persist `FAILED` with the send failure
    reason, then still throws so the job also lands in BullMQ's failed set.
  - Both fail-closed reasons are terminal on the very first attempt,
    independent of `isFinalAttempt` — retrying a missing or undecryptable
    destination cannot heal within any backoff window.
- `ResolveNotificationDeliveryDestinationService`
  (`application/services/write/resolve-notification-delivery-destination/`)
  — looks up the registered destination, decrypts it with the same AAD used
  at registration, and re-validates it through
  `DiscordWebhookUrlValueObject`. Returns `undefined` when nothing is
  registered; throws unwrapped on any decrypt/AAD/re-validation failure for
  the handler above to catch and translate; never logs anything itself.
- `DiscordWebhookNotificationSenderAdapter`
  (`infrastructure/adapters/`) — posts to `destination.url` (never a
  config-sourced URL — there is no `DISCORD_WEBHOOK_URL` or
  `discord.config.ts` anymore) with `{ maxRedirects: 0, timeout: 10000 }`.
  Every log line interpolates only `destination.logLabel`
  (`DiscordWebhookUrlValueObject.redacted()`), never the URL itself.
- **Retry policy** (transport-level send failures only — fail-closed
  reasons above never retry) — `attempts: 5`, exponential backoff starting
  at `5000`ms, both env-tunable via `notificationDeliveryQueueConfig`
  (`infrastructure/config/notification-delivery-queue.config.ts`):
  - `NOTIFICATION_DELIVERY_QUEUE_NAME` (default `notification-delivery`)
  - `NOTIFICATION_DELIVERY_QUEUE_ATTEMPTS` (default `5`)
  - `NOTIFICATION_DELIVERY_QUEUE_BACKOFF_MS` (default `5000`)
- Requires Redis — see `src/core/README.md` for connection config and the
  readiness health check. Requires `SECRETS_ENCRYPTION_KEY` (base64,
  decodes to exactly 32 bytes) and optionally
  `SECRETS_ENCRYPTION_KEY_VERSION` — see `src/core/README.md`'s crypto
  section.
- E2E coverage: `test/notification-delivery.e2e-spec.ts` — successful
  delivery to the tenant's own registered URL, transient-failure retry,
  exhausted-retry `FAILED`, crash-and-restart durability,
  `DESTINATION_NOT_CONFIGURED` with zero HTTP calls, and
  `DESTINATION_UNREADABLE` (tampered ciphertext) with zero HTTP calls and no
  ciphertext in any log call.

## Query: get notification by id

- `NotificationFindByIdQuery` / `NotificationFindByIdHandler` — tenant-scoped:
  the query takes `tenantId`, and the handler compares it against the
  loaded view model's own `tenantId`. A cross-tenant read and a genuinely
  nonexistent id both throw the identical `NotificationNotFoundException` —
  never a distinct `403`, so a caller cannot distinguish "not yours" from
  "does not exist".
- **REST**: `GET /api/v1/notifications/:id` (`NotificationController`,
  same class-level guard as creation) — `404` on an unknown or cross-tenant
  id.
- **GraphQL**: `query { notificationFindById(input: { id: "..." }) { ... }
}` (`NotificationQueriesResolver`, class-level `@UseGuards(ClientApiKeyGuard)`)
  — same not-found semantics as REST, surfaced as a GraphQL error.
- E2E coverage: `test/notification-find-by-id.e2e-spec.ts` — `401` on
  missing/unknown/revoked key, cross-tenant `404` (never `403`), and a
  nonexistent id producing the same error shape as a cross-tenant read.

## Out of scope for this context (v1)

- Exactly-once delivery — at-least-once is accepted; the duplicate-send
  guard closes the observable duplicate window (a concurrently-succeeded or
  stalled-job-redelivered attempt), but a true partial-success window
  (Discord accepted the POST, the response was lost) stays open since
  Discord webhooks expose no idempotency key.
- Email and Push channels — no sender/adapter exists for them; they always
  fail closed with `DESTINATION_NOT_CONFIGURED`.
- Removing the deprecated `tenantId` fields from the creation/ingest DTOs —
  tracked as a separate future change once every caller relies solely on
  the API key.
- `findByCriteria` GraphQL boilerplate (queryable-field enum, filterable
  registry, filter/sort inputs) — the repositories implement
  `findByCriteria` for interface conformance only; no transport exposes it
  yet.
