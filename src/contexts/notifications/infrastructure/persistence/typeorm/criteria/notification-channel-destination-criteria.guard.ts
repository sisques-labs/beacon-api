import { Criteria } from '@sisques-labs/nestjs-kit';

import { UnsupportedCriteriaFieldException } from '@contexts/notifications/domain/exceptions/unsupported-criteria-field.exception';

/**
 * Single source of truth for the fields a `Criteria` may filter or sort on for
 * `notification-channel-destination`, shared by the read and the write
 * repository so the two cannot drift.
 *
 * `encryptedAddress` (the AES-GCM envelope of the webhook URL) MUST NEVER be
 * listed here: `applyCriteriaToQueryBuilder` interpolates `filter.field` /
 * `sort.field` straight into SQL, so without this allowlist the secret column
 * could be probed through `where` / `orderBy` (boolean/ordering oracle).
 */
export const NOTIFICATION_CHANNEL_DESTINATION_CRITERIA_FIELDS = [
  'id',
  'tenantId',
  'channel',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Rejects a criteria that filters or sorts on any field outside
 * `NOTIFICATION_CHANNEL_DESTINATION_CRITERIA_FIELDS`. MUST run before the
 * criteria reaches the query builder.
 *
 * @throws UnsupportedCriteriaFieldException on the first offending field
 */
export function assertNotificationChannelDestinationCriteria(
  criteria: Criteria,
): void {
  const allowed: readonly string[] =
    NOTIFICATION_CHANNEL_DESTINATION_CRITERIA_FIELDS;

  for (const filter of criteria.filters ?? []) {
    if (!allowed.includes(filter.field)) {
      throw new UnsupportedCriteriaFieldException(
        'filter',
        filter.field,
        allowed,
      );
    }
  }
  for (const sort of criteria.sorts ?? []) {
    if (!allowed.includes(sort.field)) {
      throw new UnsupportedCriteriaFieldException('sort', sort.field, allowed);
    }
  }
}
