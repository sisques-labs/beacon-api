import { QueryBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationController } from '@contexts/notifications/transport/rest/notification.controller';

function buildViewModel(): NotificationViewModel {
  return new NotificationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    recipientUserId: '33333333-3333-4333-8333-333333333333',
    channel: 'DISCORD',
    status: 'PENDING',
    title: 'Title',
    body: 'Body',
    sourceService: 'gardenia',
    dedupeKey: 'dedupe-key-1',
    failureReason: null,
    sentAt: null,
    readAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationController', () => {
  let controller: NotificationController;
  let queryBus: Mocked<QueryBus>;

  beforeEach(() => {
    queryBus = { execute: vi.fn() } as unknown as Mocked<QueryBus>;
    controller = new NotificationController(queryBus);
  });

  it('dispatches NotificationFindByIdQuery with the requested id', async () => {
    const viewModel = buildViewModel();
    queryBus.execute.mockResolvedValue(viewModel);

    await controller.findById(viewModel.id);

    expect(queryBus.execute).toHaveBeenCalledWith(
      new NotificationFindByIdQuery({ id: viewModel.id }),
    );
  });

  it('returns a response DTO built from the view model', async () => {
    const viewModel = buildViewModel();
    queryBus.execute.mockResolvedValue(viewModel);

    const result = await controller.findById(viewModel.id);

    expect(result).toEqual({
      id: viewModel.id,
      tenantId: viewModel.tenantId,
      recipientUserId: viewModel.recipientUserId,
      channel: viewModel.channel,
      status: viewModel.status,
      title: viewModel.title,
      body: viewModel.body,
      sourceService: viewModel.sourceService,
      dedupeKey: viewModel.dedupeKey,
      failureReason: null,
      sentAt: null,
      readAt: null,
      cancelledAt: null,
      createdAt: viewModel.createdAt,
      updatedAt: viewModel.updatedAt,
    });
  });
});
