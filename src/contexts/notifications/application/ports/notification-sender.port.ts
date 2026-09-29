import { INotificationDeliveryDestination } from '@contexts/notifications/application/ports/notification-delivery-destination.interface';
import { INotificationPrimitives } from '@contexts/notifications/domain/primitives/notification.primitives';
import { INotificationSendResult } from '@contexts/notifications/application/ports/notification-send-result.interface';

export const NOTIFICATION_SENDER_PORT = Symbol('NOTIFICATION_SENDER_PORT');

export interface INotificationSenderPort {
  send(
    notification: INotificationPrimitives,
    destination: INotificationDeliveryDestination,
  ): Promise<INotificationSendResult>;
}
