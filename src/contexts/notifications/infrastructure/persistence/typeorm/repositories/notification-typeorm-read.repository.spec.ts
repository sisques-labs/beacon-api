import { Mocked, vi } from 'vitest';
import { Repository } from 'typeorm';

import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-typeorm.mapper';
import { NotificationTypeormReadRepository } from '@contexts/notifications/infrastructure/persistence/typeorm/repositories/notification-typeorm-read.repository';
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

describe('NotificationTypeormReadRepository', () => {
  let repository: NotificationTypeormReadRepository;
  let ormRepository: Mocked<Repository<NotificationEntity>>;
  let mapper: Mocked<NotificationTypeormMapper>;

  beforeEach(() => {
    ormRepository = {
      findOne: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<NotificationEntity>>;
    mapper = {
      toAggregate: vi.fn(),
      toEntity: vi.fn(),
      toViewModel: vi.fn(),
    } as unknown as Mocked<NotificationTypeormMapper>;
    repository = new NotificationTypeormReadRepository(ormRepository, mapper);
  });

  describe('findById', () => {
    it('returns null when no entity is found', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('unknown-id');

      expect(result).toBeNull();
    });

    it('maps the entity to a view model when found', async () => {
      const entity = new NotificationEntity();
      const viewModel = buildViewModel();
      ormRepository.findOne.mockResolvedValue(entity);
      mapper.toViewModel.mockReturnValue(viewModel);

      const result = await repository.findById(
        '11111111-1111-4111-8111-111111111111',
      );

      expect(mapper.toViewModel).toHaveBeenCalledWith(entity);
      expect(result).toBe(viewModel);
    });
  });
});
