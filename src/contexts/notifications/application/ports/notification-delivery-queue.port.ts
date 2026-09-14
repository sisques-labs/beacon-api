export const NOTIFICATION_DELIVERY_QUEUE_PORT = Symbol(
  'NOTIFICATION_DELIVERY_QUEUE_PORT',
);

/**
 * Durable enqueue for a notification's delivery attempt (design.md D6).
 * Implemented by a BullMQ adapter in infrastructure/adapters/; consumed by
 * `DeliverNotificationOnCreatedHandler` instead of dispatching
 * `DeliverNotificationCommand` directly through the command bus.
 */
export interface INotificationDeliveryQueuePort {
  enqueue(notificationId: string): Promise<void>;
}
