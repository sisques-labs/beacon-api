# Delta for Notification Delivery

## MODIFIED Requirements

### Requirement: Asynchronous Discord Webhook Delivery

After a notification is persisted in `PENDING` with `deliveryMode: DELIVER`
(or no `deliveryMode`, which defaults to `DELIVER`), the system MUST
deliver it via a Discord incoming webhook asynchronously, without blocking
ingestion on delivery latency. Delivery attempts MUST be retried, up to a
configured maximum number of attempts with backoff between attempts,
before the notification is treated as failed. A notification with
`deliveryMode: RECORD_ONLY` MUST NOT enter this delivery flow at all.
(Previously: delivery applied unconditionally to every `PENDING`
notification; there was no `deliveryMode` distinction.)

#### Scenario: Successful delivery transitions to SENT

- GIVEN a `PENDING` notification for channel `DISCORD` with
  `deliveryMode: DELIVER`
- WHEN the webhook POST succeeds, whether on the first attempt or a later
  retried attempt
- THEN the system MUST transition the notification to `SENT`

#### Scenario: Transient failure is retried before exhaustion

- GIVEN a `PENDING` notification for channel `DISCORD` with
  `deliveryMode: DELIVER`
- WHEN the webhook POST fails (network error or non-2xx response) and the
  configured maximum attempts have NOT yet been reached
- THEN the system MUST retry delivery after a backoff interval
- AND the notification MUST remain `PENDING` while attempts continue

#### Scenario: Exhausted retries transition to terminal FAILED

- GIVEN a `PENDING` notification for channel `DISCORD` with
  `deliveryMode: DELIVER`
- WHEN every configured delivery attempt has failed
- THEN the system MUST transition the notification to `FAILED` via the
  existing `fail(reason)` aggregate method and record a `failureReason`
- AND the system MUST NOT attempt further delivery — `FAILED` remains a
  terminal status by existing domain design

#### Scenario: Crash between enqueue and delivery still delivers

- GIVEN a delivery attempt has been durably enqueued for a `PENDING`
  notification with `deliveryMode: DELIVER`
- WHEN the application process restarts before the attempt is processed
- THEN the system MUST still process the pending attempt after restart
- AND the notification MUST eventually reach `SENT` or exhausted-retry
  `FAILED`, never staying `PENDING` indefinitely due to the restart

## ADDED Requirements

### Requirement: RECORD_ONLY Bypasses Delivery and Transitions Directly to SKIPPED

When a `PENDING` notification has `deliveryMode: RECORD_ONLY`, the delivery
handler MUST NOT invoke `DiscordWebhookNotificationSenderAdapter` or any
sender adapter, MUST NOT enqueue a delivery job, and MUST transition the
notification directly from `PENDING` to `SKIPPED`.

#### Scenario: RECORD_ONLY notification is skipped without an HTTP call

- GIVEN a `PENDING` notification with `deliveryMode: RECORD_ONLY`
- WHEN the delivery handler processes it
- THEN the system MUST NOT invoke `DiscordWebhookNotificationSenderAdapter`
- AND the system MUST transition the notification to `SKIPPED`

#### Scenario: SKIPPED notifications are never retried

- GIVEN a notification already in `SKIPPED` status
- WHEN the delivery flow runs
- THEN the system MUST NOT attempt delivery or transition it further
