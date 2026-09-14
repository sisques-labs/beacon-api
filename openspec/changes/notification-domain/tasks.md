## 1. Domain foundation (enums, primitives, interface, VOs)

- [x] 1.1 Add `notification-channel.enum.ts` (`EMAIL` | `PUSH` | `DISCORD`) and `notification-status.enum.ts` (`PENDING` | `SENT` | `FAILED` | `CANCELLED` | `READ`) under `domain/enums/` — verify files export the enums
- [x] 1.2 Add `notification.primitives.ts` and `notification.interface.ts` (all aggregate fields as VOs on the interface; primitives hold raw values including mandatory `dedupeKey`) — verify TypeScript compiles for these files
- [x] 1.3 Add value objects: `notification-channel`, `notification-status`, `notification-title`, `notification-body`, `notification-dedupe-key`, `notification-source-service`, `notification-failure-reason`, plus date VOs for `sent-at` / `read-at` / `cancelled-at` as needed; use kit `UuidValueObject` for id (no domain-specific id VO) — verify VO unit specs cover invalid channel/status and empty title/body/dedupeKey/sourceService

## 2. Events and exceptions

- [x] 2.1 Add `domain/events/interfaces/notification-event-data.interface.ts` and lifecycle events: `notification-created`, `notification-sent`, `notification-failed`, `notification-cancelled`, `notification-read` — verify each event extends `BaseEvent` with the shared/event-specific data shape
- [x] 2.2 Add `invalid-notification-status-transition.exception.ts` (and `notification-not-found.exception.ts` for later application use) extending kit `BaseException` — verify exceptions construct with a clear message/code

## 3. Aggregate, builder, view-model, repository ports

- [x] 3.1 Implement `NotificationAggregate` (constructor hydration only; methods `create`, `sent`, `fail`, `cancel`, `read`, `toPrimitives`) — verify `notification.aggregate.spec.ts` covers happy paths and illegal transitions per the status machine
- [x] 3.2 Implement `NotificationBuilder` (`build` / `buildViewModel` / `validate` requiring tenantId, recipientUserId, channel, title, body, sourceService, dedupeKey) — verify `notification.builder.spec.ts` rejects missing required fields including empty dedupeKey
- [x] 3.3 Add `NotificationViewModel` and read/write repository ports (`NOTIFICATION_READ_REPOSITORY` / `NOTIFICATION_WRITE_REPOSITORY` extending kit base interfaces) — verify ports type-check against aggregate and view-model

## 4. Verification

- [x] 4.1 Run `pnpm test` filtered to `src/contexts/notifications` (or equivalent path) and confirm all new unit specs pass
- [x] 4.2 Confirm no Nest module, application, infrastructure, transport, or migration files were added in this change
