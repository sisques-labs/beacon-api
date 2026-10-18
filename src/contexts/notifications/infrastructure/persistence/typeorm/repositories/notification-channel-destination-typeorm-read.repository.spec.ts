import { Mocked, vi } from 'vitest';
import { Repository } from 'typeorm';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';
import { NotificationChannelDestinationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification-channel-destination.entity';
import { NotificationChannelDestinationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-channel-destination-typeorm.mapper';
import { NotificationChannelDestinationTypeormReadRepository } from '@contexts/notifications/infrastructure/persistence/typeorm/repositories/notification-channel-destination-typeorm-read.repository';

const METADATA_SELECT = {
  id: true,
  tenantId: true,
  channel: true,
  createdAt: true,
  updatedAt: true,
};

function buildViewModel(): NotificationChannelDestinationViewModel {
  return new NotificationChannelDestinationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    channel: NotificationChannelEnum.DISCORD,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationChannelDestinationTypeormReadRepository', () => {
  let repository: NotificationChannelDestinationTypeormReadRepository;
  let ormRepository: Mocked<Repository<NotificationChannelDestinationEntity>>;
  let mapper: Mocked<NotificationChannelDestinationTypeormMapper>;

  beforeEach(() => {
    ormRepository = {
      findOne: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<NotificationChannelDestinationEntity>>;
    mapper = {
      toAggregate: vi.fn(),
      toEntity: vi.fn(),
      toViewModel: vi.fn(),
    } as unknown as Mocked<NotificationChannelDestinationTypeormMapper>;
    repository = new NotificationChannelDestinationTypeormReadRepository(
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

    it('selects metadata columns only — never encryptedAddress (D10)', async () => {
      ormRepository.findOne.mockResolvedValue(null);

      await repository.findById('11111111-1111-4111-8111-111111111111');

      expect(ormRepository.findOne).toHaveBeenCalledWith({
        where: { id: '11111111-1111-4111-8111-111111111111' },
        select: METADATA_SELECT,
      });
    });

    it('maps the entity to a view model when found', async () => {
      const entity = new NotificationChannelDestinationEntity();
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

  describe('findByTenantAndChannel', () => {
    it('selects metadata columns only — never encryptedAddress (D10)', async () => {
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
        select: METADATA_SELECT,
      });
      expect(result).toBeNull();
    });

    it('maps the entity to a view model when found', async () => {
      const entity = new NotificationChannelDestinationEntity();
      const viewModel = buildViewModel();
      ormRepository.findOne.mockResolvedValue(entity);
      mapper.toViewModel.mockReturnValue(viewModel);

      const result = await repository.findByTenantAndChannel(
        'tenant-1',
        NotificationChannelEnum.DISCORD,
      );

      expect(result).toBe(viewModel);
    });
  });

  describe('save', () => {
    it('performs a metadata-only update, never touching encryptedAddress (D10)', async () => {
      const viewModel = buildViewModel();

      await repository.save(viewModel);

      expect(ormRepository.update).toHaveBeenCalledWith(viewModel.id, {
        tenantId: viewModel.tenantId,
        channel: viewModel.channel,
        updatedAt: viewModel.updatedAt,
      });
      expect(ormRepository.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ encryptedAddress: expect.anything() }),
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
