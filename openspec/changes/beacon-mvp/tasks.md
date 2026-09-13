# Tasks: Beacon MVP — Kafka-ingested Discord Notification Delivery

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900-1300 total; PR1 ~450-600, PR2 ~250-350, PR3 ~200-300 |
| 400-line budget risk (overall) | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (→ develop) → PR 2 (→ PR1 branch) → PR 3 (→ PR2 branch) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (base branch is `develop`, not `main`) |

Overall:
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

PR1 (Persistence + Query):
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

PR2 (Ingestion + Create):
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

PR3 (Discord Delivery):
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Persistence (entity/mapper/repos/migration) + additive dedupe port/exception + get-by-id (REST+GraphQL) | PR 1 → `develop` | `pnpm test -- notification-typeorm` | `pnpm test:e2e -- notification` (REST+GraphQL vs test DB) | Revert PR1 branch + migration `down`; no dependents exist yet |
| 2 | Kafka consumer + `CreateNotificationCommand` idempotent create | PR 2 → PR1 branch | `pnpm test -- create-notification` | `pnpm test:e2e -- notification-ingest` (stubbed sender) | Revert PR2 branch, set `KAFKA_INGEST_ENABLED=false`; PR1 persistence/query unaffected |
| 3 | Discord sender port/adapter + delivery command/event handler | PR 3 → PR2 branch | `pnpm test -- deliver-notification` | `pnpm test:e2e -- notification-delivery` (stubbed HTTP) | Revert PR3 branch; ingestion keeps persisting `PENDING`, only delivery path removed |

Apply project `testing.strict_tdd: true`: write each unit's co-located `.spec.ts` failing first, then implement to green, per task below.

## Phase 1: Persistence + Get-by-id Query (PR 1 → `develop`)

- [x] 1.1 `domain/repositories/write/notification-write.repository.ts`: add `findByDedupeKey(tenantId, dedupeKey): Promise<NotificationAggregate | null>`.
- [x] 1.2 `domain/exceptions/notification-dedupe-key-already-exists.exception.ts` (+ spec): new exception.
- [x] 1.3 `infrastructure/persistence/typeorm/entities/notification.entity.ts`: entity, `@Unique(['tenantId','dedupeKey'])`.
- [x] 1.4 `infrastructure/persistence/typeorm/mappers/notification-typeorm.mapper.ts` (+ spec): entity ↔ aggregate via `NotificationBuilder`.
- [x] 1.5 `.../repositories/notification-typeorm-write.repository.ts` (+ spec): implement write port, `findByDedupeKey`, translate PG `23505`.
- [x] 1.6 `.../repositories/notification-typeorm-read.repository.ts` (+ spec): implement read port, `findById`.
- [x] 1.7 `src/database/migrations/{ts}-create-notifications.ts`: create table + unique index; `down` drops both.
- [x] 1.8 `application/services/read/assert-notification-view-model-exists.service.ts` (+ spec): throw `NotificationNotFoundException`.
- [x] 1.9 `application/queries/notification-find-by-id/{query,handler}.ts` (+ spec): get-by-id via read repo.
- [x] 1.10 `transport/rest/notification.controller.ts` + `dtos/` (+ e2e): `GET /notifications/:id`. E2E in `test/notification-find-by-id.e2e-spec.ts`.
- [x] 1.11 `transport/graphql/{resolvers,objects,mappers,enums}/`: `notificationFindById` query (+ e2e in the same `test/notification-find-by-id.e2e-spec.ts`).
- [x] 1.12 `test/helpers/integration-bootstrap.ts`: slim Postgres bootstrap (first context needing one). Already scaffolded generically; wired `TEST_MIGRATIONS` (test-data-source.ts) and `TRUNCATE_TABLES` (db-reset.ts) for `notifications`.
- [x] 1.13 `notifications.module.ts` + `README.md`: named provider arrays, context docs.
- [x] 1.14 `src/contexts/contexts.module.ts`: add `NotificationsModule` to `CONTEXT_MODULES`.
- [x] 1.15 `test/integration/`: repo round-trip, unique-index race, `findByDedupeKey`. See `test/integration/notifications/notification-typeorm-repositories.integration-spec.ts`.

## Phase 2: Kafka Ingestion + Create (PR 2 → PR1 branch)

- [x] 2.1 `src/core/config/kafka-ingest.config.ts` (+ spec): `KAFKA_INGEST_{ENABLED,TOPIC,GROUP_ID}`.
- [x] 2.2 `src/core/config/env.validation.ts`: extend schema with `KAFKA_INGEST_*`.
- [x] 2.3 `src/core/core.module.ts`, `.env.example`: register config, document vars. `.env.example` could not be edited (blocked by tool permission settings on dotenv files); `core.module.ts` registration done.
- [x] 2.4 `application/commands/create-notification/{command,handler}.ts` (+ spec): idempotent create via `findByDedupeKey`.
- [x] 2.5 `transport/kafka/dtos/notification-ingest.dto.ts` (+ spec): `class-validator` DTO.
- [x] 2.6 `transport/kafka/consumers/notification-ingest.consumer.ts` (+ spec): `kafkajs` consumer, `OnModuleInit`/`OnApplicationShutdown`, validate + dispatch, log-and-skip malformed/EMAIL/PUSH.
- [x] 2.7 `notifications.module.ts`: register consumer + command handler in provider arrays.
- [x] 2.8 `test/*.e2e-spec.ts`: ingest→persist with stubbed sender (dedupe no-op, EMAIL/PUSH skip, malformed skip). See `test/notification-ingest.e2e-spec.ts`.

## Phase 3: Discord Delivery (PR 3 → PR2 branch)

- [x] 3.1 `application/ports/notification-sender.port.ts` + `notification-send-result.interface.ts`: define `INotificationSenderPort`.
- [x] 3.2 `src/core/config/discord.config.ts` (+ spec), `env.validation.ts`, `.env.example`: `DISCORD_WEBHOOK_URL`. `.env.example` could not be edited (tool sandbox denies access to any `.env*` file, same limitation as Phase 2).
- [x] 3.3 `infrastructure/adapters/discord-webhook-notification-sender.adapter.ts` (+ spec): HTTP POST, log start/completion.
- [x] 3.4 `application/commands/deliver-notification/{command,handler}.ts` (+ spec): sender call, `sent()`/`fail()` transitions.
- [x] 3.5 `application/events/deliver-notification-on-created.handler.ts` (+ spec): `@EventsHandler(NotificationCreatedEvent)` dispatches `DeliverNotificationCommand`.
- [x] 3.6 `notifications.module.ts`: register adapter, sender port token, command + event handlers.
- [x] 3.7 `test/*.e2e-spec.ts`: ingest→delivery success (`SENT`) and failure (`FAILED` + `failureReason`) with stubbed HTTP. See `test/notification-delivery.e2e-spec.ts`.
- [x] 3.8 `README.md`: update to reflect final ingest→create→deliver→query context state.
