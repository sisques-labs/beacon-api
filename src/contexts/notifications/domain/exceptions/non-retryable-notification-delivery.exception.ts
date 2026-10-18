import { BaseException } from '@sisques-labs/nestjs-kit';

/**
 * Base for every delivery failure that must not be retried (design.md
 * D1/D2/D3). `NotificationDeliveryProcessor` catches this base class and
 * converts it into a BullMQ `UnrecoverableError`, so the job gets zero
 * further attempts regardless of the queue's configured retry count.
 * Subclasses always pass a fixed message — never the destination URL or
 * ciphertext.
 */
export class NonRetryableNotificationDeliveryException extends BaseException {
  constructor(message: string) {
    super(message);
  }
}
