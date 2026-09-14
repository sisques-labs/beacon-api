# Notification Delivery Queue Specification

## Purpose

Durable, retrying enqueue and in-process consumption of delivery attempts, so a transient webhook failure or a mid-delivery crash no longer leaves a notification permanently `PENDING` with no re-drive.

## Requirements

### Requirement: Durable Enqueue on Notification Creation

When a notification is created, the system MUST durably enqueue its delivery attempt (Redis-backed) instead of dispatching delivery synchronously in-process.

#### Scenario: Enqueue succeeds

- GIVEN a notification has just been persisted in `PENDING`
- WHEN the delivery attempt is enqueued
- THEN the job MUST be durably persisted outside the application process
- AND the notification MUST remain `PENDING` until a worker processes the job

#### Scenario: Enqueue failure does not lose the notification

- GIVEN the queue backend is unavailable when a notification is created
- WHEN enqueueing the delivery attempt fails
- THEN the notification MUST remain persisted `PENDING`
- AND the enqueue failure MUST be logged, never silently swallowed

### Requirement: In-Process Worker Consumption

The system MUST consume queued delivery jobs via a worker running in the same NestJS process as ingestion — no separate deployment entrypoint.

#### Scenario: Queued job dispatches the unchanged delivery command

- GIVEN a delivery job has been queued for a `PENDING` notification
- WHEN the in-process worker consumes the job
- THEN it MUST dispatch the existing delivery command through the command bus
- AND existing delivery domain logic MUST remain unaffected by the queue hop

### Requirement: Bounded Retry With Backoff

A transient delivery failure MUST be retried up to a configured maximum number of attempts, with a backoff interval between attempts, before the delivery attempt is treated as exhausted.

#### Scenario: Transient failure is retried and later succeeds

- GIVEN a delivery job fails on an attempt and the configured maximum has not been reached
- WHEN the next attempt is processed after its backoff interval
- THEN delivery MUST be retried
- AND a subsequent success MUST still result in `SENT`

#### Scenario: Maximum attempts reached

- GIVEN a delivery job has failed on every attempt up to the configured maximum
- WHEN the final attempt fails
- THEN the job MUST be treated as exhausted and MUST NOT be retried further

### Requirement: Redis Readiness Reporting

The system MUST report queue-backend (Redis) connectivity through the existing health/readiness mechanism.

#### Scenario: Redis reachable

- GIVEN Redis is reachable
- WHEN the health endpoint is queried
- THEN it MUST report the Redis dependency as healthy

#### Scenario: Redis unreachable

- GIVEN Redis is unreachable
- WHEN the health endpoint is queried
- THEN readiness MUST fail
- AND the failure MUST be visible to operators, distinguishing it from other dependency failures
