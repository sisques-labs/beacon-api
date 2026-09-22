import { Mocked, vi } from 'vitest';

import { DeliverNotificationOnCreatedHandler } from '@contexts/notifications/application/events/deliver-notification-on-created.handler';
import { INotificationDeliveryQueuePort } from '@contexts/notifications/application/ports/notification-delivery-queue.port';
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
  deliveryMode: 'DELIVER',
  failureReason: null,
  sentAt: null,
  readAt: null,
  cancelledAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('DeliverNotificationOnCreatedHandler', () => {
  let handler: DeliverNotificationOnCreatedHandler;
  let queuePort: Mocked<INotificationDeliveryQueuePort>;

  beforeEach(() => {
    queuePort = {
      enqueue: vi.fn(),
    } as unknown as Mocked<INotificationDeliveryQueuePort>;
    handler = new DeliverNotificationOnCreatedHandler(queuePort);
  });

  it('enqueues the created notification id for durable delivery', async () => {
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

    expect(queuePort.enqueue).toHaveBeenCalledTimes(1);
    expect(queuePort.enqueue).toHaveBeenCalledWith(NOTIFICATION_ID);
  });

  it('does not enqueue when deliveryMode is RECORD_ONLY', async () => {
    const event = new NotificationCreatedEvent(
      {
        eventType: 'NotificationCreatedEvent',
        aggregateRootId: NOTIFICATION_ID,
        aggregateRootType: 'NotificationAggregate',
        entityId: NOTIFICATION_ID,
        entityType: 'Notification',
      },
      { ...EVENT_DATA, deliveryMode: 'RECORD_ONLY', status: 'SKIPPED' },
    );

    await handler.handle(event);

    expect(queuePort.enqueue).not.toHaveBeenCalled();
  });
});
