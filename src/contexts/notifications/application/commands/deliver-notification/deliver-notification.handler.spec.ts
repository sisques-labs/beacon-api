import { EventBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import { DeliverNotificationCommandHandler } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.handler';
import { INotificationDeliveryDestination } from '@contexts/notifications/application/ports/notification-delivery-destination.interface';
import { INotificationSenderPort } from '@contexts/notifications/application/ports/notification-sender.port';
import { AssertNotificationAggregateExistsService } from '@contexts/notifications/application/services/write/assert-notification-aggregate-exists.service';
import { ResolveNotificationDeliveryDestinationService } from '@contexts/notifications/application/services/write/resolve-notification-delivery-destination/resolve-notification-delivery-destination.service';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationFailureReasonCodeEnum } from '@contexts/notifications/domain/enums/notification-failure-reason-code.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationDeliveryFailedException } from '@contexts/notifications/domain/exceptions/notification-delivery-failed.exception';
import { NotificationDestinationNotConfiguredException } from '@contexts/notifications/domain/exceptions/notification-destination-not-configured.exception';
import { NotificationDestinationUnreadableException } from '@contexts/notifications/domain/exceptions/notification-destination-unreadable.exception';
import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
import { INotificationWriteRepository } from '@contexts/notifications/domain/repositories/write/notification-write.repository';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const DESTINATION: INotificationDeliveryDestination = {
  url: 'https://discord.com/api/webhooks/123456789012345678/aValidToken',
  logLabel: 'discord:webhook/123456789012345678',
};

function buildAggregate(
  status: NotificationStatusEnum = NotificationStatusEnum.PENDING,
): NotificationAggregate {
  return new NotificationBuilder()
    .withId(NOTIFICATION_ID)
    .withTenantId(TENANT_ID)
    .withRecipientUserId('33333333-3333-4333-8333-333333333333')
    .withChannel(NotificationChannelEnum.DISCORD)
    .withStatus(status)
    .withTitle('Plant watered')
    .withBody('Your plant was watered successfully.')
    .withSourceService('gardenia-api')
    .withDedupeKey('gardenia:plant:1:watered')
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
  let resolveNotificationDeliveryDestinationService: Mocked<ResolveNotificationDeliveryDestinationService>;
  let eventBus: Mocked<EventBus>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByDedupeKey: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      // Defaults to "row still exists" (an atomic UPDATE affected a row —
      // see `NotificationTypeormWriteRepository.updateIfExists()`) so every
      // pre-existing test that never sets this up explicitly keeps
      // observing a persisted terminal state; individual "deleted
      // mid-flight" tests override this to `false`.
      updateIfExists: vi.fn().mockResolvedValue(true),
      delete: vi.fn(),
    } as unknown as Mocked<INotificationWriteRepository>;
    senderPort = {
      send: vi.fn(),
    } as unknown as Mocked<INotificationSenderPort>;
    assertNotificationAggregateExistsService = {
      execute: vi.fn(),
    } as unknown as Mocked<AssertNotificationAggregateExistsService>;
    resolveNotificationDeliveryDestinationService = {
      execute: vi.fn().mockResolvedValue(DESTINATION),
    } as unknown as Mocked<ResolveNotificationDeliveryDestinationService>;
    eventBus = {
      publishAll: vi.fn(),
    } as unknown as Mocked<EventBus>;
    handler = new DeliverNotificationCommandHandler(
      writeRepository,
      senderPort,
      assertNotificationAggregateExistsService,
      resolveNotificationDeliveryDestinationService,
      eventBus,
    );
  });

  it('transitions the notification to SENT when the webhook post succeeds', async () => {
    const aggregate = buildAggregate();
    const pendingPrimitives = aggregate.toPrimitives();
    assertNotificationAggregateExistsService.execute.mockResolvedValue(
      aggregate,
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
    expect(
      resolveNotificationDeliveryDestinationService.execute,
    ).toHaveBeenCalledWith({ tenantId: TENANT_ID, channel: 'DISCORD' });
    expect(senderPort.send).toHaveBeenCalledWith(
      pendingPrimitives,
      DESTINATION,
    );
    expect(writeRepository.updateIfExists).toHaveBeenCalledTimes(1);
    const saved = writeRepository.updateIfExists.mock.calls[0][0];
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
    expect(writeRepository.updateIfExists).not.toHaveBeenCalled();
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
      expect(writeRepository.updateIfExists).not.toHaveBeenCalled();
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
    it('throws NotificationDeliveryFailedException without calling fail()/persist() on a non-final failed attempt', async () => {
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

      expect(writeRepository.updateIfExists).not.toHaveBeenCalled();
      expect(eventBus.publishAll).not.toHaveBeenCalled();
      expect(aggregate.status.value).toBe('PENDING');
    });

    it('persists FAILED then throws NotificationDeliveryFailedException on the final failed attempt', async () => {
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
            isFinalAttempt: true,
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationDeliveryFailedException);

      expect(writeRepository.updateIfExists).toHaveBeenCalledTimes(1);
      const saved = writeRepository.updateIfExists.mock.calls[0][0];
      expect(saved.status.value).toBe('FAILED');
      expect(saved.failureReason?.value).toBe(
        'Discord webhook responded with status 500',
      );
      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('D1/D3 — fail-closed destination resolution', () => {
    it('fails closed with DESTINATION_NOT_CONFIGURED when no destination is registered, without calling the sender', async () => {
      const aggregate = buildAggregate();
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );
      resolveNotificationDeliveryDestinationService.execute.mockResolvedValue(
        undefined,
      );

      await expect(
        handler.execute(
          new DeliverNotificationCommand({
            notificationId: NOTIFICATION_ID,
            isFinalAttempt: false,
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationDestinationNotConfiguredException);

      expect(senderPort.send).not.toHaveBeenCalled();
      expect(writeRepository.updateIfExists).toHaveBeenCalledTimes(1);
      const saved = writeRepository.updateIfExists.mock.calls[0][0];
      expect(saved.status.value).toBe('FAILED');
      expect(saved.failureReason?.value).toBe(
        NotificationFailureReasonCodeEnum.DESTINATION_NOT_CONFIGURED,
      );
      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    });

    it('fails closed with DESTINATION_UNREADABLE when the destination cannot be decrypted, without calling the sender', async () => {
      const aggregate = buildAggregate();
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );
      resolveNotificationDeliveryDestinationService.execute.mockRejectedValue(
        new Error('tag mismatch'),
      );

      await expect(
        handler.execute(
          new DeliverNotificationCommand({
            notificationId: NOTIFICATION_ID,
            isFinalAttempt: false,
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationDestinationUnreadableException);

      expect(senderPort.send).not.toHaveBeenCalled();
      expect(writeRepository.updateIfExists).toHaveBeenCalledTimes(1);
      const saved = writeRepository.updateIfExists.mock.calls[0][0];
      expect(saved.status.value).toBe('FAILED');
      expect(saved.failureReason?.value).toBe(
        NotificationFailureReasonCodeEnum.DESTINATION_UNREADABLE,
      );
      expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    });

    it('sends the destination the sender port resolved on a healthy DISCORD notification', async () => {
      const aggregate = buildAggregate();
      const pendingPrimitives = aggregate.toPrimitives();
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );
      senderPort.send.mockResolvedValue({ success: true, failureReason: null });

      await handler.execute(
        new DeliverNotificationCommand({
          notificationId: NOTIFICATION_ID,
          isFinalAttempt: false,
        }),
      );

      expect(senderPort.send).toHaveBeenCalledWith(
        pendingPrimitives,
        DESTINATION,
      );
    });

    it.each([NotificationChannelEnum.EMAIL, NotificationChannelEnum.PUSH])(
      'always fails closed with DESTINATION_NOT_CONFIGURED for %s notifications',
      async (channel) => {
        const aggregate = new NotificationBuilder()
          .withId(NOTIFICATION_ID)
          .withTenantId(TENANT_ID)
          .withRecipientUserId('33333333-3333-4333-8333-333333333333')
          .withChannel(channel)
          .withStatus(NotificationStatusEnum.PENDING)
          .withTitle('Plant watered')
          .withBody('Your plant was watered successfully.')
          .withSourceService('gardenia-api')
          .withDedupeKey(`gardenia:plant:${channel}:watered`)
          .withSentAt(null)
          .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
          .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
          .build();
        assertNotificationAggregateExistsService.execute.mockResolvedValue(
          aggregate,
        );
        resolveNotificationDeliveryDestinationService.execute.mockResolvedValue(
          undefined,
        );

        await expect(
          handler.execute(
            new DeliverNotificationCommand({
              notificationId: NOTIFICATION_ID,
              isFinalAttempt: false,
            }),
          ),
        ).rejects.toBeInstanceOf(NotificationDestinationNotConfiguredException);

        expect(
          resolveNotificationDeliveryDestinationService.execute,
        ).toHaveBeenCalledWith({ tenantId: TENANT_ID, channel });
        expect(senderPort.send).not.toHaveBeenCalled();
      },
    );
  });

  describe('resurrection guard — the notification row was deleted mid-flight', () => {
    it('skips persistence (but still resolves normally) when a successful send finds the row gone', async () => {
      const aggregate = buildAggregate();
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );
      senderPort.send.mockResolvedValue({ success: true, failureReason: null });
      writeRepository.updateIfExists.mockResolvedValue(false);

      await handler.execute(
        new DeliverNotificationCommand({
          notificationId: NOTIFICATION_ID,
          isFinalAttempt: false,
        }),
      );

      expect(writeRepository.updateIfExists).toHaveBeenCalledTimes(1);
      expect(eventBus.publishAll).not.toHaveBeenCalled();
    });

    it('skips publishing but still throws when the final failed send finds the row gone', async () => {
      const aggregate = buildAggregate();
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );
      senderPort.send.mockResolvedValue({
        success: false,
        failureReason: 'Discord webhook responded with status 500',
      });
      writeRepository.updateIfExists.mockResolvedValue(false);

      await expect(
        handler.execute(
          new DeliverNotificationCommand({
            notificationId: NOTIFICATION_ID,
            isFinalAttempt: true,
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationDeliveryFailedException);

      expect(eventBus.publishAll).not.toHaveBeenCalled();
    });

    it('skips publishing but still throws NotificationDestinationNotConfiguredException when the row is gone', async () => {
      const aggregate = buildAggregate();
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );
      resolveNotificationDeliveryDestinationService.execute.mockResolvedValue(
        undefined,
      );
      writeRepository.updateIfExists.mockResolvedValue(false);

      await expect(
        handler.execute(
          new DeliverNotificationCommand({
            notificationId: NOTIFICATION_ID,
            isFinalAttempt: false,
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationDestinationNotConfiguredException);

      expect(eventBus.publishAll).not.toHaveBeenCalled();
    });

    it('skips publishing but still throws NotificationDestinationUnreadableException when the row is gone', async () => {
      const aggregate = buildAggregate();
      assertNotificationAggregateExistsService.execute.mockResolvedValue(
        aggregate,
      );
      resolveNotificationDeliveryDestinationService.execute.mockRejectedValue(
        new Error('tag mismatch'),
      );
      writeRepository.updateIfExists.mockResolvedValue(false);

      await expect(
        handler.execute(
          new DeliverNotificationCommand({
            notificationId: NOTIFICATION_ID,
            isFinalAttempt: false,
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationDestinationUnreadableException);

      expect(eventBus.publishAll).not.toHaveBeenCalled();
    });
  });
});
