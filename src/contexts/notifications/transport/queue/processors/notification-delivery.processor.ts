import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Job } from 'bullmq';

import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';
import { INotificationDeliveryJobData } from '@contexts/notifications/application/ports/notification-delivery-job-data.interface';
import { notificationDeliveryQueueConfig } from '@contexts/notifications/infrastructure/config/notification-delivery-queue.config';

/**
 * In-process BullMQ worker (design.md D6). Bus-only, exactly like
 * `NotificationIngestConsumer`: the only place BullMQ job state
 * (`attemptsMade`/`opts.attempts`) is allowed to leak into `isFinalAttempt`
 * (design.md D4) — delivery domain logic stays entirely in the command
 * handler.
 */
@Injectable()
@Processor(notificationDeliveryQueueConfig().name)
export class NotificationDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<INotificationDeliveryJobData>): Promise<void> {
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? attemptNumber;
    const isFinalAttempt = attemptNumber >= maxAttempts;

    this.logger.log(
      `Processing delivery for notification ${job.data.notificationId}, attempt ${attemptNumber}/${maxAttempts}`,
    );

    try {
      await this.commandBus.execute(
        new DeliverNotificationCommand({
          notificationId: job.data.notificationId,
          isFinalAttempt,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Delivery attempt ${attemptNumber}/${maxAttempts} failed for notification ${job.data.notificationId}`,
      );
      throw error;
    }
  }
}
