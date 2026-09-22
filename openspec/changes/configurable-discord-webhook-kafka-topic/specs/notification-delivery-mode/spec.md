# Notification Delivery Mode Specification

## Purpose

Defines the producer-declared `deliveryMode` field that lets a producer
request that Beacon record a notification without delivering it to Discord
(or any channel), and the `SKIPPED` terminal outcome that results.

## Requirements

### Requirement: Delivery Mode Is a Closed Enum

`NotificationDeliveryModeEnum` MUST have exactly two values: `DELIVER` and
`RECORD_ONLY`. The system MUST NOT accept, store, or interpret any other
value, and MUST NEVER accept a URL, address, hostname, or other destination
value in this field or any field with delivery-mode semantics — the Discord
destination is resolved exclusively from Beacon-side configuration
(`DISCORD_WEBHOOK_URL`), never from caller input. This preserves the SSRF
constraint D3.

#### Scenario: Valid enum value is accepted

- GIVEN a request carrying `deliveryMode: RECORD_ONLY` or `deliveryMode: DELIVER`
- WHEN the request is processed
- THEN the system MUST accept the value as-is

#### Scenario: Non-enum value is rejected, never interpreted as a destination

- GIVEN a request carrying a `deliveryMode` value that is not `DELIVER` or
  `RECORD_ONLY` (including a URL-shaped string)
- WHEN the request is processed
- THEN the system MUST reject it as a validation failure
- AND the system MUST NOT use the value to resolve or override the Discord
  destination

### Requirement: Absent Delivery Mode Defaults to DELIVER

When `deliveryMode` is omitted from a request, the system MUST behave
exactly as it did before this field existed: deliver to Discord.

#### Scenario: Omitted field defaults to DELIVER

- GIVEN a request with no `deliveryMode` field
- WHEN the notification is created
- THEN the system MUST treat it as `deliveryMode: DELIVER`
- AND existing delivery behavior MUST be unaffected

### Requirement: RECORD_ONLY Yields No Delivery Attempt and Terminal SKIPPED

A notification created with `deliveryMode: RECORD_ONLY` MUST be persisted
and queryable exactly like any other notification, MUST NOT trigger any
delivery attempt on any channel, and MUST transition from `PENDING` to the
terminal `SKIPPED` status. `SKIPPED` MUST be terminal — no transition out
of `SKIPPED` is permitted.

#### Scenario: RECORD_ONLY notification is persisted, not delivered

- GIVEN a request with `deliveryMode: RECORD_ONLY` and valid required fields
- WHEN the notification is created
- THEN the system MUST persist it and make it queryable
- AND the system MUST NOT make any outbound delivery call
- AND the system MUST transition it to `SKIPPED`

#### Scenario: SKIPPED is terminal

- GIVEN a notification in `SKIPPED` status
- WHEN any process attempts to transition it further
- THEN the system MUST reject the transition, consistent with the other
  terminal statuses (`SENT`, `FAILED`, `CANCELLED`)
