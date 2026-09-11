import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import {
  INotificationSenderPort,
  NOTIFICATION_SENDER_PORT,
} from '@contexts/notifications/application/ports/notification-sender.port';
import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';

@CommandHandler(DeliverNotificationCommand)
export class DeliverNotificationCommandHandler implements ICommandHandler<
  DeliverNotificationCommand,
  void
> {
  private readonly logger = new Logger(DeliverNotificationCommandHandler.name);

  constructor(
    @Inject(NOTIFICATION_WRITE_REPOSITORY)
    private readonly writeRepository: INotificationWriteRepository,
    @Inject(NOTIFICATION_SENDER_PORT)
    private readonly senderPort: INotificationSenderPort,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: DeliverNotificationCommand): Promise<void> {
    const notification = await this.writeRepository.findById(
      command.notificationId.value,
    );
    if (!notification) {
      throw new NotificationNotFoundException(command.notificationId.value);
    }

    const aggregate = this.publisher.mergeObjectContext(notification);
    const result = await this.senderPort.send(aggregate.toPrimitives());

    if (result.success) {
      aggregate.sent();
    } else {
      aggregate.fail(result.failureReason ?? 'Unknown delivery failure');
    }

    await this.writeRepository.save(aggregate);
    aggregate.commit();
    this.logger.log(
      `Notification ${aggregate.id.value} delivery finished with status ${aggregate.status.value}`,
    );
  }
}
