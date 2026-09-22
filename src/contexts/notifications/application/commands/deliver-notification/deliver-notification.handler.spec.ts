import { EventBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import { DeliverNotificationCommandHandler } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.handler';
import { INotificationSenderPort } from '@contexts/notifications/application/ports/notification-sender.port';
import { AssertNotificationAggregateExistsService } from '@contexts/notifications/application/services/write/assert-notification-aggregate-exists.service';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationDeliveryFailedException } from '@contexts/notifications/domain/exceptions/notification-delivery-failed.exception';
import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
import { INotificationWriteRepository } from '@contexts/notifications/domain/repositories/write/notification-write.repository';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

function buildAggregate(
  status: NotificationStatusEnum = NotificationStatusEnum.PENDING,
  deliveryMode: NotificationDeliveryModeEnum = NotificationDeliveryModeEnum.DELIVER,
): NotificationAggregate {
  return new NotificationBuilder()
    .withId(NOTIFICATION_ID)
    .withTenantId('22222222-2222-4222-8222-222222222222')
    .withRecipientUserId('33333333-3333-4333-8333-333333333333')
    .withChannel(NotificationChannelEnum.DISCORD)
    .withStatus(status)
    .withTitle('Plant watered')
    .withBody('Your plant was watered successfully.')
    .withSourceService('gardenia-api')
    .withDedupeKey('gardenia:plant:1:watered')
    .withDeliveryMode(deliveryMode)
    .withSentAt(status === NotificationStatusEnum.SENT ? new Date() : null)
    .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .build();
}

describe('DeliverNotificationCommandHandler', () => {
  let handler: DeliverNotificationCommandHandler;
  let writeRepository: Mocked<INotificationWriteRepository>;
  let senderPort: Mocked<INotificationSenderPort>;
  let assertNotificationAggregateExistsService: Mocked<AssertNotificationAggregateExistsService>;
  let eventBus: Mocked<EventBus>;

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
    assertNotificationAggregateExistsService = {
      execute: vi.fn(),
    } as unknown as Mocked<AssertNotificationAggregateExistsService>;
    eventBus = {
      publishAll: vi.fn(),
    } as unknown as Mocked<EventBus>;
    handler = new DeliverNotificationCommandHandler(
      writeRepository,
      senderPort,
      assertNotificationAggregateExistsService,
      eventBus,
    );
  });

  it('transitions the notification to SENT when the webhook post succeeds', async () => {
    const aggregate = buildAggregate();
    const pendingPrimitives = aggregate.toPrimitives();
    assertNotificationAggregateExistsService.execute.mockResolvedValue(
      aggregate,
    );
    writeRepository.save.mockImplementation((entity) =>
      Promise.resolve(entity),
    );
    senderPort.send.mockResolvedValue({ success: true, failureReason: null });

    await handler.execute(
      new DeliverNotificationCommand({
        notificationId: NOTIFICATION_ID,
        isFinalAttempt: false,
      }),
    );

    expect(
      assertNotificationAggregateExistsService.execute,
    ).toHaveBeenCalledWith(NOTIFICATION_ID);
    expect(senderPort.send).toHaveBeenCalledWith(pendingPrimitives);
    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    const saved = writeRepository.save.mock.calls[0][0];
    expect(saved.status.value).toBe('SENT');
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('throws NotificationNotFoundException and never calls the sender when the notification does not exist', async () => {
    assertNotificationAggregateExistsService.execute.mockRejectedValue(
      new NotificationNotFoundException(NOTIFICATION_ID),
    );

    await expect(
      handler.execute(
        new DeliverNotificationCommand({
          notificationId: NOTIFICATION_ID,
          isFinalAttempt: false,
        }),
      ),
    ).rejects.toBeInstanceOf(NotificationNotFoundException);
    expect(senderPort.send).not.toHaveBeenCalled();
    expect(writeRepository.save).not.toHaveBeenCalled();
  });

  describe('D5 — duplicate-send guard', () => {
    it('never calls the sender and returns without throwing when the aggregate is already SENT', async () => {
      const aggregate = buildAggregate(NotificationStatusEnum.SENT);
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );

      await handler.execute(
        new DeliverNotificationCommand({
          notificationId: NOTIFICATION_ID,
          isFinalAttempt: false,
        }),
      );

      expect(senderPort.send).not.toHaveBeenCalled();
      expect(writeRepository.save).not.toHaveBeenCalled();
      expect(eventBus.publishAll).not.toHaveBeenCalled();
    });

    it('never calls the sender when the aggregate is already FAILED', async () => {
      const aggregate = buildAggregate(NotificationStatusEnum.FAILED);
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );

      await handler.execute(
        new DeliverNotificationCommand({
          notificationId: NOTIFICATION_ID,
          isFinalAttempt: true,
        }),
      );

      expect(senderPort.send).not.toHaveBeenCalled();
    });
  });

  describe('D4 — retryable vs. terminal signalling', () => {
    it('throws NotificationDeliveryFailedException without calling fail()/save() on a non-final failed attempt', async () => {
      const aggregate = buildAggregate();
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );
      senderPort.send.mockResolvedValue({
        success: false,
        failureReason: 'Discord webhook responded with status 500',
      });

      await expect(
        handler.execute(
          new DeliverNotificationCommand({
            notificationId: NOTIFICATION_ID,
            isFinalAttempt: false,
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationDeliveryFailedException);

      expect(writeRepository.save).not.toHaveBeenCalled();
      expect(eventBus.publishAll).not.toHaveBeenCalled();
      expect(aggregate.status.value).toBe('PENDING');
    });

    it('persists FAILED then throws NotificationDeliveryFailedException on the final failed attempt', async () => {
      const aggregate = buildAggregate();
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );
      writeRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );
      senderPort.send.mockResolvedValue({
        success: false,
        failureReason: 'Discord webhook responded with status 500',
      });

      await expect(
        handler.execute(
          new DeliverNotificationCommand({
            notificationId: NOTIFICATION_ID,
            isFinalAttempt: true,
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationDeliveryFailedException);

      expect(writeRepository.save).toHaveBeenCalledTimes(1);
      const saved = writeRepository.save.mock.calls[0][0];
      expect(saved.status.value).toBe('FAILED');
      expect(saved.failureReason?.value).toBe(
        'Discord webhook responded with status 500',
      );
      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('RECORD_ONLY defense in depth', () => {
    it('never calls the sender, transitions to SKIPPED, and saves once for a PENDING RECORD_ONLY notification', async () => {
      const aggregate = buildAggregate(
        NotificationStatusEnum.PENDING,
        NotificationDeliveryModeEnum.RECORD_ONLY,
      );
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );
      writeRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      await handler.execute(
        new DeliverNotificationCommand({
          notificationId: NOTIFICATION_ID,
          isFinalAttempt: false,
        }),
      );

      expect(senderPort.send).not.toHaveBeenCalled();
      expect(writeRepository.save).toHaveBeenCalledTimes(1);
      const saved = writeRepository.save.mock.calls[0][0];
      expect(saved.status.value).toBe('SKIPPED');
      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    });

    it('leaves the existing early return unaffected for an already-SKIPPED notification', async () => {
      const aggregate = buildAggregate(
        NotificationStatusEnum.SKIPPED,
        NotificationDeliveryModeEnum.RECORD_ONLY,
      );
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );

      await handler.execute(
        new DeliverNotificationCommand({
          notificationId: NOTIFICATION_ID,
          isFinalAttempt: false,
        }),
      );

      expect(senderPort.send).not.toHaveBeenCalled();
      expect(writeRepository.save).not.toHaveBeenCalled();
      expect(eventBus.publishAll).not.toHaveBeenCalled();
    });
  });
});
