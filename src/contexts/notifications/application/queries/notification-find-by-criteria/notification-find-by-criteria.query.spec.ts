import { Criteria } from '@sisques-labs/nestjs-kit';

import { NotificationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-find-by-criteria/notification-find-by-criteria.query';

describe('NotificationFindByCriteriaQuery', () => {
  it('carries the given Criteria through unchanged', () => {
    const criteria = new Criteria(
      [
        {
          field: 'deliveryMode',
          operator: 'eq' as never,
          value: 'RECORD_ONLY',
        },
      ],
      [],
      { page: 1, perPage: 10 },
    );

    const query = new NotificationFindByCriteriaQuery({ criteria });

    expect(query.criteria).toBe(criteria);
  });
});
