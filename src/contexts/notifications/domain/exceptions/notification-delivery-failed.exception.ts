import { BaseException } from '@sisques-labs/nestjs-kit';

/**
 * Retry signal (design.md D4): thrown by `DeliverNotificationCommandHandler`
 * on every failed non-final delivery attempt so BullMQ schedules a retry.
 * On the final attempt the handler still throws this after persisting
 * `FAILED`, so the job also lands in BullMQ's failed set for ops
 * inspection.
 */
export class NotificationDeliveryFailedException extends BaseException {
  constructor(reason: string) {
    super(`Notification delivery failed: ${reason}`);
  }
}
