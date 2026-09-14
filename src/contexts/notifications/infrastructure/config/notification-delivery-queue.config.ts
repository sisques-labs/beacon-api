import { registerAs } from '@nestjs/config';

import { INotificationDeliveryQueueConfig } from '@contexts/notifications/infrastructure/config/interfaces/notification-delivery-queue-config.interface';

/**
 * Retry policy for queued delivery attempts (design.md D3): exponential
 * backoff starting at `backoffMs`, doubling per attempt, terminal at
 * `attempts`. Both knobs are env-tunable so production can widen the curve
 * without a code change; the CI/e2e env narrows them for fast tests
 * (design.md D9).
 */
export const notificationDeliveryQueueConfig = registerAs(
  'notificationDeliveryQueue',
  (): INotificationDeliveryQueueConfig => ({
    name:
      process.env.NOTIFICATION_DELIVERY_QUEUE_NAME?.trim() ||
      'notification-delivery',
    attempts: parseInt(
      process.env.NOTIFICATION_DELIVERY_QUEUE_ATTEMPTS ?? '5',
      10,
    ),
    backoffMs: parseInt(
      process.env.NOTIFICATION_DELIVERY_QUEUE_BACKOFF_MS ?? '5000',
      10,
    ),
  }),
);
