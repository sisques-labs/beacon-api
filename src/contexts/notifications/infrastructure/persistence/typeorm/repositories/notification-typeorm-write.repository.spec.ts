import { Mocked, vi } from 'vitest';
import { QueryFailedError, Repository } from 'typeorm';

import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationDedupeKeyAlreadyExistsException } from '@contexts/notifications/domain/exceptions/notification-dedupe-key-already-exists.exception';
import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-typeorm.mapper';
import { NotificationTypeormWriteRepository } from '@contexts/notifications/infrastructure/persistence/typeorm/repositories/notification-typeorm-write.repository';

function buildAggregate(): NotificationAggregate {
  return new NotificationBuilder()
    .withId('11111111-1111-4111-8111-111111111111')
    .withTenantId('22222222-2222-4222-8222-222222222222')
    .withRecipientUserId('33333333-3333-4333-8333-333333333333')
    .withChannel('DISCORD')
    .withTitle('Title')
    .withBody('Body')
    .withSourceService('gardenia')
    .withDedupeKey('dedupe-key-1')
    .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .build();
}

describe('NotificationTypeormWriteRepository', () => {
  let repository: NotificationTypeormWriteRepository;
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
    repository = new NotificationTypeormWriteRepository(ormRepository, mapper);
  });

  describe('findById', () => {
    it('returns null when no entity is found', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('unknown-id');

      expect(result).toBeNull();
    });

    it('maps the entity to an aggregate when found', async () => {
      const entity = new NotificationEntity();
      const aggregate = buildAggregate();
      ormRepository.findOne.mockResolvedValue(entity);
      mapper.toAggregate.mockReturnValue(aggregate);

      const result = await repository.findById(
        '11111111-1111-4111-8111-111111111111',
      );

      expect(mapper.toAggregate).toHaveBeenCalledWith(entity);
      expect(result).toBe(aggregate);
    });
  });

  describe('findByDedupeKey', () => {
    it('queries by tenantId and dedupeKey and returns null when not found', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findByDedupeKey('tenant-1', 'dedupe-1');

      expect(ormRepository.findOne).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', dedupeKey: 'dedupe-1' },
      });
      expect(result).toBeNull();
    });

    it('maps the entity to an aggregate when found', async () => {
      const entity = new NotificationEntity();
      const aggregate = buildAggregate();
      ormRepository.findOne.mockResolvedValue(entity);
      mapper.toAggregate.mockReturnValue(aggregate);

      const result = await repository.findByDedupeKey('tenant-1', 'dedupe-1');

      expect(result).toBe(aggregate);
    });
  });

  describe('save', () => {
    it('persists the mapped entity and returns the mapped aggregate', async () => {
      const aggregate = buildAggregate();
      const entity = new NotificationEntity();
      const savedEntity = new NotificationEntity();
      mapper.toEntity.mockReturnValue(entity);
      ormRepository.save.mockResolvedValue(savedEntity);
      mapper.toAggregate.mockReturnValue(aggregate);

      const result = await repository.save(aggregate);

      expect(ormRepository.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(aggregate);
    });

    it('translates a unique-violation (23505) into NotificationDedupeKeyAlreadyExistsException', async () => {
      const aggregate = buildAggregate();
      mapper.toEntity.mockReturnValue(new NotificationEntity());
      const driverError = { code: '23505' };
      ormRepository.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], driverError as unknown as Error),
      );

      await expect(repository.save(aggregate)).rejects.toBeInstanceOf(
        NotificationDedupeKeyAlreadyExistsException,
      );
    });

    it('rethrows any other error unchanged', async () => {
      const aggregate = buildAggregate();
      mapper.toEntity.mockReturnValue(new NotificationEntity());
      const unexpected = new Error('boom');
      ormRepository.save.mockRejectedValue(unexpected);

      await expect(repository.save(aggregate)).rejects.toBe(unexpected);
    });
  });

  describe('delete', () => {
    it('delegates to the underlying repository', async () => {
      await repository.delete('11111111-1111-4111-8111-111111111111');

      expect(ormRepository.delete).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
      );
    });
  });
});
