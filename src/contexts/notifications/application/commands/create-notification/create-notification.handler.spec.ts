import { EventBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { CreateNotificationCommandHandler } from '@contexts/notifications/application/commands/create-notification/create-notification.handler';
import { FindNotificationByDedupeKeyService } from '@contexts/notifications/application/services/write/find-notification-by-dedupe-key/find-notification-by-dedupe-key.service';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';
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

describe('CreateNotificationCommandHandler', () => {
  let handler: CreateNotificationCommandHandler;
  let writeRepository: Mocked<INotificationWriteRepository>;
  let findNotificationByDedupeKeyService: Mocked<FindNotificationByDedupeKeyService>;
  let eventBus: Mocked<EventBus>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByDedupeKey: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<INotificationWriteRepository>;
    findNotificationByDedupeKeyService = {
      execute: vi.fn(),
    } as unknown as Mocked<FindNotificationByDedupeKeyService>;
    eventBus = {
      publishAll: vi.fn(),
    } as unknown as Mocked<EventBus>;
    handler = new CreateNotificationCommandHandler(
      writeRepository,
      findNotificationByDedupeKeyService,
      eventBus,
    );
  });

  it('creates and persists a new PENDING notification when no dedupe match exists', async () => {
    findNotificationByDedupeKeyService.execute.mockResolvedValue(null);
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );

    const result = await handler.execute(
      new CreateNotificationCommand(VALID_INPUT),
    );

    expect(findNotificationByDedupeKeyService.execute).toHaveBeenCalledWith({
      tenantId: VALID_INPUT.tenantId,
      dedupeKey: VALID_INPUT.dedupeKey,
    });
    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    const savedAggregate = writeRepository.save.mock.calls[0][0];
    expect(savedAggregate.status.value).toBe('PENDING');
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(savedAggregate.id.value);
  });

  it('returns the existing notification id without saving when dedupeKey already exists', async () => {
    findNotificationByDedupeKeyService.execute.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
    });

    const result = await handler.execute(
      new CreateNotificationCommand(VALID_INPUT),
    );

    expect(result.id).toBe('33333333-3333-4333-8333-333333333333');
    expect(writeRepository.save).not.toHaveBeenCalled();
  });

  it('returns the winning notification id when save loses a dedupe race', async () => {
    findNotificationByDedupeKeyService.execute
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: '44444444-4444-4444-8444-444444444444' });
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
    expect(findNotificationByDedupeKeyService.execute).toHaveBeenCalledTimes(2);
  });

  it('rethrows an unexpected save error unchanged', async () => {
    findNotificationByDedupeKeyService.execute.mockResolvedValue(null);
    const unexpected = new Error('boom');
    writeRepository.save.mockRejectedValue(unexpected);

    await expect(
      handler.execute(new CreateNotificationCommand(VALID_INPUT)),
    ).rejects.toBe(unexpected);
  });

  describe('deliveryMode', () => {
    it('saves the aggregate as SKIPPED, with a single save call, when deliveryMode is RECORD_ONLY', async () => {
      findNotificationByDedupeKeyService.execute.mockResolvedValue(null);
      writeRepository.save.mockImplementation((aggregate) =>
        Promise.resolve(aggregate),
      );

      const result = await handler.execute(
        new CreateNotificationCommand({
          ...VALID_INPUT,
          deliveryMode: NotificationDeliveryModeEnum.RECORD_ONLY,
        }),
      );

      expect(writeRepository.save).toHaveBeenCalledTimes(1);
      const savedAggregate = writeRepository.save.mock.calls[0][0];
      expect(savedAggregate.status.value).toBe('SKIPPED');
      expect(savedAggregate.deliveryMode.value).toBe('RECORD_ONLY');
      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(savedAggregate.id.value);
    });

    it('saves the aggregate as PENDING when deliveryMode is DELIVER (regression)', async () => {
      findNotificationByDedupeKeyService.execute.mockResolvedValue(null);
      writeRepository.save.mockImplementation((aggregate) =>
        Promise.resolve(aggregate),
      );

      await handler.execute(
        new CreateNotificationCommand({
          ...VALID_INPUT,
          deliveryMode: NotificationDeliveryModeEnum.DELIVER,
        }),
      );

      const savedAggregate = writeRepository.save.mock.calls[0][0];
      expect(savedAggregate.status.value).toBe('PENDING');
      expect(savedAggregate.deliveryMode.value).toBe('DELIVER');
    });
  });
});
