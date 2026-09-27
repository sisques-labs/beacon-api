import { Mocked, vi } from 'vitest';
import { Repository } from 'typeorm';

import { ClientAggregate } from '@contexts/clients/domain/aggregates/client.aggregate';
import { ClientBuilder } from '@contexts/clients/domain/builders/client.builder';
import { ClientEntity } from '@contexts/clients/infrastructure/persistence/typeorm/entities/client.entity';
import { ClientTypeormMapper } from '@contexts/clients/infrastructure/persistence/typeorm/mappers/client-typeorm.mapper';
import { ClientTypeormWriteRepository } from '@contexts/clients/infrastructure/persistence/typeorm/repositories/client-typeorm-write.repository';

const API_KEY_SECRET_HASH = 'a'.repeat(32) + 'b'.repeat(32);
const API_KEY_ID = 'a1b2c3d4e5f60718';

function buildAggregate(): ClientAggregate {
  return new ClientBuilder()
    .withId('11111111-1111-4111-8111-111111111111')
    .withTenantId('22222222-2222-4222-8222-222222222222')
    .withName('Acme Inc.')
    .withApiKeyId(API_KEY_ID)
    .withApiKeySecretHash(API_KEY_SECRET_HASH)
    .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .build();
}

describe('ClientTypeormWriteRepository', () => {
  let repository: ClientTypeormWriteRepository;
  let ormRepository: Mocked<Repository<ClientEntity>>;
  let mapper: Mocked<ClientTypeormMapper>;

  beforeEach(() => {
    ormRepository = {
      findOne: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<ClientEntity>>;
    mapper = {
      toAggregate: vi.fn(),
      toEntity: vi.fn(),
      toViewModel: vi.fn(),
    } as unknown as Mocked<ClientTypeormMapper>;
    repository = new ClientTypeormWriteRepository(ormRepository, mapper);
  });

  describe('findById', () => {
    it('returns null when no entity is found', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('unknown-id');

      expect(result).toBeNull();
    });

    it('maps the entity to an aggregate when found', async () => {
      const entity = new ClientEntity();
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

  describe('findByApiKeyId', () => {
    it('queries by apiKeyId and returns null when not found', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findByApiKeyId(API_KEY_ID);

      expect(ormRepository.findOne).toHaveBeenCalledWith({
        where: { apiKeyId: API_KEY_ID },
      });
      expect(result).toBeNull();
    });

    it('maps the entity to an aggregate when found', async () => {
      const entity = new ClientEntity();
      const aggregate = buildAggregate();
      ormRepository.findOne.mockResolvedValue(entity);
      mapper.toAggregate.mockReturnValue(aggregate);

      const result = await repository.findByApiKeyId(API_KEY_ID);

      expect(result).toBe(aggregate);
    });
  });

  describe('save', () => {
    it('persists the mapped entity (including the api key secret hash) and returns the mapped aggregate', async () => {
      const aggregate = buildAggregate();
      const entity = new ClientEntity();
      const savedEntity = new ClientEntity();
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
