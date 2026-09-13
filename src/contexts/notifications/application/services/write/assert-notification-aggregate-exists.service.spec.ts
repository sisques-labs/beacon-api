import { Mocked, vi } from 'vitest';

import { AssertNotificationViewModelExistsService } from '@contexts/notifications/application/services/read/assert-notification-view-model-exists.service';
import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
import { INotificationReadRepository } from '@contexts/notifications/domain/repositories/read/notification-read.repository';
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

describe('AssertNotificationViewModelExistsService', () => {
  let service: AssertNotificationViewModelExistsService;
  let readRepository: Mocked<INotificationReadRepository>;

  beforeEach(() => {
    readRepository = {
      findById: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<INotificationReadRepository>;
    service = new AssertNotificationViewModelExistsService(readRepository);
  });

  it('returns the view model when found', async () => {
    const viewModel = buildViewModel();
    readRepository.findById.mockResolvedValue(viewModel);

    const result = await service.execute(viewModel.id);

    expect(result).toBe(viewModel);
  });

  it('throws NotificationNotFoundException when not found', async () => {
    readRepository.findById.mockResolvedValue(null);

    await expect(service.execute('unknown-id')).rejects.toBeInstanceOf(
      NotificationNotFoundException,
    );
  });
});
