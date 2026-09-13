/**
 * BullMQ job payload for a queued delivery attempt (design.md D2). Only the
 * notification id travels the wire — the handler re-loads the aggregate, and
 * keeping title/body out of Redis means the queue backend never holds
 * notification content.
 */
export interface INotificationDeliveryJobData {
  notificationId: string;
}
