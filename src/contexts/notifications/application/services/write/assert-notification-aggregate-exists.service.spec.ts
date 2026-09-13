import { Mocked, vi } from 'vitest';

import { AssertNotificationAggregateExistsService } from '@contexts/notifications/application/services/write/assert-notification-aggregate-exists.service';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
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

describe('AssertNotificationAggregateExistsService', () => {
  let service: AssertNotificationAggregateExistsService;
  let writeRepository: Mocked<INotificationWriteRepository>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByDedupeKey: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<INotificationWriteRepository>;
    service = new AssertNotificationAggregateExistsService(writeRepository);
  });

  it('returns the aggregate when found', async () => {
    const aggregate = buildAggregate();
    writeRepository.findById.mockResolvedValue(aggregate);

    const result = await service.execute(aggregate.id.value);

    expect(result).toBe(aggregate);
  });

  it('throws NotificationNotFoundException when not found', async () => {
    writeRepository.findById.mockResolvedValue(null);

    await expect(service.execute('unknown-id')).rejects.toBeInstanceOf(
      NotificationNotFoundException,
    );
  });
});
