import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';

describe('NotificationFindByIdQuery', () => {
  it('wraps the input id in a UuidValueObject', () => {
    const query = new NotificationFindByIdQuery({
      id: '11111111-1111-4111-8111-111111111111',
    });

    expect(query.id.value).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('throws when the id is not a valid UUID', () => {
    expect(() => new NotificationFindByIdQuery({ id: 'not-a-uuid' })).toThrow();
  });
});
