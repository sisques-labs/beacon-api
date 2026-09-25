import { NotificationChannelDestinationFindByTenantAndChannelQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-tenant-and-channel/notification-channel-destination-find-by-tenant-and-channel.query';

describe('NotificationChannelDestinationFindByTenantAndChannelQuery', () => {
  it('wraps tenantId and channel in value objects', () => {
    const query = new NotificationChannelDestinationFindByTenantAndChannelQuery(
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        channel: 'DISCORD',
      },
    );

    expect(query.tenantId.value).toBe('11111111-1111-4111-8111-111111111111');
    expect(query.channel.value).toBe('DISCORD');
  });

  it('throws when tenantId is not a valid UUID', () => {
    expect(
      () =>
        new NotificationChannelDestinationFindByTenantAndChannelQuery({
          tenantId: 'not-a-uuid',
          channel: 'DISCORD',
        }),
    ).toThrow();
  });

  it('throws when channel is not a member of NotificationChannelEnum', () => {
    expect(
      () =>
        new NotificationChannelDestinationFindByTenantAndChannelQuery({
          tenantId: '11111111-1111-4111-8111-111111111111',
          channel: 'NOT_A_CHANNEL',
        }),
    ).toThrow();
  });
});
