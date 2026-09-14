# Changelog

All notable changes to this project will be documented in this file.
## [0.0.1] - 2026-09-14

### Bug Fixes
- **notifications:** Remove unused DateValueObject import (b93384e)
- **config:** Avoid migration double-load race under test (4f5a279)
- **notifications:** Register AssertNotificationAggregateExistsService and fix its test (3e71b48)
- **notifications:** Log and rethrow enqueue failures instead of losing them (989a8da)
- **notifications:** Retry delivery instead of failing on first error (8d5ada9)
- **notifications:** Update e2e assertion for delivery retry behavior (32dbe8f)

### Chore
- Rename project from 'nestjs-template' to 'beacon-api' across all relevant files, including configuration, documentation, and environment settings. (c2d2b1c)
- **env:** Update .env.example with Kafka ingestion and Discord webhook configuration (aa5ba50)
- **notifications:** Remove unused imports in DeliverNotificationCommandHandler (b7257f2)
- **sdd:** Archive notification-delivery-decoupling change and sync specs (4298d18)
- **sdd:** Archive beacon-mvp change and sync specs (486a7f1)
- **sdd:** Archive notification-creation-rest-graphql change (f337b3b)

### Documentation
- **sdd:** Add beacon-mvp SDD change artifacts (8f40d5e)
- **notifications:** Document Discord delivery and complete beacon-mvp tasks (3d2249e)
- **sdd:** Add verify report for notification-delivery-decoupling (e8a4882)
- **architecture:** Document REST controllers/mappers convention (a9cf033)
- **sdd:** Add notification-creation-rest-graphql change artifacts (0440bbe)

### Features
- **notifications:** Add domain-only Notification aggregate (b92c15e)
- **notifications:** Add TypeORM persistence for the notification aggregate (17a89f5)
- **notifications:** Add get-by-id query with REST and GraphQL transports (5e345fa)
- **notifications:** Register NotificationsModule and add context README (8b1c819)
- **core:** Add Kafka ingestion config independent from the outbound forwarder (675a29f)
- **notifications:** Add idempotent CreateNotificationCommand (dd010e1)
- **notifications:** Add kafkajs notification-request consumer (b6eba7c)
- **core:** Add Discord webhook config for outbound delivery (02e0c2a)
- **notifications:** Add Discord webhook sender port and adapter (d4ea8ad)
- **notifications:** Dispatch Discord delivery on notification creation (085322b)
- **notifications:** Migrate Kafka ingestion to kit's declarative inbound consumer (1a79176)
- **core:** Add required Redis dependency with readiness health check (075b90d)
- **config:** Add Redis configuration for BullMQ notification delivery (f017609)
- **notifications:** Add durable delivery-queue port and BullMQ adapter (6c98e95)
- **notifications:** Add REST notification creation endpoint (e22ebfa)
- **notifications:** Add GraphQL notificationCreate mutation (e4f76f0)

### Refactor
- **notifications:** Use kit UuidValueObject for aggregate id (91c9910)
- **notifications:** Extend INotification interface from IBaseAggregate (3158ccd)
- **notifications:** Align GraphQL transport layer with gardenia-api conventions (71abad4)
- **notifications:** Remove unused GraphQL artifacts and clean up module imports (c76ccf1)
- **notifications:** Simplify CreateNotificationCommandInput using INotificationPrimitives (8a10fb3)
- **notifications:** Update import paths for AssertNotificationViewModelExistsService (104083d)
- **notifications:** Integrate FindNotificationByDedupeKeyService into CreateNotificationCommandHandler (2bf4adf)
- **notifications:** Replace EventPublisher with EventBus in CreateNotificationCommandHandler (7459352)
- **notifications:** Move Discord config into context, use nestjs axios (ad6c517)
- **notifications:** Enhance DeliverNotificationCommandHandler and add existence check service (b635c25)
- **notifications:** Move REST create response mapping into a dedicated mapper (9149d56)

### Testing
- **notifications:** Add integration and e2e coverage for Phase 1 (c12ee87)
- **notifications:** Add Kafka ingestion e2e coverage and update docs (ea5156f)
- **notifications:** Add Discord delivery e2e coverage (0601e6a)
- **notifications:** Fix stale spec content for AssertNotificationAggregateExistsService (629745d)
- **notifications:** Rework delivery e2e for the durable retry queue (38ade48)
- **notifications:** Add cross-transport E2E coverage and README for creation (e97aef2)

