import { Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import { NotificationCreatedEvent } from '@contexts/notifications/domain/events/notification-created/notification-created.event';

/**
 * Triggers asynchronous delivery right after a notification is persisted.
 *
 * Dispatching a follow-up command instead of awaiting delivery inline keeps
 * `CreateNotificationCommandHandler` (and therefore Kafka ingestion) from
 * ever blocking on Discord latency — see design.md D2.
 */
@EventsHandler(NotificationCreatedEvent)
export class DeliverNotificationOnCreatedHandler implements IEventHandler<NotificationCreatedEvent> {
  private readonly logger = new Logger(
    DeliverNotificationOnCreatedHandler.name,
  );

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: NotificationCreatedEvent): Promise<void> {
    this.logger.log(`Dispatching delivery for notification ${event.data.id}`);
    await this.commandBus.execute(
      new DeliverNotificationCommand({ notificationId: event.data.id }),
    );
  }
}
