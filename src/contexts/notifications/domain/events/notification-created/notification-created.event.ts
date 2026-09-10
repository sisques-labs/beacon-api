import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { INotificationEventData } from '@contexts/notifications/domain/events/interfaces/notification-event-data.interface';

export class NotificationCreatedEvent extends BaseEvent<INotificationEventData> {
  constructor(metadata: IEventMetadata, data: INotificationEventData) {
    super(metadata, data);
  }
}
