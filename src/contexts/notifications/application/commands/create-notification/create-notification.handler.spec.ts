import { EventPublisher } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { CreateNotificationCommandHandler } from '@contexts/notifications/application/commands/create-notification/create-notification.handler';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDedupeKeyAlreadyExistsException } from '@contexts/notifications/domain/exceptions/notification-dedupe-key-already-exists.exception';
import { INotificationWriteRepository } from '@contexts/notifications/domain/repositories/write/notification-write.repository';

const VALID_INPUT = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  recipientUserId: '22222222-2222-4222-8222-222222222222',
  channel: NotificationChannelEnum.DISCORD,
  title: 'Plant watered',
  body: 'Your plant was watered successfully.',
  sourceService: 'gardenia-api',
  dedupeKey: 'gardenia:plant:1:watered',
};

function buildAggregate(id: string): NotificationAggregate {
  return new NotificationBuilder()
    .withId(id)
    .withTenantId(VALID_INPUT.tenantId)
    .withRecipientUserId(VALID_INPUT.recipientUserId)
    .withChannel(VALID_INPUT.channel)
    .withTitle(VALID_INPUT.title)
    .withBody(VALID_INPUT.body)
    .withSourceService(VALID_INPUT.sourceService)
    .withDedupeKey(VALID_INPUT.dedupeKey)
    .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .build();
}

describe('CreateNotificationCommandHandler', () => {
  let handler: CreateNotificationCommandHandler;
  let writeRepository: Mocked<INotificationWriteRepository>;
  let publisher: Mocked<EventPublisher>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByDedupeKey: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<INotificationWriteRepository>;
    publisher = {
      mergeObjectContext: vi.fn((aggregate: NotificationAggregate) => {
        aggregate.commit = vi.fn();
        return aggregate;
      }),
    } as unknown as Mocked<EventPublisher>;
    handler = new CreateNotificationCommandHandler(writeRepository, publisher);
  });

  it('creates and persists a new PENDING notification when no dedupe match exists', async () => {
    writeRepository.findByDedupeKey.mockResolvedValue(null);
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );

    const result = await handler.execute(
      new CreateNotificationCommand(VALID_INPUT),
    );

    expect(writeRepository.findByDedupeKey).toHaveBeenCalledWith(
      VALID_INPUT.tenantId,
      VALID_INPUT.dedupeKey,
    );
    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    const savedAggregate = writeRepository.save.mock.calls[0][0];
    expect(savedAggregate.status.value).toBe('PENDING');
    expect(savedAggregate.commit).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(savedAggregate.id.value);
  });

  it('returns the existing notification id without saving when dedupeKey already exists', async () => {
    const existing = buildAggregate('33333333-3333-4333-8333-333333333333');
    writeRepository.findByDedupeKey.mockResolvedValue(existing);

    const result = await handler.execute(
      new CreateNotificationCommand(VALID_INPUT),
    );

    expect(result.id).toBe('33333333-3333-4333-8333-333333333333');
    expect(writeRepository.save).not.toHaveBeenCalled();
  });

  it('returns the winning notification id when save loses a dedupe race', async () => {
    const raceWinner = buildAggregate('44444444-4444-4444-8444-444444444444');
    writeRepository.findByDedupeKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(raceWinner);
    writeRepository.save.mockRejectedValue(
      new NotificationDedupeKeyAlreadyExistsException(
        VALID_INPUT.tenantId,
        VALID_INPUT.dedupeKey,
      ),
    );

    const result = await handler.execute(
      new CreateNotificationCommand(VALID_INPUT),
    );

    expect(result.id).toBe('44444444-4444-4444-8444-444444444444');
    expect(writeRepository.findByDedupeKey).toHaveBeenCalledTimes(2);
  });

  it('rethrows an unexpected save error unchanged', async () => {
    writeRepository.findByDedupeKey.mockResolvedValue(null);
    const unexpected = new Error('boom');
    writeRepository.save.mockRejectedValue(unexpected);

    await expect(
      handler.execute(new CreateNotificationCommand(VALID_INPUT)),
    ).rejects.toBe(unexpected);
  });
});
