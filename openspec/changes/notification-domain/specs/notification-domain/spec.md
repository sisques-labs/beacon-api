## Purpose

Defines the domain behavior of a platform notification: identity, tenancy, recipient, channel, content, mandatory dedupe key, and allowed status transitions with domain events — independent of persistence and delivery providers.

## ADDED Requirements

### Requirement: Notification identity and required attributes
The system MUST represent a notification with a unique id, a platform `tenantId`, a `recipientUserId`, a `channel`, a `status`, a `title`, a `body`, a `sourceService`, and a non-empty `dedupeKey`. Timestamps for creation and last update MUST be present. Optional timestamps `sentAt`, `readAt`, `cancelledAt`, and optional `failureReason` MUST be absent until the corresponding transition occurs.

#### Scenario: Notification created with required attributes
- **WHEN** a notification is created with id, tenantId, recipientUserId, channel, title, body, sourceService, and dedupeKey
- **THEN** its status MUST be `PENDING` and sentAt, readAt, cancelledAt, and failureReason MUST be null

#### Scenario: Dedupe key is mandatory
- **WHEN** a notification is built without a non-empty dedupeKey
- **THEN** the domain MUST reject the build (required-field failure)

### Requirement: Supported channels
The system MUST support notification channels `EMAIL`, `PUSH`, and `DISCORD`. An unsupported channel value MUST be rejected by the domain.

#### Scenario: Valid channel accepted
- **WHEN** a notification is created with channel `EMAIL`, `PUSH`, or `DISCORD`
- **THEN** the domain MUST accept the channel

#### Scenario: Invalid channel rejected
- **WHEN** a notification is created with a channel value outside `EMAIL`, `PUSH`, `DISCORD`
- **THEN** the domain MUST reject the channel

### Requirement: Status lifecycle transitions
The system MUST enforce the following status transitions and no others:
- From `PENDING`: `sent` → `SENT`, `fail` → `FAILED`, `cancel` → `CANCELLED`
- From `SENT`: `read` → `READ`
Terminal or disallowed transitions MUST raise a domain exception and MUST NOT change state or emit a success event.

#### Scenario: Pending notification marked sent
- **WHEN** a `PENDING` notification is marked sent
- **THEN** status MUST become `SENT`, `sentAt` MUST be set, and a sent domain event MUST be emitted

#### Scenario: Pending notification marked failed
- **WHEN** a `PENDING` notification is marked failed with a failure reason
- **THEN** status MUST become `FAILED`, `failureReason` MUST be set, and a failed domain event MUST be emitted

#### Scenario: Pending notification cancelled
- **WHEN** a `PENDING` notification is cancelled
- **THEN** status MUST become `CANCELLED`, `cancelledAt` MUST be set, and a cancelled domain event MUST be emitted

#### Scenario: Sent notification marked read
- **WHEN** a `SENT` notification is marked read
- **THEN** status MUST become `READ`, `readAt` MUST be set, and a read domain event MUST be emitted

#### Scenario: Illegal transition rejected
- **WHEN** a transition is attempted that is not allowed for the current status (e.g. `read` on `PENDING`, `sent` on `FAILED`, `cancel` on `SENT`)
- **THEN** the domain MUST raise an invalid-status-transition exception and leave the notification unchanged

### Requirement: Creation emits a domain event
Creating a notification MUST emit a created domain event whose payload includes the notification’s primitive snapshot (including status `PENDING`).

#### Scenario: Create emits created event
- **WHEN** `create` is invoked on a newly built notification
- **THEN** a created domain event MUST be applied with the notification primitives

### Requirement: Repository ports exist without persistence
The domain MUST expose read and write repository ports for notifications (find/save contracts via the shared base repository interfaces). This change MUST NOT require a concrete persistence implementation.

#### Scenario: Ports are defined
- **WHEN** the notification domain is present
- **THEN** read and write repository port interfaces and DI tokens MUST exist for later infrastructure binding
