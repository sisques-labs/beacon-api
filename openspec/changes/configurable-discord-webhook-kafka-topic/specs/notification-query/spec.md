# Delta for Notification Query

## ADDED Requirements

### Requirement: SKIPPED Status and Delivery Mode Are Readable

The get-by-id query (REST and GraphQL) and any listing/findByCriteria query
MUST return notifications in `SKIPPED` status and their `deliveryMode`
field like any other status/field, without throwing or crashing on the new
enum value. Consumers of the status enum on the read side MUST handle
`SKIPPED` as a valid, recognized value.

#### Scenario: SKIPPED notification is returned via REST

- GIVEN a persisted notification in `SKIPPED` status
- WHEN a client calls the REST get-by-id endpoint with that id
- THEN the system MUST return the notification with status `SKIPPED` and
  its `deliveryMode`
- AND no unhandled error MUST occur

#### Scenario: SKIPPED notification is returned via GraphQL

- GIVEN a persisted notification in `SKIPPED` status
- WHEN a client queries it by id via GraphQL
- THEN the system MUST return the notification with status `SKIPPED` and
  its `deliveryMode`
- AND no unhandled error MUST occur

### Requirement: deliveryMode and SKIPPED Are Filterable

`deliveryMode` MUST be added to the notification queryable-field enum and
filterable-fields registry as an enum-typed field. The status queryable
field MUST accept `SKIPPED` as a valid filter value using the same
`FilterOperator` support as other statuses.

#### Scenario: Filtering by deliveryMode

- GIVEN persisted notifications with mixed `deliveryMode` values
- WHEN a client calls findByCriteria filtering
  `deliveryMode EQUALS RECORD_ONLY`
- THEN the system MUST return only notifications with
  `deliveryMode: RECORD_ONLY`

#### Scenario: Filtering by SKIPPED status

- GIVEN persisted notifications with mixed statuses including `SKIPPED`
- WHEN a client calls findByCriteria filtering `status EQUALS SKIPPED`
- THEN the system MUST return only notifications in `SKIPPED` status
