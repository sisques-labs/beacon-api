import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import {
  INotificationSenderPort,
  NOTIFICATION_SENDER_PORT,
} from '@contexts/notifications/application/ports/notification-sender.port';
import { NotificationFailureReasonCodeEnum } from '@contexts/notifications/domain/enums/notification-failure-reason-code.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationDeliveryFailedException } from '@contexts/notifications/domain/exceptions/notification-delivery-failed.exception';
import { NotificationDestinationNotConfiguredException } from '@contexts/notifications/domain/exceptions/notification-destination-not-configured.exception';
import { NotificationDestinationUnreadableException } from '@contexts/notifications/domain/exceptions/notification-destination-unreadable.exception';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { AssertNotificationAggregateExistsService } from '@contexts/notifications/application/services/write/assert-notification-aggregate-exists.service';
import { ResolveNotificationDeliveryDestinationService } from '@contexts/notifications/application/services/write/resolve-notification-delivery-destination/resolve-notification-delivery-destination.service';
import { INotificationDeliveryDestination } from '@contexts/notifications/application/ports/notification-delivery-destination.interface';

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
    private readonly resolveNotificationDeliveryDestinationService: ResolveNotificationDeliveryDestinationService,
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

    const destination = await this.resolveDestination(notification);

    const result = await this.senderPort.send(
      notification.toPrimitives(),
      destination,
    );

    if (result.success) {
      notification.sent();
      await this.persistTerminalState(notification);
      return;
    }

    // D4 — only the final BullMQ attempt is terminal. Every failed attempt
    // throws so BullMQ can retry (or record it in its failed set); the
    // final one additionally persists FAILED first.
    const failureReason = result.failureReason ?? 'Unknown delivery failure';

    if (command.isFinalAttempt.value) {
      notification.fail(failureReason);
      await this.persistTerminalState(notification);
    } else {
      this.logger.warn(
        `Delivery attempt failed for notification ${notification.id.value}, will retry: ${failureReason}`,
      );
    }

    throw new NotificationDeliveryFailedException(failureReason);
  }

  /**
   * Resolves the tenant's registered destination for this notification's
   * channel (design.md D1/D3, Data Flow "Deliver"). No destination, or an
   * unreadable one, is fail-closed: `FAILED` is persisted on this very
   * attempt — regardless of `isFinalAttempt` — and a
   * `NonRetryableNotificationDeliveryException` is thrown so
   * `NotificationDeliveryProcessor` converts it into a BullMQ
   * `UnrecoverableError` (D2) instead of retrying a fault that cannot heal.
   * The raw decrypt/AAD/re-validation error from
   * `ResolveNotificationDeliveryDestinationService` is deliberately never
   * logged, so no ciphertext or decrypted URL fragment reaches the logs.
   */
  private async resolveDestination(
    notification: NotificationAggregate,
  ): Promise<INotificationDeliveryDestination> {
    let destination: INotificationDeliveryDestination | undefined;

    try {
      destination =
        await this.resolveNotificationDeliveryDestinationService.execute({
          tenantId: notification.tenantId.value,
          channel: notification.channel.value,
        });
    } catch {
      await this.failNonRetryable(
        notification,
        NotificationFailureReasonCodeEnum.DESTINATION_UNREADABLE,
      );
      throw new NotificationDestinationUnreadableException();
    }

    if (!destination) {
      await this.failNonRetryable(
        notification,
        NotificationFailureReasonCodeEnum.DESTINATION_NOT_CONFIGURED,
      );
      throw new NotificationDestinationNotConfiguredException();
    }

    return destination;
  }

  private async failNonRetryable(
    notification: NotificationAggregate,
    reason: NotificationFailureReasonCodeEnum,
  ): Promise<void> {
    notification.fail(reason);
    await this.persistTerminalState(notification, `(${reason})`);
  }

  /**
   * Persists a terminal delivery outcome (`SENT` or `FAILED`) through
   * `updateIfExists()` — one atomic `UPDATE`, never an insert — instead of
   * `save()`'s id-based upsert. `assertNotificationAggregateExistsService`
   * confirmed existence at the start of `execute()`, but this attempt may
   * have since raced with a deletion of that row (e.g. tenant/GDPR
   * erasure, ops cleanup, or — in e2e — a fixture truncate racing a
   * still-in-flight async delivery job). A blind `save()` would silently
   * resurrect the row in that window; `updateIfExists()` closes it
   * atomically at the database level instead of a separate check-then-act
   * round trip.
   */
  private async persistTerminalState(
    notification: NotificationAggregate,
    logSuffix = '',
  ): Promise<void> {
    const persisted = await this.writeRepository.updateIfExists(notification);
    if (!persisted) {
      this.logger.warn(
        `Notification ${notification.id.value} no longer exists; skipping delivery state persistence${logSuffix ? ` ${logSuffix}` : ''}`,
      );
      return;
    }

    await this.publishEvents(notification);
    this.logger.log(
      `Notification ${notification.id.value} delivery finished with status ${notification.status.value}${logSuffix ? ` ${logSuffix}` : ''}`,
    );
  }
}
