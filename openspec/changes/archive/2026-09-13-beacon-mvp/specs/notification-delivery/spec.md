# Delta for Notification Delivery

## ADDED Requirements

### Requirement: Asynchronous Discord Webhook Delivery

After a notification is persisted in `PENDING`, the system MUST deliver it via a Discord incoming webhook asynchronously, without blocking ingestion on delivery latency.

#### Scenario: Successful delivery transitions to SENT

- GIVEN a `PENDING` notification for channel `DISCORD`
- WHEN the webhook POST succeeds
- THEN the system MUST transition the notification to `SENT`

#### Scenario: Failed delivery transitions to terminal FAILED

- GIVEN a `PENDING` notification for channel `DISCORD`
- WHEN the webhook POST fails (network error or non-2xx response)
- THEN the system MUST transition the notification to `FAILED` and record a `failureReason`
- AND the system MUST NOT retry — `FAILED` is a terminal status by existing domain design (no retry state exists)

### Requirement: Delivery Limited to Discord for v1

EMAIL and PUSH senders MUST NOT be implemented in this change. Delivery for those channels is OUT OF SCOPE, consistent with their exclusion from ingestion.

#### Scenario: No sender exists for EMAIL or PUSH

- GIVEN the domain `channel` enum permits `EMAIL` and `PUSH`
- WHEN this change ships
- THEN no delivery adapter MUST exist for those channels
