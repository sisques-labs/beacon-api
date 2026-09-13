import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { INotificationDeliveryJobData } from '@contexts/notifications/application/ports/notification-delivery-job-data.interface';
import { INotificationDeliveryQueuePort } from '@contexts/notifications/application/ports/notification-delivery-queue.port';
import { INotificationDeliveryQueueConfig } from '@contexts/notifications/infrastructure/config/interfaces/notification-delivery-queue-config.interface';
import { notificationDeliveryQueueConfig } from '@contexts/notifications/infrastructure/config/notification-delivery-queue.config';

const DELIVERY_JOB_NAME = 'deliver-notification';

/**
 * BullMQ producer adapter (design.md D6). `jobId = notificationId` makes
 * enqueue idempotent for the job's lifetime; attempts/backoff come from
 * `notificationDeliveryQueueConfig` (design.md D3).
 */
@Injectable()
export class BullMqNotificationDeliveryQueueAdapter implements INotificationDeliveryQueuePort {
  private readonly logger = new Logger(
    BullMqNotificationDeliveryQueueAdapter.name,
  );

  constructor(
    @InjectQueue(notificationDeliveryQueueConfig().name)
    private readonly queue: Queue<INotificationDeliveryJobData>,
    private readonly configService: ConfigService,
  ) {}

  async enqueue(notificationId: string): Promise<void> {
    const { attempts, backoffMs } =
      this.configService.getOrThrow<INotificationDeliveryQueueConfig>(
        'notificationDeliveryQueue',
      );

    this.logger.log(`Enqueuing delivery for notification ${notificationId}`);

    await this.queue.add(
      DELIVERY_JOB_NAME,
      { notificationId },
      {
        jobId: notificationId,
        attempts,
        backoff: { type: 'exponential', delay: backoffMs },
      },
    );
  }
}
