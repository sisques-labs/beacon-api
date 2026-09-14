import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import {
  INotificationDeliveryQueuePort,
  NOTIFICATION_DELIVERY_QUEUE_PORT,
} from '@contexts/notifications/application/ports/notification-delivery-queue.port';
import { NotificationCreatedEvent } from '@contexts/notifications/domain/events/notification-created/notification-created.event';

/**
 * Triggers durable, retrying delivery right after a notification is
 * persisted.
 *
 * Enqueuing through the port instead of dispatching
 * `DeliverNotificationCommand` directly (or awaiting delivery inline) keeps
 * `CreateNotificationCommandHandler` (and therefore Kafka ingestion) from
 * ever blocking on Discord latency, and survives a crash between enqueue
 * and delivery — see design.md D2/D6.
 */
@EventsHandler(NotificationCreatedEvent)
export class DeliverNotificationOnCreatedHandler implements IEventHandler<NotificationCreatedEvent> {
  private readonly logger = new Logger(
    DeliverNotificationOnCreatedHandler.name,
  );

  constructor(
    @Inject(NOTIFICATION_DELIVERY_QUEUE_PORT)
    private readonly deliveryQueuePort: INotificationDeliveryQueuePort,
  ) {}

  async handle(event: NotificationCreatedEvent): Promise<void> {
    this.logger.log(`Enqueuing delivery for notification ${event.data.id}`);
    await this.deliveryQueuePort.enqueue(event.data.id);
  }
}
