import { Mocked, vi } from 'vitest';
import { Repository } from 'typeorm';

import { ClientViewModel } from '@contexts/clients/domain/view-models/client.view-model';
import { ClientEntity } from '@contexts/clients/infrastructure/persistence/typeorm/entities/client.entity';
import { ClientTypeormMapper } from '@contexts/clients/infrastructure/persistence/typeorm/mappers/client-typeorm.mapper';
import { ClientTypeormReadRepository } from '@contexts/clients/infrastructure/persistence/typeorm/repositories/client-typeorm-read.repository';

const METADATA_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  apiKeyId: true,
  apiKeyRotatedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
};

function buildViewModel(): ClientViewModel {
  return new ClientViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    name: 'Acme Inc.',
    apiKeyId: 'a1b2c3d4e5f60718',
    apiKeyRotatedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('ClientTypeormReadRepository', () => {
  let repository: ClientTypeormReadRepository;
  let ormRepository: Mocked<Repository<ClientEntity>>;
  let mapper: Mocked<ClientTypeormMapper>;

  beforeEach(() => {
    ormRepository = {
      findOne: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<ClientEntity>>;
    mapper = {
      toAggregate: vi.fn(),
      toEntity: vi.fn(),
      toViewModel: vi.fn(),
    } as unknown as Mocked<ClientTypeormMapper>;
    repository = new ClientTypeormReadRepository(ormRepository, mapper);
  });

  describe('findById', () => {
    it('returns null when no entity is found', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('unknown-id');

      expect(result).toBeNull();
    });

    it('selects metadata columns only — never apiKeySecretHash (D17, mirrors D10)', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      await repository.findById('11111111-1111-4111-8111-111111111111');

      expect(ormRepository.findOne).toHaveBeenCalledWith({
        where: { id: '11111111-1111-4111-8111-111111111111' },
        select: METADATA_SELECT,
      });
    });

    it('maps the entity to a view model when found', async () => {
      const entity = new ClientEntity();
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

  describe('save', () => {
    it('performs a metadata-only update, never touching apiKeySecretHash (D17, mirrors D10)', async () => {
      const viewModel = buildViewModel();

      await repository.save(viewModel);

      expect(ormRepository.update).toHaveBeenCalledWith(viewModel.id, {
        tenantId: viewModel.tenantId,
        name: viewModel.name,
        apiKeyId: viewModel.apiKeyId,
        apiKeyRotatedAt: viewModel.apiKeyRotatedAt,
        revokedAt: viewModel.revokedAt,
        updatedAt: viewModel.updatedAt,
      });
      expect(ormRepository.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ apiKeySecretHash: expect.anything() }),
      );
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
