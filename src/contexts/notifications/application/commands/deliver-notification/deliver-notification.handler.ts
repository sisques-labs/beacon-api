import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import {
  INotificationSenderPort,
  NOTIFICATION_SENDER_PORT,
} from '@contexts/notifications/application/ports/notification-sender.port';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { AssertNotificationAggregateExistsService } from '@contexts/notifications/application/services/write/assert-notification-aggregate-exists.service';

@CommandHandler(DeliverNotificationCommand)
export class DeliverNotificationCommandHandler
  extends BaseCommandHandler<DeliverNotificationCommand, NotificationAggregate>
  implements ICommandHandler<DeliverNotificationCommand, void>
{
  private readonly logger = new Logger(DeliverNotificationCommandHandler.name);

  constructor(
    @Inject(NOTIFICATION_WRITE_REPOSITORY)
    private readonly writeRepository: INotificationWriteRepository,
    @Inject(NOTIFICATION_SENDER_PORT)
    private readonly senderPort: INotificationSenderPort,
    private readonly assertNotificationAggregateExistsService: AssertNotificationAggregateExistsService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: DeliverNotificationCommand): Promise<void> {
    const notification =
      await this.assertNotificationAggregateExistsService.execute(
        command.notificationId.value,
      );

    const result = await this.senderPort.send(notification.toPrimitives());

    if (result.success) {
      notification.sent();
    } else {
      notification.fail(result.failureReason ?? 'Unknown delivery failure');
    }

    await this.writeRepository.save(notification);
    await this.publishEvents(notification);
    this.logger.log(
      `Notification ${notification.id.value} delivery finished with status ${notification.status.value}`,
    );
  }
}
