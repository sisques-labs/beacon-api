import { NotificationChannelDestinationFindByIdQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-id/notification-channel-destination-find-by-id.query';

describe('NotificationChannelDestinationFindByIdQuery', () => {
  it('wraps id in a value object', () => {
    const query = new NotificationChannelDestinationFindByIdQuery({
      id: '11111111-1111-4111-8111-111111111111',
    });

    expect(query.id.value).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('throws when id is not a valid UUID', () => {
    expect(
      () => new NotificationChannelDestinationFindByIdQuery({ id: 'nope' }),
    ).toThrow();
  });
});
