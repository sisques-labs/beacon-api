import { Mocked, vi } from 'vitest';

import { NotificationChannelDestinationFindByTenantAndChannelHandler } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-tenant-and-channel/notification-channel-destination-find-by-tenant-and-channel.handler';
import { NotificationChannelDestinationFindByTenantAndChannelQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-tenant-and-channel/notification-channel-destination-find-by-tenant-and-channel.query';
import { INotificationChannelDestinationReadRepository } from '@contexts/notifications/domain/repositories/read/notification-channel-destination-read.repository';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';

function buildViewModel(): NotificationChannelDestinationViewModel {
  return new NotificationChannelDestinationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    channel: 'DISCORD',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationChannelDestinationFindByTenantAndChannelHandler', () => {
  let handler: NotificationChannelDestinationFindByTenantAndChannelHandler;
  let readRepository: Mocked<INotificationChannelDestinationReadRepository>;

  beforeEach(() => {
    readRepository = {
      findByTenantAndChannel: vi.fn(),
    } as unknown as Mocked<INotificationChannelDestinationReadRepository>;
    handler = new NotificationChannelDestinationFindByTenantAndChannelHandler(
      readRepository,
    );
  });

  it('delegates to the read repository with the query tenantId and channel', async () => {
    const viewModel = buildViewModel();
    readRepository.findByTenantAndChannel.mockResolvedValue(viewModel);
    const query = new NotificationChannelDestinationFindByTenantAndChannelQuery(
      { tenantId: viewModel.tenantId, channel: viewModel.channel },
    );

    const result = await handler.execute(query);

    expect(readRepository.findByTenantAndChannel).toHaveBeenCalledWith(
      viewModel.tenantId,
      viewModel.channel,
    );
    expect(result).toBe(viewModel);
  });

  it('returns null when no destination is registered for the tenant and channel', async () => {
    readRepository.findByTenantAndChannel.mockResolvedValue(null);
    const query = new NotificationChannelDestinationFindByTenantAndChannelQuery(
      {
        tenantId: '33333333-3333-4333-8333-333333333333',
        channel: 'DISCORD',
      },
    );

    const result = await handler.execute(query);

    expect(result).toBeNull();
  });
});
