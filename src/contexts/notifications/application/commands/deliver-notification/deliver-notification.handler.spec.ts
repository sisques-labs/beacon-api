import { EventPublisher } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import { DeliverNotificationCommandHandler } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.handler';
import { INotificationSenderPort } from '@contexts/notifications/application/ports/notification-sender.port';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
import { INotificationWriteRepository } from '@contexts/notifications/domain/repositories/write/notification-write.repository';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

function buildPendingAggregate(): NotificationAggregate {
  return new NotificationBuilder()
    .withId(NOTIFICATION_ID)
    .withTenantId('22222222-2222-4222-8222-222222222222')
    .withRecipientUserId('33333333-3333-4333-8333-333333333333')
    .withChannel(NotificationChannelEnum.DISCORD)
    .withTitle('Plant watered')
    .withBody('Your plant was watered successfully.')
    .withSourceService('gardenia-api')
    .withDedupeKey('gardenia:plant:1:watered')
    .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .build();
}

describe('DeliverNotificationCommandHandler', () => {
  let handler: DeliverNotificationCommandHandler;
  let writeRepository: Mocked<INotificationWriteRepository>;
  let senderPort: Mocked<INotificationSenderPort>;
  let publisher: Mocked<EventPublisher>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByDedupeKey: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<INotificationWriteRepository>;
    senderPort = {
      send: vi.fn(),
    } as unknown as Mocked<INotificationSenderPort>;
    publisher = {
      mergeObjectContext: vi.fn((aggregate: NotificationAggregate) => {
        aggregate.commit = vi.fn();
        return aggregate;
      }),
    } as unknown as Mocked<EventPublisher>;
    handler = new DeliverNotificationCommandHandler(
      writeRepository,
      senderPort,
      publisher,
    );
  });

  it('transitions the notification to SENT when the webhook post succeeds', async () => {
    const aggregate = buildPendingAggregate();
    const pendingPrimitives = aggregate.toPrimitives();
    writeRepository.findById.mockResolvedValue(aggregate);
    writeRepository.save.mockImplementation((entity) =>
      Promise.resolve(entity),
    );
    senderPort.send.mockResolvedValue({ success: true, failureReason: null });

    await handler.execute(
      new DeliverNotificationCommand({ notificationId: NOTIFICATION_ID }),
    );

    expect(senderPort.send).toHaveBeenCalledWith(pendingPrimitives);
    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    const saved = writeRepository.save.mock.calls[0][0];
    expect(saved.status.value).toBe('SENT');
    expect(saved.commit).toHaveBeenCalledTimes(1);
  });

  it('transitions the notification to FAILED with the failureReason when the webhook post fails', async () => {
    const aggregate = buildPendingAggregate();
    writeRepository.findById.mockResolvedValue(aggregate);
    writeRepository.save.mockImplementation((entity) =>
      Promise.resolve(entity),
    );
    senderPort.send.mockResolvedValue({
      success: false,
      failureReason: 'Discord webhook responded with status 500',
    });

    await handler.execute(
      new DeliverNotificationCommand({ notificationId: NOTIFICATION_ID }),
    );

    const saved = writeRepository.save.mock.calls[0][0];
    expect(saved.status.value).toBe('FAILED');
    expect(saved.failureReason?.value).toBe(
      'Discord webhook responded with status 500',
    );
  });

  it('throws NotificationNotFoundException and never calls the sender when the notification does not exist', async () => {
    writeRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new DeliverNotificationCommand({ notificationId: NOTIFICATION_ID }),
      ),
    ).rejects.toBeInstanceOf(NotificationNotFoundException);
    expect(senderPort.send).not.toHaveBeenCalled();
    expect(writeRepository.save).not.toHaveBeenCalled();
  });
});
