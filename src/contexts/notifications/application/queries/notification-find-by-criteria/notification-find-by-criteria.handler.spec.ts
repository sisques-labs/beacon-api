import { Criteria, PaginatedResult } from '@sisques-labs/nestjs-kit';
import { Mocked, vi } from 'vitest';

import { NotificationFindByCriteriaHandler } from '@contexts/notifications/application/queries/notification-find-by-criteria/notification-find-by-criteria.handler';
import { NotificationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-find-by-criteria/notification-find-by-criteria.query';
import { INotificationReadRepository } from '@contexts/notifications/domain/repositories/read/notification-read.repository';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';

function buildViewModel(): NotificationViewModel {
  return new NotificationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    recipientUserId: '33333333-3333-4333-8333-333333333333',
    channel: 'DISCORD',
    status: 'SKIPPED',
    title: 'Title',
    body: 'Body',
    sourceService: 'gardenia',
    dedupeKey: 'dedupe-key-1',
    deliveryMode: 'RECORD_ONLY',
    failureReason: null,
    sentAt: null,
    readAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationFindByCriteriaHandler', () => {
  let handler: NotificationFindByCriteriaHandler;
  let readRepository: Mocked<INotificationReadRepository>;

  beforeEach(() => {
    readRepository = {
      findById: vi.fn(),
      findByCriteria: vi.fn(),
    } as unknown as Mocked<INotificationReadRepository>;
    handler = new NotificationFindByCriteriaHandler(readRepository);
  });

  it('delegates to findByCriteria with the exact Criteria and returns the PaginatedResult unchanged', async () => {
    const criteria = new Criteria();
    const viewModel = buildViewModel();
    const paginatedResult = new PaginatedResult([viewModel], 1, 1, 10);
    readRepository.findByCriteria.mockResolvedValue(paginatedResult);
    const query = new NotificationFindByCriteriaQuery({ criteria });

    const result = await handler.execute(query);

    expect(readRepository.findByCriteria).toHaveBeenCalledWith(criteria);
    expect(result).toBe(paginatedResult);
  });

  it('returns an empty page rather than throwing when no results match', async () => {
    const criteria = new Criteria();
    const emptyResult = new PaginatedResult<NotificationViewModel>(
      [],
      0,
      1,
      10,
    );
    readRepository.findByCriteria.mockResolvedValue(emptyResult);
    const query = new NotificationFindByCriteriaQuery({ criteria });

    const result = await handler.execute(query);

    expect(result).toBe(emptyResult);
    expect(result.items).toEqual([]);
  });
});
