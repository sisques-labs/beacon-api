import { Criteria } from '@sisques-labs/nestjs-kit';

import { NotificationChannelDestinationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-criteria/notification-channel-destination-find-by-criteria.query';

describe('NotificationChannelDestinationFindByCriteriaQuery', () => {
  it('carries the given criteria untouched', () => {
    const criteria = new Criteria();

    const query = new NotificationChannelDestinationFindByCriteriaQuery({
      criteria,
    });

    expect(query.criteria).toBe(criteria);
  });
});
