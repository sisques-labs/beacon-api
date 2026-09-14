# Design: Beacon MVP — Kafka-ingested Discord notification delivery

## Technical Approach

Four layers on the existing domain-only `notifications` context, no aggregate or status-machine change. A `kafkajs` consumer (`transport/kafka/`) validates an ingress DTO and dispatches `CreateNotificationCommand`. Its handler persists a `PENDING` aggregate via TypeORM; `NotificationCreatedEvent` (already emitted by `aggregate.create()`) triggers an in-process `@EventsHandler` that dispatches `DeliverNotificationCommand`, so ingestion never awaits Discord. Delivery goes through `INotificationSenderPort` (`application/ports/`) implemented by a Discord webhook adapter, then drives `sent()` / `fail(reason)`. Get-by-id is exposed on both REST and GraphQL.

## Architecture Decisions

| # | Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|---|
| D1 | Inbound Kafka mechanism | Raw `kafkajs` consumer as an `@Injectable()` provider implementing `OnModuleInit` / `OnApplicationShutdown` | `@nestjs/microservices` Kafka transport; kit `MessagingModule` | `kafkajs@2.2.4` is already a direct dependency; `@nestjs/microservices` is **not** installed and would additionally require `connectMicroservice()` + `startAllMicroservices()` in `main.ts` and reply-topic semantics unwanted for fire-and-forget. **Verification gap**: `node_modules` is not installed in this workspace, so the kit's `messaging` exports could not be inspected; repo docs and `core.module.ts` show `MessagingModule.forRoot({ aggregateModuleMap })` as outbound-only. If install later reveals an inbound kit primitive, prefer it — the consumer is one file behind the CommandBus. |
| D2 | Delivery trigger | `@EventsHandler(NotificationCreatedEvent)` → dispatch `DeliverNotificationCommand` | Inline `await sender.send()` in the create handler; second dispatch from the consumer | Keeps async (decision 3) and keeps the consumer a thin dispatcher. The duplicate path never calls `create()`, so no second event and no second Discord message — dedupe falls out for free. |
| D3 | Discord address source | Webhook URL from config (`DISCORD_WEBHOOK_URL`), not from the ingress payload | Carry the address per message | v1 has **no auth** on the topic; accepting a caller-supplied URL would be an SSRF sink for any topic producer. Config also sidesteps persisting an address the aggregate has no field for. Ingress `deliverableAddress`, if present, is ignored for `DISCORD` and logged. |
| D4 | `findByDedupeKey` owner | **Write** port `INotificationWriteRepository`, returning `NotificationAggregate \| null` | Read port (ViewModel) | Lookup-before-write is a command-side consistency concern; the read port stays a pure query projection. Additive only. |
| D5 | Dedupe enforcement | DB unique index `(tenant_id, dedupe_key)` is authoritative; TypeORM write repo translates Postgres `23505` into a new `NotificationDedupeKeyAlreadyExistsException`; the handler catches it, re-reads via `findByDedupeKey`, returns the existing id | Pre-check only; leak `QueryFailedError` into application | Pre-check alone races under concurrent partitions. Translating the driver error in infrastructure keeps application/domain free of Postgres codes. **Second additive domain file** beyond decision 7 — flagged, still non-breaking. |
| D6 | Port/adapter for a third-party | Reuse `application/ports/` + `infrastructure/adapters/` for the external sender | New `infrastructure/providers/` subtree | The architecture skill documents this pair only for cross-context calls; this design **explicitly extends it** to external dependencies — same inversion, and Email/Push drop in behind the same port. |
| D7 | Ingress validation | `class-validator` DTO validated manually (`plainToInstance` + `validateOrReject`) in the consumer; invalid → log + commit offset | Global `ValidationPipe` | The global pipe only covers HTTP/GraphQL, never a raw kafkajs handler. Committing the offset on malformed input prevents a poison-message crash loop. |

## Data Flow

```
Kafka topic ──► NotificationIngestConsumer ──► CommandBus
                (validate DTO)                    │
                                                  ▼
                                    CreateNotificationCommandHandler
                                      │ findByDedupeKey ──► exists? return id
                                      │ builder.build() + create()
                                      ▼ write repo .save()  [PENDING]
                                    NotificationCreatedEvent (in-process)
                                      ▼
                                    DeliverNotificationOnCreatedHandler ──► CommandBus
                                      ▼
                                    DeliverNotificationCommandHandler
                                      │ load aggregate
                                      ├─ INotificationSenderPort.send() ──► Discord webhook (HTTP POST)
                                      │      ok  → aggregate.sent()   [SENT]
                                      │      err → aggregate.fail(r)  [FAILED]
                                      ▼ write repo .save()

REST GET /api/v1/notifications/:id ─┐
GraphQL query notificationFindById ─┴► QueryBus ► NotificationFindByIdHandler ► read repo ► ViewModel
```

## File Changes

| Path (under `src/contexts/notifications/`) | Action | Description |
|---|---|---|
| `domain/repositories/write/notification-write.repository.ts` | Modify | Additive `findByDedupeKey(tenantId, dedupeKey)` |
| `domain/exceptions/notification-dedupe-key-already-exists.exception.ts` | Create | Raised by the write repo on `23505` |
| `application/commands/create-notification/{command,handler}.ts` | Create | Idempotent create |
| `application/commands/deliver-notification/{command,handler}.ts` | Create | Sender call + status transition |
| `application/events/deliver-notification-on-created.handler.ts` | Create | `@EventsHandler(NotificationCreatedEvent)` |
| `application/queries/notification-find-by-id/{query,handler}.ts` | Create | Get-by-id |
| `application/services/read/assert-notification-view-model-exists.service.ts` | Create | Throws `NotificationNotFoundException` |
| `application/ports/notification-sender.port.ts` (+ `notification-send-result.interface.ts`) | Create | One type per file |
| `infrastructure/adapters/discord-webhook-notification-sender.adapter.ts` | Create | HTTP POST, logs start/completion |
| `infrastructure/persistence/typeorm/entities/notification.entity.ts` | Create | `@Unique(['tenantId','dedupeKey'])`, `dedupe_key varchar(255)`, `body varchar(5000)` |
| `.../mappers/notification-typeorm.mapper.ts` | Create | Entity ↔ aggregate via `NotificationBuilder` |
| `.../repositories/notification-typeorm-{read,write}.repository.ts` | Create | Implement domain ports (no `findByCriteria` in v1) |
| `transport/kafka/consumers/notification-ingest.consumer.ts` + `dtos/notification-ingest.dto.ts` | Create | D1, D7 |
| `transport/rest/notification.controller.ts` + `dtos/` | Create | `GET /notifications/:id` |
| `transport/graphql/{resolvers,objects,mappers,enums}/` | Create | `notificationFindById` |
| `notifications.module.ts`, `README.md` | Create | Named provider const arrays per `config.yaml` |
| `src/contexts/contexts.module.ts` | Modify | Add `NotificationsModule` to `CONTEXT_MODULES` |
| `src/core/config/{kafka-ingest,discord}.config.ts`, `env.validation.ts`, `core.module.ts`, `.env.example` | Create/Modify | `KAFKA_INGEST_{ENABLED,TOPIC,GROUP_ID}` (broker/SSL/SASL reused from `kafka`), `DISCORD_WEBHOOK_URL` |
| `src/database/migrations/{ts}-create-notifications.ts` | Create | First migration; `down` drops table + index |
| `test/helpers/integration-bootstrap.ts` | Create | First context needs it |

Ingest and the outbound forwarder use **separate** flags: `KAFKA_INGEST_ENABLED` on, `KAFKA_ENABLED` stays off (decision 5).

## Interfaces / Contracts

```ts
export interface INotificationSenderPort {
  send(notification: INotificationPrimitives): Promise<INotificationSendResult>;
}
export const NOTIFICATION_SENDER_PORT = Symbol('NOTIFICATION_SENDER_PORT');
```

Ingress payload: `{ tenantId, recipientUserId, channel, title, body, sourceService, dedupeKey }` — all required strings; `channel` must be `DISCORD` in v1 (others logged and skipped).

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Handlers, mapper, consumer parsing, adapter, assert service | `Mocked<T>`, manual instantiation, no `@nestjs/testing` |
| Integration | Repos + unique-index race, `findByDedupeKey`, mapper round-trip | Real Postgres, slim bootstrap |
| E2E | REST + GraphQL get-by-id; ingest→delivery with a stubbed sender port | `AppModule`, supertest |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The two real boundaries (unauthenticated ingress, outbound webhook URL) are handled by D3 and D7; the unauthenticated-topic risk remains an explicitly accepted v1 tradeoff, mitigated only by broker ACLs.

## Migration / Rollout

One TypeORM migration creates `notifications` plus the unique index; `down` drops both. No data backfill. Roll out with `KAFKA_INGEST_ENABLED=false` first, then enable once the topic contract is live.

## Open Questions

- [ ] Confirm D1 against the installed kit once `pnpm install` runs — swap to a kit inbound primitive if one exists.
- [ ] Ingress topic name and payload contract must be agreed with the producing app (Gardenia) before enabling.
