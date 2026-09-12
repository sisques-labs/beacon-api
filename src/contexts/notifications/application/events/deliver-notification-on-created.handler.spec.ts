import { CommandBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import { DeliverNotificationOnCreatedHandler } from '@contexts/notifications/application/events/deliver-notification-on-created.handler';
import { NotificationCreatedEvent } from '@contexts/notifications/domain/events/notification-created/notification-created.event';
import { INotificationEventData } from '@contexts/notifications/domain/events/interfaces/notification-event-data.interface';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

const EVENT_DATA: INotificationEventData = {
  id: NOTIFICATION_ID,
  tenantId: '22222222-2222-4222-8222-222222222222',
  recipientUserId: '33333333-3333-4333-8333-333333333333',
  channel: 'DISCORD',
  status: 'PENDING',
  title: 'Plant watered',
  body: 'Your plant was watered successfully.',
  sourceService: 'gardenia-api',
  dedupeKey: 'gardenia:plant:1:watered',
  failureReason: null,
  sentAt: null,
  readAt: null,
  cancelledAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('DeliverNotificationOnCreatedHandler', () => {
  let handler: DeliverNotificationOnCreatedHandler;
  let commandBus: Mocked<CommandBus>;

  beforeEach(() => {
    commandBus = { execute: vi.fn() } as unknown as Mocked<CommandBus>;
    handler = new DeliverNotificationOnCreatedHandler(commandBus);
  });

  it('dispatches DeliverNotificationCommand with the created notification id', async () => {
    const event = new NotificationCreatedEvent(
      {
        eventType: 'NotificationCreatedEvent',
        aggregateRootId: NOTIFICATION_ID,
        aggregateRootType: 'NotificationAggregate',
        entityId: NOTIFICATION_ID,
        entityType: 'Notification',
      },
      EVENT_DATA,
    );

    await handler.handle(event);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const dispatched = commandBus.execute.mock
      .calls[0][0] as DeliverNotificationCommand;
    expect(dispatched).toBeInstanceOf(DeliverNotificationCommand);
    expect(dispatched.notificationId.value).toBe(NOTIFICATION_ID);
  });
});
