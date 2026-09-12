# Delta for Notification Query

## ADDED Requirements

### Requirement: Get Notification By Id (REST and GraphQL)

The system MUST expose a get-by-id query for a single notification's current state, via BOTH a REST endpoint and a GraphQL query/resolver.

#### Scenario: Existing notification is returned via REST

- GIVEN a persisted notification with a known id
- WHEN a client calls the REST get-by-id endpoint with that id
- THEN the system MUST return the notification's current status and fields

#### Scenario: Existing notification is returned via GraphQL

- GIVEN a persisted notification with a known id
- WHEN a client queries it by id via GraphQL
- THEN the system MUST return the notification's current status and fields

#### Scenario: Unknown id returns not-found

- GIVEN no notification exists for a given id
- WHEN a client requests it via REST or GraphQL
- THEN the system MUST return a not-found result (REST 404 / GraphQL not-found error) without throwing an unhandled error
