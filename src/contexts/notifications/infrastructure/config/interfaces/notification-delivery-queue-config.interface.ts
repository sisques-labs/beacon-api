export interface INotificationDeliveryQueueConfig {
  name: string;
  attempts: number;
  backoffMs: number;
}
