# Delta for Notification Creation

## ADDED Requirements

### Requirement: REST and GraphQL Creation Accept Optional Delivery Mode

The REST (`POST /api/v1/notifications`) and GraphQL (`notificationCreate`)
creation entry points MAY accept an optional `deliveryMode` field using
`NotificationDeliveryModeEnum` (`DELIVER` | `RECORD_ONLY`), threaded into
`CreateNotificationCommand`. When absent, the system MUST default to
`DELIVER`. When present with an invalid value, the system MUST reject the
request as invalid input per the existing input-validation requirement (no
notification created).

#### Scenario: REST creates a RECORD_ONLY notification

- GIVEN a valid create-notification payload with `deliveryMode: RECORD_ONLY`
- WHEN a client sends `POST /api/v1/notifications` with that payload
- THEN the system MUST dispatch `CreateNotificationCommand` carrying
  `deliveryMode: RECORD_ONLY`
- AND the system MUST respond with the created notification's id

#### Scenario: GraphQL creates a RECORD_ONLY notification

- GIVEN a valid `notificationCreate` mutation input with
  `deliveryMode: RECORD_ONLY`
- WHEN a client executes the `notificationCreate` mutation
- THEN the system MUST dispatch `CreateNotificationCommand` carrying
  `deliveryMode: RECORD_ONLY`
- AND the system MUST respond with the created notification's id

#### Scenario: Omitted deliveryMode defaults to DELIVER on both transports

- GIVEN a valid create-notification payload with no `deliveryMode` field,
  submitted via REST or GraphQL
- WHEN the notification is created
- THEN the system MUST dispatch `CreateNotificationCommand` carrying
  `deliveryMode: DELIVER`

#### Scenario: Invalid deliveryMode is rejected on both transports

- GIVEN a create-notification payload with a `deliveryMode` value that is
  not `DELIVER` or `RECORD_ONLY`, submitted via REST or GraphQL
- WHEN the request is received
- THEN the system MUST respond with a validation error per that transport's
  convention
- AND the system MUST NOT create a notification
