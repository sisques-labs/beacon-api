import { Mocked, vi } from 'vitest';

import { FindNotificationByDedupeKeyService } from '@contexts/notifications/application/services/write/find-notification-by-dedupe-key/find-notification-by-dedupe-key.service';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { INotificationWriteRepository } from '@contexts/notifications/domain/repositories/write/notification-write.repository';

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

describe('FindNotificationByDedupeKeyService', () => {
  let service: FindNotificationByDedupeKeyService;
  let writeRepository: Mocked<INotificationWriteRepository>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByDedupeKey: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<INotificationWriteRepository>;
    service = new FindNotificationByDedupeKeyService(writeRepository);
  });

  it('returns the aggregate when a match is found', async () => {
    const aggregate = buildAggregate();
    writeRepository.findByDedupeKey.mockResolvedValue(aggregate);

    const result = await service.execute({
      tenantId: aggregate.tenantId.value,
      dedupeKey: aggregate.dedupeKey.value,
    });

    expect(result).toBe(aggregate);
    expect(writeRepository.findByDedupeKey).toHaveBeenCalledWith(
      aggregate.tenantId.value,
      aggregate.dedupeKey.value,
    );
  });

  it('returns null when no match is found', async () => {
    writeRepository.findByDedupeKey.mockResolvedValue(null);

    const result = await service.execute({
      tenantId: 'tenant-1',
      dedupeKey: 'unknown-key',
    });

    expect(result).toBeNull();
  });
});
