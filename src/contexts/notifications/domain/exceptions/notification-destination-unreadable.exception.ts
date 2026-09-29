import { NonRetryableNotificationDeliveryException } from '@contexts/notifications/domain/exceptions/non-retryable-notification-delivery.exception';

/**
 * Thrown when a registered destination's stored ciphertext cannot be
 * decrypted or authenticated — tamper, wrong key/version, or an AAD
 * mismatch (design.md D3/D5). The fixed message never echoes the
 * ciphertext or any decrypted URL fragment.
 */
export class NotificationDestinationUnreadableException extends NonRetryableNotificationDeliveryException {
  constructor() {
    super('The registered delivery destination could not be read.');
  }
}
