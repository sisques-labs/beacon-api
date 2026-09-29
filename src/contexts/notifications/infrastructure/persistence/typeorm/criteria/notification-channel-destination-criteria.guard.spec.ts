import {
  Criteria,
  FilterOperator,
  SortDirection,
} from '@sisques-labs/nestjs-kit';

import { UnsupportedCriteriaFieldException } from '@contexts/notifications/domain/exceptions/unsupported-criteria-field.exception';
import {
  assertNotificationChannelDestinationCriteria,
  NOTIFICATION_CHANNEL_DESTINATION_CRITERIA_FIELDS,
} from '@contexts/notifications/infrastructure/persistence/typeorm/criteria/notification-channel-destination-criteria.guard';

describe('assertNotificationChannelDestinationCriteria', () => {
  it('never allows encryptedAddress', () => {
    expect(NOTIFICATION_CHANNEL_DESTINATION_CRITERIA_FIELDS).not.toContain(
      'encryptedAddress',
    );
  });

  it('accepts an empty criteria', () => {
    expect(() =>
      assertNotificationChannelDestinationCriteria(new Criteria()),
    ).not.toThrow();
  });

  it.each(NOTIFICATION_CHANNEL_DESTINATION_CRITERIA_FIELDS)(
    'accepts filtering and sorting on %s',
    (field) => {
      const criteria = new Criteria(
        [{ field, operator: FilterOperator.EQUALS, value: 'x' }],
        [{ field, direction: SortDirection.ASC }],
      );

      expect(() =>
        assertNotificationChannelDestinationCriteria(criteria),
      ).not.toThrow();
    },
  );

  it.each(['encryptedAddress', 'unknown', 'id; DROP TABLE x', 'ID', ''])(
    'rejects filtering on %j',
    (field) => {
      const criteria = new Criteria([
        { field, operator: FilterOperator.EQUALS, value: 'x' },
      ]);

      expect(() =>
        assertNotificationChannelDestinationCriteria(criteria),
      ).toThrow(UnsupportedCriteriaFieldException);
    },
  );

  it.each(['encryptedAddress', 'unknown', 'id; DROP TABLE x', 'ID', ''])(
    'rejects sorting on %j',
    (field) => {
      const criteria = new Criteria(
        [],
        [{ field, direction: SortDirection.DESC }],
      );

      expect(() =>
        assertNotificationChannelDestinationCriteria(criteria),
      ).toThrow(UnsupportedCriteriaFieldException);
    },
  );

  it('rejects a bad field even when it follows valid ones', () => {
    const criteria = new Criteria([
      { field: 'tenantId', operator: FilterOperator.EQUALS, value: 'x' },
      { field: 'encryptedAddress', operator: FilterOperator.LIKE, value: 'v' },
    ]);

    expect(() =>
      assertNotificationChannelDestinationCriteria(criteria),
    ).toThrow(/Cannot filter by 'encryptedAddress'/);
  });
});
