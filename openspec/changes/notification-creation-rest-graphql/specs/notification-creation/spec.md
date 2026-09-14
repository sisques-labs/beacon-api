# Notification Creation Specification

## Purpose

Add synchronous, transport-agnostic notification creation over REST and
GraphQL. Both adapters are thin: they validate input, dispatch the existing,
unchanged `CreateNotificationCommand` via `CommandBus`, and map the response.
Creation semantics (validation rules, dedupe-idempotency) remain
single-sourced in the existing application layer — no domain, application,
or infrastructure behavior changes. Authentication is explicitly deferred
for this change (see the proposal's Known Tradeoffs) — these endpoints are
unauthenticated, matching the existing unguarded query-side precedent.

## Requirements

### Requirement: Synchronous Notification Creation

The system MUST allow creating a notification synchronously via REST
(`POST /api/v1/notifications`) and via GraphQL (`notificationCreate`
mutation). Both entry points MUST dispatch the existing
`CreateNotificationCommand` through `CommandBus` and MUST NOT duplicate
creation logic. Each MUST return the created (or existing, on dedupe)
notification's id.

#### Scenario: REST creates a notification

- GIVEN a valid create-notification payload (tenantId, recipientUserId,
  channel, title, body, sourceService, dedupeKey)
- WHEN a client sends `POST /api/v1/notifications` with that payload
- THEN the system MUST dispatch `CreateNotificationCommand` via `CommandBus`
- AND the system MUST respond with a success status and the created
  notification's id

#### Scenario: GraphQL creates a notification

- GIVEN a valid `notificationCreate` mutation input with the same required
  fields
- WHEN a client executes the `notificationCreate` mutation
- THEN the system MUST dispatch `CreateNotificationCommand` via `CommandBus`
- AND the system MUST respond with the created notification's id in the
  mutation response

### Requirement: Dedupe-Idempotent Creation

The system MUST NOT create a second notification when either transport
receives a repeated creation request carrying the same `(tenantId,
dedupeKey)` pair as a prior successful request. It MUST return the id of
the originally created notification instead.

#### Scenario: Repeated REST call is idempotent

- GIVEN a notification was already created for a given `(tenantId,
  dedupeKey)` pair
- WHEN a client sends `POST /api/v1/notifications` again with the same
  `tenantId` and `dedupeKey`
- THEN the system MUST NOT create a second notification
- AND the system MUST respond with the id of the original notification

#### Scenario: Repeated GraphQL call is idempotent

- GIVEN a notification was already created for a given `(tenantId,
  dedupeKey)` pair
- WHEN a client executes `notificationCreate` again with the same
  `tenantId` and `dedupeKey`
- THEN the system MUST NOT create a second notification
- AND the system MUST respond with the id of the original notification

### Requirement: Input Validation Across Transports

The system MUST validate creation input on both transports and MUST
reject invalid input (missing or malformed required fields) without
dispatching `CreateNotificationCommand` or creating a notification. Error
shape follows each transport's own convention.

#### Scenario: REST rejects invalid payload

- GIVEN a `POST /api/v1/notifications` request missing a required field or
  containing an invalid value
- WHEN `NotificationController` receives the request
- THEN the system MUST respond with an HTTP 4xx validation error
- AND the system MUST NOT create a notification

#### Scenario: GraphQL rejects invalid input

- GIVEN a `notificationCreate` mutation with a missing required field or an
  invalid value
- WHEN `NotificationMutationsResolver` receives the request
- THEN the system MUST respond with a GraphQL error in the standard
  `errors` array
- AND the system MUST NOT create a notification
