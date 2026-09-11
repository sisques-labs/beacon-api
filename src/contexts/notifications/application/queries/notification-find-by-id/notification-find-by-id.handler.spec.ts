import { Mocked, vi } from 'vitest';

import { AssertNotificationViewModelExistsService } from '@contexts/notifications/application/services/read/assert-notification-view-model-exists.service';
import { NotificationFindByIdHandler } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.handler';
import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';

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

describe('NotificationFindByIdHandler', () => {
  let handler: NotificationFindByIdHandler;
  let assertService: Mocked<AssertNotificationViewModelExistsService>;

  beforeEach(() => {
    assertService = {
      execute: vi.fn(),
    } as unknown as Mocked<AssertNotificationViewModelExistsService>;
    handler = new NotificationFindByIdHandler(assertService);
  });

  it('delegates to the assert service with the query id', async () => {
    const viewModel = buildViewModel();
    assertService.execute.mockResolvedValue(viewModel);
    const query = new NotificationFindByIdQuery({ id: viewModel.id });

    const result = await handler.execute(query);

    expect(assertService.execute).toHaveBeenCalledWith(viewModel.id);
    expect(result).toBe(viewModel);
  });
});
