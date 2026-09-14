import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import {
  INotificationSenderPort,
  NOTIFICATION_SENDER_PORT,
} from '@contexts/notifications/application/ports/notification-sender.port';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationDeliveryFailedException } from '@contexts/notifications/domain/exceptions/notification-delivery-failed.exception';
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

    // D5 — duplicate-send guard: a concurrently-succeeded attempt already
    // moved this aggregate out of PENDING (e.g. a stalled-job re-delivery
    // after lock expiry), so skip re-sending rather than let sent()/fail()
    // throw InvalidNotificationStatusTransitionException on an
    // already-terminal aggregate.
    if (notification.status.value !== NotificationStatusEnum.PENDING) {
      this.logger.log(
        `Skipping delivery for notification ${notification.id.value}: already ${notification.status.value}`,
      );
      return;
    }

    const result = await this.senderPort.send(notification.toPrimitives());

    if (result.success) {
      notification.sent();
      await this.writeRepository.save(notification);
      await this.publishEvents(notification);
      this.logger.log(
        `Notification ${notification.id.value} delivery finished with status ${notification.status.value}`,
      );
      return;
    }

    // D4 — only the final BullMQ attempt is terminal. Every failed attempt
    // throws so BullMQ can retry (or record it in its failed set); the
    // final one additionally persists FAILED first.
    const failureReason = result.failureReason ?? 'Unknown delivery failure';

    if (command.isFinalAttempt.value) {
      notification.fail(failureReason);
      await this.writeRepository.save(notification);
      await this.publishEvents(notification);
      this.logger.log(
        `Notification ${notification.id.value} delivery finished with status ${notification.status.value}`,
      );
    } else {
      this.logger.warn(
        `Delivery attempt failed for notification ${notification.id.value}, will retry: ${failureReason}`,
      );
    }

    throw new NotificationDeliveryFailedException(failureReason);
  }
}
