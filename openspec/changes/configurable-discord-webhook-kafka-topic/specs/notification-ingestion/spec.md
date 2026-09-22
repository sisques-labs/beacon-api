# Delta for Notification Ingestion

## ADDED Requirements

### Requirement: Kafka Ingest Accepts Optional Delivery Mode

The Kafka notification-request event MAY carry an optional `deliveryMode`
field using `NotificationDeliveryModeEnum` (`DELIVER` | `RECORD_ONLY`). When
absent, the system MUST default to `DELIVER`. When present with an invalid
(non-enum) value, the system MUST treat the event as malformed and apply
the existing malformed-event handling (log and skip, no crash loop) — it
MUST NOT create a notification from that event.

#### Scenario: Event with deliveryMode is accepted

- GIVEN a well-formed event with all required fields and
  `deliveryMode: RECORD_ONLY`
- WHEN the consumer processes it
- THEN the system MUST persist a new notification with
  `deliveryMode: RECORD_ONLY` in `PENDING` status

#### Scenario: Event without deliveryMode defaults to DELIVER

- GIVEN a well-formed event with all required fields and no `deliveryMode`
  field
- WHEN the consumer processes it
- THEN the system MUST persist a new notification with
  `deliveryMode: DELIVER`

#### Scenario: Event with invalid deliveryMode is skipped

- GIVEN an event whose `deliveryMode` value is not `DELIVER` or
  `RECORD_ONLY`
- WHEN the consumer processes it
- THEN the system MUST log and skip it, consistent with existing
  malformed-event handling
- AND no notification MUST be created
