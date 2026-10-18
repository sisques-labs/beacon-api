import { Mocked, vi } from 'vitest';

import { NotificationChannelDestinationFindByIdHandler } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-id/notification-channel-destination-find-by-id.handler';
import { NotificationChannelDestinationFindByIdQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-id/notification-channel-destination-find-by-id.query';
import { INotificationChannelDestinationReadRepository } from '@contexts/notifications/domain/repositories/read/notification-channel-destination-read.repository';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';

const ID = '11111111-1111-4111-8111-111111111111';

function buildViewModel(): NotificationChannelDestinationViewModel {
  return new NotificationChannelDestinationViewModel({
    id: ID,
    tenantId: '22222222-2222-4222-8222-222222222222',
    channel: 'DISCORD',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationChannelDestinationFindByIdHandler', () => {
  let handler: NotificationChannelDestinationFindByIdHandler;
  let readRepository: Mocked<INotificationChannelDestinationReadRepository>;

  beforeEach(() => {
    readRepository = {
      findById: vi.fn(),
    } as unknown as Mocked<INotificationChannelDestinationReadRepository>;
    handler = new NotificationChannelDestinationFindByIdHandler(readRepository);
  });

  it('delegates to the read repository with the query id', async () => {
    const viewModel = buildViewModel();
    readRepository.findById.mockResolvedValue(viewModel);

    const result = await handler.execute(
      new NotificationChannelDestinationFindByIdQuery({ id: ID }),
    );

    expect(readRepository.findById).toHaveBeenCalledWith(ID);
    expect(result).toBe(viewModel);
  });

  it('resolves to null when no destination has that id', async () => {
    readRepository.findById.mockResolvedValue(null);

    const result = await handler.execute(
      new NotificationChannelDestinationFindByIdQuery({ id: ID }),
    );

    expect(result).toBeNull();
  });

  it('logs at entry with the id', async () => {
    readRepository.findById.mockResolvedValue(null);
    const logSpy = vi.spyOn(
      (handler as unknown as { logger: { log: (m: string) => void } }).logger,
      'log',
    );

    await handler.execute(
      new NotificationChannelDestinationFindByIdQuery({ id: ID }),
    );

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(ID));
  });
});
