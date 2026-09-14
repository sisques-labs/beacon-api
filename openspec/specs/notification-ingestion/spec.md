# Delta for Notification Ingestion

## ADDED Requirements

### Requirement: Kafka Notification-Request Consumption

The system MUST consume notification-request events from a dedicated Kafka topic, each carrying `tenantId`, `recipientUserId`, `channel`, `title`, `body`, `sourceService`, and `dedupeKey`, mapping directly onto the existing `NotificationAggregate` fields. The event payload MUST NOT carry any deliverable address or destination field (e.g. a Discord webhook URL). The Discord destination MUST be resolved exclusively from Beacon-side configuration, never from event data. This is a deliberate SSRF-mitigation choice, not an oversight: because the ingestion topic has no authentication (see below), accepting a caller-supplied destination would let any producer with topic access direct Beacon to make outbound requests to an arbitrary attacker-controlled address.

#### Scenario: Valid event creates a notification

- GIVEN a well-formed event with all required fields
- WHEN the consumer processes it
- THEN the system MUST persist a new notification in `PENDING` status

#### Scenario: Malformed event is skipped, not crash-looped

- GIVEN an event missing a required field
- WHEN the consumer processes it
- THEN the system MUST log and skip it, and keep consuming subsequent events

### Requirement: No Ingestion Authentication (Accepted MVP Tradeoff)

The system MUST NOT require authentication on the ingestion topic for v1. Any producer with topic access MAY create notifications for any tenant; broker ACLs are the only control. This is an explicitly accepted risk, not an oversight.

#### Scenario: Unauthenticated producer is accepted

- GIVEN a producer with Kafka topic access and no application-level credential
- WHEN it publishes a valid notification-request event
- THEN the system MUST process it identically to any other producer

### Requirement: Idempotent Dedupe on `(tenantId, dedupeKey)`

A duplicate `(tenantId, dedupeKey)` MUST be an idempotent no-op referencing the existing notification, not a second creation and not an error.

#### Scenario: Duplicate event creates no second notification

- GIVEN a persisted notification for `(tenantId, dedupeKey)`
- WHEN another event arrives with the same pair
- THEN the system MUST NOT create a second notification
- AND the handler MUST return/reference the existing notification instead of raising an error

### Requirement: Ingestion Limited to Discord Channel for v1

EMAIL and PUSH are modeled in the domain `channel` enum but MUST NOT be accepted as ingestion targets in this change; only `channel: DISCORD` is supported. EMAIL and PUSH remain OUT OF SCOPE — no sender or provider exists for them yet.

#### Scenario: Event for EMAIL or PUSH is rejected

- GIVEN a notification-request event with `channel: EMAIL` or `channel: PUSH`
- WHEN the consumer processes it
- THEN the system MUST log it as unsupported-for-this-change and skip it
- AND no notification MUST be created
