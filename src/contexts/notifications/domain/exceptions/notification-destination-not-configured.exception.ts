import { NonRetryableNotificationDeliveryException } from '@contexts/notifications/domain/exceptions/non-retryable-notification-delivery.exception';

/**
 * Thrown when no delivery destination is registered for the notification's
 * `(tenantId, channel)` pair (design.md D1). Also the always-thrown reason
 * for `EMAIL`/`PUSH`, which have no registrable destination in v1.
 */
export class NotificationDestinationNotConfiguredException extends NonRetryableNotificationDeliveryException {
  constructor() {
    super('No delivery destination is configured for this tenant and channel.');
  }
}
