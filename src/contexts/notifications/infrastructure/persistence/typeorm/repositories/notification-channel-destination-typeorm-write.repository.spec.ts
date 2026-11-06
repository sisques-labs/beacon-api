import { Mocked, vi } from 'vitest';
import { Repository } from 'typeorm';

import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';
import { NotificationChannelDestinationBuilder } from '@contexts/notifications/domain/builders/notification-channel-destination.builder';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelDestinationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification-channel-destination.entity';
import { NotificationChannelDestinationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-channel-destination-typeorm.mapper';
import { NotificationChannelDestinationTypeormWriteRepository } from '@contexts/notifications/infrastructure/persistence/typeorm/repositories/notification-channel-destination-typeorm-write.repository';

const ENVELOPE =
  'v1:aaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:Y2lwaGVydGV4dA';

function buildAggregate(): NotificationChannelDestinationAggregate {
  return new NotificationChannelDestinationBuilder()
    .withId('11111111-1111-4111-8111-111111111111')
    .withTenantId('22222222-2222-4222-8222-222222222222')
    .withChannel(NotificationChannelEnum.DISCORD)
    .withEnvelope(ENVELOPE)
    .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .build();
}

describe('NotificationChannelDestinationTypeormWriteRepository', () => {
  let repository: NotificationChannelDestinationTypeormWriteRepository;
  let ormRepository: Mocked<Repository<NotificationChannelDestinationEntity>>;
  let mapper: Mocked<NotificationChannelDestinationTypeormMapper>;

  beforeEach(() => {
    ormRepository = {
      findOne: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<NotificationChannelDestinationEntity>>;
    mapper = {
      toAggregate: vi.fn(),
      toEntity: vi.fn(),
      toViewModel: vi.fn(),
    } as unknown as Mocked<NotificationChannelDestinationTypeormMapper>;
    repository = new NotificationChannelDestinationTypeormWriteRepository(
      ormRepository,
      mapper,
    );
  });

  describe('findById', () => {
    it('returns null when no entity is found', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('unknown-id');

      expect(result).toBeNull();
    });

    it('maps the entity to an aggregate when found', async () => {
      const entity = new NotificationChannelDestinationEntity();
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

  describe('findByTenantAndChannel', () => {
    it('queries by tenantId and channel and returns null when not found', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findByTenantAndChannel(
        'tenant-1',
        NotificationChannelEnum.DISCORD,
      );

      expect(ormRepository.findOne).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          channel: NotificationChannelEnum.DISCORD,
        },
      });
      expect(result).toBeNull();
    });

    it('maps the entity to an aggregate when found', async () => {
      const entity = new NotificationChannelDestinationEntity();
      const aggregate = buildAggregate();
      ormRepository.findOne.mockResolvedValue(entity);
      mapper.toAggregate.mockReturnValue(aggregate);

      const result = await repository.findByTenantAndChannel(
        'tenant-1',
        NotificationChannelEnum.DISCORD,
      );

      expect(result).toBe(aggregate);
    });
  });

  describe('save', () => {
    it('persists the mapped entity (including the envelope) and returns the mapped aggregate', async () => {
      const aggregate = buildAggregate();
      const entity = new NotificationChannelDestinationEntity();
      const savedEntity = new NotificationChannelDestinationEntity();
      mapper.toEntity.mockReturnValue(entity);
      ormRepository.save.mockResolvedValue(savedEntity);
      mapper.toAggregate.mockReturnValue(aggregate);

      const result = await repository.save(aggregate);

      expect(mapper.toEntity).toHaveBeenCalledWith(aggregate);
      expect(ormRepository.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(aggregate);
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
